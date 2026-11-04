function getMasterBidangSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_MASTER_BIDANG);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_MASTER_BIDANG);
    sheet.appendRow(['Bidang', 'BidangID']);
    [
      ['Umum', 1], ['SDM', 2], ['Casemix', 3], ['IT', 4], ['Marketing', 5],
      ['Keuangan', 6], ['Yanmed', 7], ['Jangmed', 8], ['Komite Mutu', 9],
      ['Komite Medik', 10], ['Komite Keperawatan', 11], ['Komite PPI', 12],
      ['Komite K3RS', 13], ['SPI', 14]
    ].forEach(function (entry) { sheet.appendRow(entry); });
    return sheet;
  }

  var header = sheet.getDataRange().getValues()[0] || [];
  var hasHeader = header.some(function (cell) {
    return String(cell || '').trim() !== '';
  });
  if (!hasHeader) {
    sheet.getRange(1, 1, 1, 2).setValues([['Bidang', 'BidangID']]);
    return sheet;
  }

  var bidangColumn = masterColumn_(header, 'Bidang');
  if (bidangColumn < 0) {
    bidangColumn = masterNextColumn_(header) - 1;
    sheet.getRange(1, bidangColumn + 1).setValue('Bidang');
    header.push('Bidang');
  }
  if (masterColumn_(header, 'BidangID') < 0) {
    sheet.getRange(1, masterNextColumn_(header)).setValue('BidangID');
  }
  return sheet;
}

function getMasterBidangValues_() {
  var rows = getMasterBidangSheet_().getDataRange().getValues();
  var header = rows[0] || [];
  var nameColumn = masterRowColumn_(header, 'Bidang', 0);
  var idColumn = masterColumn_(header, 'BidangID');
  if (idColumn < 0) throw new Error('Kolom BidangID belum tersedia di MasterBidang.');

  var list = [];
  var seen = {};
  for (var i = 1; i < rows.length; i++) {
    var name = (rows[i][nameColumn] || '').toString().trim();
    var rawId = rows[i][idColumn];
    if (!name && (rawId === '' || rawId === null || rawId === undefined)) continue;
    var id = Number(rawId);
    if (!name || !Number.isInteger(id) || id <= 0) {
      throw new Error('Setiap baris MasterBidang harus memiliki nama dan BidangID numerik positif.');
    }
    if (seen[id]) throw new Error('BidangID duplikat di MasterBidang: ' + id);
    seen[id] = true;
    list.push({ id: id, name: name });
  }
  return list;
}

function documentBidangReferences_(bidangId) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_DOCS);
  if (!sheet) return { target: false, uploader: false };
  var rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return { target: false, uploader: false };

  var header = rows[0] || [];
  var targetColumn = masterColumn_(header, 'BidangTargetIDs');
  var uploaderColumn = masterColumn_(header, 'UploaderBidangID');
  if (targetColumn < 0) targetColumn = 17;
  if (uploaderColumn < 0) uploaderColumn = 18;

  var target = false;
  var uploader = false;
  for (var i = 1; i < rows.length; i++) {
    var ids = masterIdList_(rows[i][targetColumn]);
    for (var j = 0; j < ids.length; j++) {
      if (Number(ids[j]) === bidangId) {
        target = true;
        break;
      }
    }
    if (Number(rows[i][uploaderColumn]) === bidangId) uploader = true;
    if (target && uploader) break;
  }
  return { target: target, uploader: uploader };
}
