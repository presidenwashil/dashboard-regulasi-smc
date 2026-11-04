function getUsersSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_USERS);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_USERS);
    sheet.appendRow(SCHEMA.Users);
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

function unitHasUserReference_(unitId) {
  var sheet = getUsersSheet_();
  var rows = sheet.getDataRange().getValues();
  var unitIdColumn = ensureUsersUnitIdColumn_(sheet);
  for (var i = 1; i < rows.length; i++) {
    if (Number(rows[i][unitIdColumn - 1]) === unitId) return true;
  }
  return false;
}
