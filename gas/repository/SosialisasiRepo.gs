function getSosialisasiSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_SOSIALISASI);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_SOSIALISASI);
    sheet.appendRow(['Timestamp', 'NRP', 'Nama', 'DocRowIndex', 'JudulDokumen']);
  }
  return sheet;
}
