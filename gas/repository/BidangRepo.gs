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
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var docsSheet = ss.getSheetByName(CONFIG.SHEET_DOCS);
  var target = false;
  var uploader = false;

  // Target references live in the DocBidang junction sheet when populated;
  // fall back to the legacy column R for not-yet-migrated sheets.
  var junctionSheet = ss.getSheetByName(CONFIG.SHEET_DOC_BIDANG);
  var junctionRows = junctionSheet ? junctionSheet.getDataRange().getValues() : [];
  var junctionHasRows = junctionRows.length > 1;
  if (junctionHasRows) {
    for (var j = 1; j < junctionRows.length; j++) {
      if (Number(junctionRows[j][2]) === bidangId) {
        target = true;
        break;
      }
    }
  } else if (docsSheet) {
    var dRows = docsSheet.getDataRange().getValues();
    if (dRows.length >= 2) {
      var header = dRows[0] || [];
      var targetColumn = masterColumn_(header, 'BidangTargetIDs');
      if (targetColumn < 0) targetColumn = 17;
      for (var i = 1; i < dRows.length; i++) {
        var ids = masterIdList_(dRows[i][targetColumn]);
        for (var k = 0; k < ids.length; k++) {
          if (Number(ids[k]) === bidangId) { target = true; break; }
        }
        if (target) break;
      }
    }
  }

  // Uploader snapshot still lives in Database_Regulasi column S (UploaderBidangID).
  if (docsSheet) {
    var rows = docsSheet.getDataRange().getValues();
    if (rows.length >= 2) {
      var header = rows[0] || [];
      var uploaderColumn = masterColumn_(header, 'UploaderBidangID');
      if (uploaderColumn < 0) uploaderColumn = 18;
      for (var i = 1; i < rows.length; i++) {
        if (Number(rows[i][uploaderColumn]) === bidangId) {
          uploader = true;
          break;
        }
      }
    }
  }

  return { target: target, uploader: uploader };
}
