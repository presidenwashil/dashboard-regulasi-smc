function getUsersSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_USERS);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_USERS);
    sheet.appendRow(['Timestamp', 'Nama', 'Profesi', 'Bidang', 'Unit', 'NRP', 'PasswordHash', 'Salt', 'Status', 'Role', 'UnitID']);
  }
  ensureUsersUnitIdColumn_(sheet);
  return sheet;
}

function ensureUsersUnitIdColumn_(sheet) {
  var rows = sheet.getDataRange().getValues();
  var header = rows[0] || [];
  var column = masterColumn_(header, 'UnitID');
  if (column < 0) {
    column = header.length;
    sheet.getRange(1, column + 1).setValue('UnitID');
  }
  return column + 1;
}

function userOrganization_(row, sheet, masterBidang) {
  var unitIdColumn = ensureUsersUnitIdColumn_(sheet);
  return userOrganizationByUnitId_(row[unitIdColumn - 1], masterBidang);
}


function getPendingUsers_(token) {
  var auth = requireCurrentAdmin_(token);
  if (auth.error) return auth.error;

  var sheet = getUsersSheet_();
  var rows = sheet.getDataRange().getValues();
  var masterBidang = getMasterBidangValues_();
  var pending = [];
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][8] === 'Pending') {
      var organization = userOrganization_(rows[i], sheet, masterBidang);
      pending.push({
        rowIndex: i + 1,
        nama: rows[i][1], profesi: rows[i][2],
        bidang: organization ? organization.bidang : (rows[i][3] || ''),
        bidangId: organization ? organization.bidangId : null,
        unit: organization ? organization.unit : (rows[i][4] || ''),
        unitId: organization ? organization.unitId : null,
        nrp: rows[i][5]
      });
    }
  }
  return { success: true, data: pending };
}

function setUserStatus_(token, rowIndex, newStatus, approvedUnitId) {
  var auth = requireCurrentAdmin_(token);
  if (auth.error) return auth.error;

  try {
    var sheet = getUsersSheet_();
    var rowNumber = Number(rowIndex);
    var rows = sheet.getDataRange().getValues();
    if (!Number.isInteger(rowNumber) || rowNumber < 2 || rowNumber > rows.length) {
      return { success: false, message: 'Gagal update status: baris tidak ditemukan.' };
    }
    if (newStatus === 'Approved') {
      var bidang = getMasterBidangValues_();
      var unit = masterUnitById_(approvedUnitId, getMasterUnitValues_(bidang));
      if (!unit) {
        return { success: false, message: 'Unit harus dipilih dari MasterUnit sebelum akun disetujui.' };
      }
      sheet.getRange(rowNumber, 4, 1, 2).setValues([[unit.bidang, unit.name]]);
      sheet.getRange(rowNumber, ensureUsersUnitIdColumn_(sheet)).setValue(unit.id);
    }
    sheet.getRange(rowNumber, 9).setValue(newStatus); // kolom I = Status
    return { success: true, message: 'Status user diperbarui menjadi ' + newStatus + '.' };
  } catch (err) {
    return { success: false, message: 'Gagal update status: ' + err.toString() };
  }
}

function updateUserUnit_(token, nrp, unitId) {
  var auth = requireCurrentAdmin_(token);
  if (auth.error) return auth.error;

  try {
    var bidang = getMasterBidangValues_();
    var unit = masterUnitById_(unitId, getMasterUnitValues_(bidang));
    if (!unit) return { success: false, message: 'Unit harus dipilih dari MasterUnit.' };
    var targetNrp = (nrp || '').toString().trim();
    var sheet = getUsersSheet_();
    var rows = sheet.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if ((rows[i][5] || '').toString().trim() !== targetNrp) continue;
      sheet.getRange(i + 1, 4, 1, 2).setValues([[unit.bidang, unit.name]]);
      sheet.getRange(i + 1, ensureUsersUnitIdColumn_(sheet)).setValue(unit.id);
      return { success: true, message: 'Unit user berhasil diperbarui.' };
    }
    return { success: false, message: 'User tidak ditemukan.' };
  } catch (err) {
    return { success: false, message: 'Gagal memperbarui Unit user: ' + err.toString() };
  }
}

function getAllUsers_(token) {
  var auth = requireCurrentAdmin_(token);
  if (auth.error) return auth.error;

  try {
    var sheet = getUsersSheet_();
    var rows = sheet.getDataRange().getValues();
    var masterBidang = getMasterBidangValues_();
    var users = [];
    for (var i = 1; i < rows.length; i++) {
      var organization = userOrganization_(rows[i], sheet, masterBidang);
      users.push({
        rowIndex: i + 1,
        nama: rows[i][1], profesi: rows[i][2],
        bidang: organization ? organization.bidang : (rows[i][3] || ''),
        bidangId: organization ? organization.bidangId : null,
        unit: organization ? organization.unit : (rows[i][4] || ''),
        unitId: organization ? organization.unitId : null,
        nrp: rows[i][5], status: rows[i][8], role: rows[i][9]
      });
    }
    return { success: true, data: users };
  } catch (err) {
    return { success: false, message: 'Gagal mengambil daftar user: ' + err.toString() };
  }
}

