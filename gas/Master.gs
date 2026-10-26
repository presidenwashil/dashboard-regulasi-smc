function getMasterBidangSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_MASTER_BIDANG);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_MASTER_BIDANG);
    sheet.appendRow(['Bidang']);
    [
      'Umum', 'SDM', 'Casemix', 'IT', 'Marketing', 'Keuangan', 'Yanmed', 'Jangmed',
      'Komite Mutu', 'Komite Medik', 'Komite Keperawatan', 'Komite PPI', 'Komite K3RS', 'SPI'
    ].forEach(function (b) { sheet.appendRow([b]); });
  }
  return sheet;
}

function getMasterBidang() {
  try {
    var rows = getMasterBidangSheet_().getDataRange().getValues();
    var list = [];
    for (var i = 1; i < rows.length; i++) {
      var v = (rows[i][0] || '').toString().trim();
      if (v) list.push(v);
    }
    return { success: true, data: list };
  } catch (err) {
    return { success: false, message: 'Gagal mengambil master bidang: ' + err.toString() };
  }
}