function getMasterUnitSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_MASTER_UNIT);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_MASTER_UNIT);
    sheet.appendRow(['UnitID', 'Unit', 'BidangID']);
    return sheet;
  }

  var rows = sheet.getDataRange().getValues();
  var header = rows[0] || [];
  var hasHeader = header.some(function (cell) {
    return String(cell || '').trim() !== '';
  });
  if (!hasHeader) {
    sheet.getRange(1, 1, 1, 3).setValues([['UnitID', 'Unit', 'BidangID']]);
    return sheet;
  }

  ['UnitID', 'Unit', 'BidangID'].forEach(function (name) {
    if (masterColumn_(header, name) < 0) {
      sheet.getRange(1, masterNextColumn_(header)).setValue(name);
      header.push(name);
    }
  });
  return sheet;
}

function getMasterUnitValues_(masterBidang) {
  var rows = getMasterUnitSheet_().getDataRange().getValues();
  var header = rows[0] || [];
  var idColumn = masterColumn_(header, 'UnitID');
  var nameColumn = masterColumn_(header, 'Unit');
  var bidangIdColumn = masterColumn_(header, 'BidangID');
  if (idColumn < 0 || nameColumn < 0 || bidangIdColumn < 0) {
    throw new Error('MasterUnit harus memiliki kolom UnitID, Unit, dan BidangID.');
  }

  var bidangById = {};
  (masterBidang || getMasterBidangValues_()).forEach(function (bidang) {
    bidangById[bidang.id] = bidang;
  });
  var list = [];
  var seen = {};
  for (var i = 1; i < rows.length; i++) {
    var name = (rows[i][nameColumn] || '').toString().trim();
    var rawId = rows[i][idColumn];
    var rawBidangId = rows[i][bidangIdColumn];
    if (!name && (rawId === '' || rawId === null || rawId === undefined) &&
        (rawBidangId === '' || rawBidangId === null || rawBidangId === undefined)) continue;
    var id = Number(rawId);
    var bidangId = Number(rawBidangId);
    if (!name || !Number.isInteger(id) || id <= 0 ||
        !Number.isInteger(bidangId) || !bidangById[bidangId]) {
      throw new Error('Setiap baris MasterUnit harus memiliki UnitID, nama Unit, dan BidangID yang valid.');
    }
    if (seen[id]) throw new Error('UnitID duplikat di MasterUnit: ' + id);
    seen[id] = true;
    list.push({
      id: id,
      name: name,
      bidangId: bidangId,
      bidang: bidangById[bidangId].name,
    });
  }
  return list;
}

function userOrganizationByUnitId_(unitId, masterBidang) {
  var unit = masterUnitById_(unitId, getMasterUnitValues_(masterBidang));
  if (!unit) return null;
  return {
    unitId: unit.id,
    unit: unit.name,
    bidangId: unit.bidangId,
    bidang: unit.bidang,
  };
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
