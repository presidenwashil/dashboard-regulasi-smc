function getSessionUser_(token) {
  if (!token) return null;
  var raw = CacheService.getScriptCache().get(token);
  if (!raw) return null;
  var session = JSON.parse(raw);
  var version = currentSessionVersion_(session.nrp);
  return (session.sessionVersion || "0").toString() === version ? session : null;
}

function sessionVersionKey_(nrp) {
  return "SESSION_VERSION_" + encodeURIComponent((nrp || "").toString().trim());
}

function currentSessionVersion_(nrp) {
  return PropertiesService.getScriptProperties().getProperty(sessionVersionKey_(nrp)) || "0";
}

function publicUser_(session) {
  return {
    nama: session.nama,
    profesi: session.profesi,
    bidang: session.bidang,
    bidangId: session.bidangId,
    unit: session.unit,
    unitId: session.unitId,
    nrp: session.nrp,
    role: session.role,
  };
}

function revokeOtherSessions_(nrp, currentToken, activeSession, savePassword) {
  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    var currentSession = getSessionUser_(currentToken);
    if (!currentSession || currentSession.sessionVersion !== activeSession.sessionVersion) {
      return false;
    }
    savePassword();
    var version = String(Number(currentSessionVersion_(nrp)) + 1);
    PropertiesService.getScriptProperties().setProperty(sessionVersionKey_(nrp), version);
    currentSession.sessionVersion = version;
    CacheService.getScriptCache().put(currentToken, JSON.stringify(currentSession), CONFIG.SESSION_SECONDS);
    return true;
  } finally {
    lock.releaseLock();
  }
}

function requireAccess_(token, role) {
  var session = getSessionUser_(token);
  if (!session) {
    return {
      error: {
        success: false,
        message: "Sesi tidak valid, silakan login ulang.",
      },
    };
  }
  if (role && session.role !== role) {
    return { error: { success: false, message: "Akses ditolak." } };
  }
  return { session: session };
}

function registerUser_(data) {
  try {
    var nrp = (data.nrp || "").toString().trim();
    var nama = (data.nama || "").toString().trim();
    var password = data.password || "";

    if (!nrp || !nama || !password) {
      return {
        success: false,
        message: "Nama, NRP, dan Password wajib diisi.",
      };
    }
    if (password.length < 6) {
      return { success: false, message: "Password minimal 6 karakter." };
    }
    var bidang = getMasterBidangValues_();
    var unit = masterUnitById_(data.unitId, getMasterUnitValues_(bidang));
    if (!unit) {
      return { success: false, message: "Unit harus dipilih dari MasterUnit." };
    }

    var sheet = getUsersSheet_();
    var rows = sheet.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if ((rows[i][5] || "").toString().trim() === nrp) {
        return {
          success: false,
          message:
            "NRP sudah terdaftar. Silakan login, atau hubungi Admin jika lupa password.",
        };
      }
    }

    var salt = generateSalt_();
    sheet.appendRow([
      new Date(),
      nama,
      data.profesi || "",
      unit.bidang,
      unit.name,
      nrp,
      hashPassword_(password, salt),
      salt,
      "Pending",
      "User",
      unit.id,
    ]);

    return {
      success: true,
      message:
        "Registrasi berhasil! Akun Anda menunggu approval dari Admin sebelum bisa login.",
    };
  } catch (err) {
    return { success: false, message: "Error registrasi: " + err.toString() };
  }
}

function loginUser_(nrp, password) {
  try {
    nrp = (nrp || "").toString().trim();
    var rows = getUsersSheet_().getDataRange().getValues();

    for (var i = 1; i < rows.length; i++) {
      if ((rows[i][5] || "").toString().trim() !== nrp) continue;

      var hash = rows[i][6],
        salt = rows[i][7],
        status = rows[i][8],
        role = rows[i][9];

      if (hashPassword_(password, salt) !== hash) {
        return { success: false, message: "NRP atau password salah." };
      }
      if (status !== "Approved") {
        return {
          success: false,
          message:
            status === "Pending"
              ? "Akun Anda masih menunggu approval dari Admin."
              : "Akun Anda ditolak/nonaktif. Hubungi Admin.",
        };
      }

      var unitIdColumn = ensureUsersUnitIdColumn_(getUsersSheet_());
      var organization = userOrganizationByUnitId_(
        rows[i][unitIdColumn - 1],
        getMasterBidangValues_(),
      );
      var userInfo = {
        nama: rows[i][1],
        profesi: rows[i][2],
        bidang: organization ? organization.bidang : "",
        bidangId: organization ? organization.bidangId : null,
        unit: organization ? organization.unit : "",
        unitId: organization ? organization.unitId : null,
        nrp: nrp,
        role: role,
        sessionVersion: currentSessionVersion_(nrp),
      };
      var token = Utilities.getUuid();
      CacheService.getScriptCache().put(
        token,
        JSON.stringify(userInfo),
        CONFIG.SESSION_SECONDS,
      );

      return { success: true, token: token, user: publicUser_(userInfo) };
    }

    return { success: false, message: "NRP atau password salah." };
  } catch (err) {
    return { success: false, message: "Error login: " + err.toString() };
  }
}

function logoutSession_(token) {
  CacheService.getScriptCache().remove(token);
  return { success: true };
}

function registerUser() { return registerUser_.apply(this, arguments); }
function loginUser() { return loginUser_.apply(this, arguments); }
function logoutSession() { return logoutSession_.apply(this, arguments); }


function requireCurrentAdmin_(token) {
  var auth = requireAccess_(token);
  if (auth.error) return auth;

  var nrp = (auth.session.nrp || '').toString().trim();
  var rows = getUsersSheet_().getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if ((rows[i][5] || '').toString().trim() !== nrp) continue;
    if (rows[i][8] !== 'Approved' || rows[i][9] !== 'Admin') {
      return { error: { success: false, message: 'Akses ditolak.' } };
    }
    return auth;
  }
  return { error: { success: false, message: 'Akses ditolak.' } };
}
function currentDocumentActor_(session) {
  var nrp = (session.nrp || '').toString().trim();
  var sheet = getUsersSheet_();
  var rows = sheet.getDataRange().getValues();
  var unitIdColumn = ensureUsersUnitIdColumn_(sheet);
  var masterBidang = getMasterBidangValues_();
  for (var i = 1; i < rows.length; i++) {
    if ((rows[i][5] || '').toString().trim() !== nrp) continue;
    if (rows[i][8] !== 'Approved') return null;
    var organization = userOrganizationByUnitId_(rows[i][unitIdColumn - 1], masterBidang);
    return {
      nrp: nrp,
      nama: rows[i][1],
      bidang: organization ? organization.bidang : '',
      bidangId: organization ? organization.bidangId : null,
      unit: organization ? organization.unit : '',
      unitId: organization ? organization.unitId : null,
      status: rows[i][8],
      role: (rows[i][9] || '').toString(),
    };
  }
  return null;
}

