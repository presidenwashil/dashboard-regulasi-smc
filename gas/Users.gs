function getUsersSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_USERS);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_USERS);
    sheet.appendRow(['Timestamp', 'Nama', 'Profesi', 'Bidang', 'Unit', 'NRP', 'PasswordHash', 'Salt', 'Status', 'Role']);
  }
  return sheet;
}

function getPendingUsers(token) {
  var auth = requireAccess_(token, 'Admin');
  if (auth.error) return auth.error;

  var rows = getUsersSheet_().getDataRange().getValues();
  var pending = [];
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][8] === 'Pending') {
      pending.push({
        rowIndex: i + 1,
        nama: rows[i][1], profesi: rows[i][2], bidang: rows[i][3],
        unit: rows[i][4], nrp: rows[i][5]
      });
    }
  }
  return { success: true, data: pending };
}

function setUserStatus(token, rowIndex, newStatus) {
  var auth = requireAccess_(token, 'Admin');
  if (auth.error) return auth.error;

  try {
    getUsersSheet_().getRange(rowIndex, 9).setValue(newStatus); // kolom I = Status
    return { success: true, message: 'Status user diperbarui menjadi ' + newStatus + '.' };
  } catch (err) {
    return { success: false, message: 'Gagal update status: ' + err.toString() };
  }
}

function getAllUsers(token) {
  var auth = requireAccess_(token, 'Admin');
  if (auth.error) return auth.error;

  try {
    var rows = getUsersSheet_().getDataRange().getValues();
    var users = [];
    for (var i = 1; i < rows.length; i++) {
      users.push({
        rowIndex: i + 1,
        nama: rows[i][1], profesi: rows[i][2], bidang: rows[i][3], unit: rows[i][4],
        nrp: rows[i][5], status: rows[i][8], role: rows[i][9]
      });
    }
    return { success: true, data: users };
  } catch (err) {
    return { success: false, message: 'Gagal mengambil daftar user: ' + err.toString() };
  }
}

function resetUserPassword(token, rowIndex, newPassword) {
  var auth = requireAccess_(token, 'Admin');
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

function getUserStats(token) {
  var auth = requireAccess_(token);
  if (auth.error) return auth.error;

  try {
    var rows = getUsersSheet_().getDataRange().getValues();
    var byBidang = {}, byUnit = {}, total = 0;

    for (var i = 1; i < rows.length; i++) {
      if (rows[i][8] !== 'Approved') continue;
      total++;
      var bidang = rows[i][3] || 'Lainnya';
      var unit = rows[i][4] || 'Lainnya';
      byBidang[bidang] = (byBidang[bidang] || 0) + 1;
      byUnit[unit] = (byUnit[unit] || 0) + 1;
    }
    return { success: true, totalUser: total, byBidang: byBidang, byUnit: byUnit };
  } catch (err) {
    return { success: false, message: 'Gagal mengambil statistik user: ' + err.toString() };
  }
}

function seedAdminAccount() {
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