function resetUserPassword_(token, rowIndex, newPassword) {
  var auth = requireCurrentAdmin_(token);
  if (auth.error) return auth.error;

  newPassword = (newPassword || '').toString();
  if (newPassword.length < 6) return { success: false, message: 'Password baru minimal 6 karakter.' };

  try {
    var salt = generateSalt_();
    getUsersSheet_().getRange(rowIndex, 7, 1, 2).setValues([[hashPassword_(newPassword, salt), salt]]);
    return { success: true, message: 'Password user berhasil direset. Sampaikan password baru ke user secara langsung/aman.' };
  } catch (err) {
    return { success: false, message: 'Gagal mereset password: ' + err.toString() };
  }
}

function updateMyProfile_(token, profile) {
  var auth = requireAccess_(token);
  if (auth.error) return auth.error;

  try {
    var nrp = (auth.session.nrp || "").toString().trim();
    var sheet = getUsersSheet_();
    var rows = sheet.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if ((rows[i][5] || "").toString().trim() !== nrp) continue;

      var organization = userOrganization_(rows[i], sheet, getMasterBidangValues_());
      var user = {
        nama: (profile.nama || "").toString().trim(),
        profesi: (profile.profesi || "").toString().trim(),
        bidang: organization ? organization.bidang : "",
        bidangId: organization ? organization.bidangId : null,
        unit: organization ? organization.unit : "",
        unitId: organization ? organization.unitId : null,
        nrp: nrp,
        role: auth.session.role,
        sessionVersion: auth.session.sessionVersion || currentSessionVersion_(nrp),
      };
      sheet.getRange(i + 1, 2, 1, 2).setValues([
        [user.nama, user.profesi],
      ]);
      CacheService.getScriptCache().put(
        token,
        JSON.stringify(user),
        CONFIG.SESSION_SECONDS,
      );
      return { success: true, user: publicUser_(user) };
    }
    return { success: false, message: "User tidak ditemukan." };
  } catch (err) {
    return { success: false, message: "Gagal memperbarui profil: " + err.toString() };
  }
}

function changeMyPassword_(token, newPassword) {
  var auth = requireAccess_(token);
  if (auth.error) return auth.error;

  newPassword = (newPassword || "").toString();
  if (newPassword.length < 6) {
    return { success: false, message: "Password baru minimal 6 karakter." };
  }

  try {
    var nrp = (auth.session.nrp || "").toString().trim();
    var sheet = getUsersSheet_();
    var rows = sheet.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if ((rows[i][5] || "").toString().trim() !== nrp) continue;

      var salt = generateSalt_();
      var changed = revokeOtherSessions_(nrp, token, auth.session, function () {
        sheet.getRange(i + 1, 7, 1, 2).setValues([
          [hashPassword_(newPassword, salt), salt],
        ]);
      });
      if (!changed) {
        return {
          success: false,
          message: "Sesi tidak valid, silakan login ulang.",
          sessionExpired: true,
        };
      }
      return { success: true, message: "Password berhasil diubah." };
    }
    return { success: false, message: "User tidak ditemukan." };
  } catch (err) {
    return { success: false, message: "Gagal mengubah password: " + err.toString() };
  }
}

function getUserStats_(token) {
  var auth = requireAccess_(token);
  if (auth.error) return auth.error;

  try {
    var sheet = getUsersSheet_();
    var rows = sheet.getDataRange().getValues();
    var masterBidang = getMasterBidangValues_();
    var byBidang = {}, byUnit = {}, total = 0;

    for (var i = 1; i < rows.length; i++) {
      if (rows[i][8] !== 'Approved') continue;
      total++;
      var organization = userOrganization_(rows[i], sheet, masterBidang);
      var bidang = organization ? organization.bidang : 'Lainnya';
      var unit = organization ? organization.unit : 'Lainnya';
      byBidang[bidang] = (byBidang[bidang] || 0) + 1;
      byUnit[unit] = (byUnit[unit] || 0) + 1;
    }
    return { success: true, totalUser: total, byBidang: byBidang, byUnit: byUnit };
  } catch (err) {
    return { success: false, message: 'Gagal mengambil statistik user: ' + err.toString() };
  }
}

function seedAdminAccount_() {
  var nrpAdmin = 'admin01';
  var passwordAdmin = 'GANTI_PASSWORD_INI';

  var sheet = getUsersSheet_();
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if ((rows[i][5] || '').toString().trim() === nrpAdmin) {
      Logger.log('Akun admin dengan NRP tersebut sudah ada.');
      return;
    }
  }

  var salt = generateSalt_();
  sheet.appendRow([
    new Date(), 'Admin Utama', 'Administrator', 'IT', '-',
    nrpAdmin, hashPassword_(passwordAdmin, salt), salt, 'Approved', 'Admin'
  ]);
  Logger.log('Akun admin berhasil dibuat. NRP: ' + nrpAdmin);
}

function getPendingUsers() { return getPendingUsers_.apply(this, arguments); }
function setUserStatus() { return setUserStatus_.apply(this, arguments); }
function updateUserUnit() { return updateUserUnit_.apply(this, arguments); }
function getAllUsers() { return getAllUsers_.apply(this, arguments); }
function resetUserPassword() { return resetUserPassword_.apply(this, arguments); }
function updateMyProfile() { return updateMyProfile_.apply(this, arguments); }
function changeMyPassword() { return changeMyPassword_.apply(this, arguments); }
function getUserStats() { return getUserStats_.apply(this, arguments); }
function seedAdminAccount() { return seedAdminAccount_.apply(this, arguments); }


