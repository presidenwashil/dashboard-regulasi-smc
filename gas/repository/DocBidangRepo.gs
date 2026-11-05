function getDocBidangSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_DOC_BIDANG);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_DOC_BIDANG);
    sheet.appendRow(['Timestamp', 'DocRowIndex', 'BidangID']);
  }
  return sheet;
}

function getAllDocBidangRows_() {
  var sheet = getDocBidangSheet_();
  return sheet.getDataRange().getValues();
}

function getDocBidangIdsForDoc_(docRowIndex, rows) {
  var ids = [];
  for (var i = 1; i < rows.length; i++) {
    if (Number(rows[i][1]) === Number(docRowIndex)) {
      var id = Number(rows[i][2]);
      if (Number.isInteger(id) && id > 0) ids.push(id);
    }
  }
  return ids;
}

function groupDocBidangByDoc_(rows) {
  var map = {};
  for (var i = 1; i < rows.length; i++) {
    var docIndex = Number(rows[i][1]);
    var id = Number(rows[i][2]);
    if (!Number.isInteger(docIndex) || docIndex < 2) continue;
    if (!Number.isInteger(id) || id <= 0) continue;
    if (!map[docIndex]) map[docIndex] = [];
    if (map[docIndex].indexOf(id) === -1) map[docIndex].push(id);
  }
  return map;
}

function replaceTargetsForDoc_(docRowIndex, bidangIds) {
  var sheet = getDocBidangSheet_();
  var rows = sheet.getDataRange().getValues();
  var ids = [];
  for (var i = 0; i < (bidangIds || []).length; i++) {
    var id = Number(bidangIds[i]);
    if (Number.isInteger(id) && id > 0 && ids.indexOf(id) === -1) ids.push(id);
  }
  // Capture original row numbers for this doc BEFORE appending.
  var oldRowNumbers = [];
  for (var o = rows.length - 1; o >= 1; o--) {
    if (Number(rows[o][1]) === Number(docRowIndex)) {
      oldRowNumbers.push(o + 1);
    }
  }
  // Write new rows first (safety: failure leaves duplicates, not gaps).
  for (var j = 0; j < ids.length; j++) {
    sheet.appendRow([new Date(), docRowIndex, ids[j]]);
  }
  // Then delete the original rows from bottom to top (indices stay stable).
  oldRowNumbers.sort(function (a, b) { return b - a; });
  for (var d = 0; d < oldRowNumbers.length; d++) {
    sheet.deleteRow(oldRowNumbers[d]);
  }
  return ids;
}
