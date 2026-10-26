function generateSalt_() {
  return Utilities.getUuid();
}

function hashPassword_(password, salt) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    password + salt,
    Utilities.Charset.UTF_8,
  );
  return bytes
    .map(function (b) {
      var v = (b < 0 ? b + 256 : b).toString(16);
      return v.length === 1 ? "0" + v : v;
    })
    .join("");
}

function getSessionUser_(token) {
  if (!token) return null;
  var raw = CacheService.getScriptCache().get(token);
  return raw ? JSON.parse(raw) : null;
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

function registerUser(data) {
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
      data.bidang || "",
      data.unit || "",
      nrp,
      hashPassword_(password, salt),
      salt,
      "Pending",
      "User",
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

function loginUser(nrp, password) {
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

      var userInfo = {
        nama: rows[i][1],
        profesi: rows[i][2],
        bidang: rows[i][3],
        unit: rows[i][4],
        nrp: nrp,
        role: role,
      };
      var token = Utilities.getUuid();
      CacheService.getScriptCache().put(
        token,
        JSON.stringify(userInfo),
        CONFIG.SESSION_SECONDS,
      );

      return { success: true, token: token, user: userInfo };
    }

    return { success: false, message: "NRP atau password salah." };
  } catch (err) {
    return { success: false, message: "Error login: " + err.toString() };
  }
}

function logoutSession(token) {
  try {
    CacheService.getScriptCache().remove(token);
  } catch (e) {}
  return { success: true };
}
