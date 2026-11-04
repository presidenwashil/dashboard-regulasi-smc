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

function getMasterBidang_() {
  try {
    return { success: true, data: getMasterBidangValues_() };
  } catch (err) {
    return { success: false, message: 'Gagal mengambil master bidang: ' + err.toString() };
  }
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

function getMasterUnit_() {
  try {
    var bidang = getMasterBidangValues_();
    return { success: true, data: getMasterUnitValues_(bidang) };
  } catch (err) {
    return { success: false, message: 'Gagal mengambil master Unit: ' + err.toString() };
  }
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

/* ==================== MASTER WRITES (Admin) ==================== */

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

function unitHasUserReference_(unitId) {
  var sheet = getUsersSheet_();
  var rows = sheet.getDataRange().getValues();
  var unitIdColumn = ensureUsersUnitIdColumn_(sheet);
  for (var i = 1; i < rows.length; i++) {
    if (Number(rows[i][unitIdColumn - 1]) === unitId) return true;
  }
  return false;
}

function createMasterBidang_(token, name) {
  var auth = requireCurrentAdmin_(token);
  if (auth.error) return auth.error;

  var trimmed = (name === null || name === undefined ? '' : String(name)).trim();
  if (!trimmed) return { success: false, message: 'Nama Bidang wajib diisi.' };

  try {
    return withMasterLock_(function () {
      var existing = getMasterBidangValues_();
      var sheet = getMasterBidangSheet_();
      var header = sheet.getDataRange().getValues()[0] || [];
      var id = nextMasterId_('bidang', existing.map(function (bidang) { return bidang.id; }));
      sheet.appendRow(masterRowForHeader_(header, { bidang: trimmed, bidangid: id }));
      return {
        success: true,
        message: 'Bidang berhasil ditambahkan.',
        data: { id: id, name: trimmed },
      };
    });
  } catch (err) {
    return { success: false, message: 'Gagal menambahkan Bidang: ' + err.toString() };
  }
}

function renameMasterBidang_(token, id, name) {
  var auth = requireCurrentAdmin_(token);
  if (auth.error) return auth.error;

  var trimmed = (name === null || name === undefined ? '' : String(name)).trim();
  if (!trimmed) return { success: false, message: 'Nama Bidang wajib diisi.' };
  var bidangId = Number(id);
  if (!Number.isInteger(bidangId) || bidangId <= 0) {
    return { success: false, message: 'Bidang tidak ditemukan.' };
  }

  try {
    return withMasterLock_(function () {
      getMasterBidangValues_();
      var sheet = getMasterBidangSheet_();
      var header = sheet.getDataRange().getValues()[0] || [];
      var idColumn = masterColumn_(header, 'BidangID');
      var nameColumn = masterRowColumn_(header, 'Bidang', 0);
      var found = findMasterRow_(sheet, idColumn, bidangId);
      if (!found) return { success: false, message: 'Bidang tidak ditemukan.' };

      sheet.getRange(found.rowNumber, nameColumn + 1).setValue(trimmed);
      return {
        success: true,
        message: 'Nama Bidang berhasil diperbarui.',
        data: { id: bidangId, name: trimmed },
      };
    });
  } catch (err) {
    return { success: false, message: 'Gagal memperbarui Bidang: ' + err.toString() };
  }
}

function deleteMasterBidang_(token, id) {
  var auth = requireCurrentAdmin_(token);
  if (auth.error) return auth.error;

  var bidangId = Number(id);
  if (!Number.isInteger(bidangId) || bidangId <= 0) {
    return { success: false, message: 'Bidang tidak ditemukan.' };
  }

  try {
    return withMasterLock_(function () {
      var masterBidang = getMasterBidangValues_();
      var target = masterBidangById_(bidangId, masterBidang);
      if (!target) return { success: false, message: 'Bidang tidak ditemukan.' };

      var units = getMasterUnitValues_(masterBidang);
      for (var i = 0; i < units.length; i++) {
        if (units[i].bidangId === bidangId) {
          return {
            success: false,
            message: 'Bidang tidak dapat dihapus karena masih memiliki Unit Organisasi.',
          };
        }
      }

      var references = documentBidangReferences_(bidangId);
      if (references.target) {
        return {
          success: false,
          message: 'Bidang tidak dapat dihapus karena masih menjadi target Dokumen.',
        };
      }
      if (references.uploader) {
        return {
          success: false,
          message: 'Bidang tidak dapat dihapus karena masih menjadi snapshot Bidang pengunggah Dokumen.',
        };
      }

      var sheet = getMasterBidangSheet_();
      var header = sheet.getDataRange().getValues()[0] || [];
      var found = findMasterRow_(sheet, masterColumn_(header, 'BidangID'), bidangId);
      if (!found) return { success: false, message: 'Bidang tidak ditemukan.' };
      sheet.deleteRow(found.rowNumber);
      return { success: true, message: 'Bidang berhasil dihapus.' };
    });
  } catch (err) {
    return { success: false, message: 'Gagal menghapus Bidang: ' + err.toString() };
  }
}

function createMasterUnit_(token, name, bidangId) {
  var auth = requireCurrentAdmin_(token);
  if (auth.error) return auth.error;

  var trimmed = (name === null || name === undefined ? '' : String(name)).trim();
  if (!trimmed) return { success: false, message: 'Nama Unit wajib diisi.' };
  var parentId = Number(bidangId);
  if (!Number.isInteger(parentId) || parentId <= 0) {
    return { success: false, message: 'Bidang induk harus dipilih dari MasterBidang.' };
  }

  try {
    return withMasterLock_(function () {
      var masterBidang = getMasterBidangValues_();
      var parent = masterBidangById_(parentId, masterBidang);
      if (!parent) {
        return { success: false, message: 'Bidang induk harus dipilih dari MasterBidang.' };
      }
      var existing = getMasterUnitValues_(masterBidang);
      var sheet = getMasterUnitSheet_();
      var header = sheet.getDataRange().getValues()[0] || [];
      var id = nextMasterId_('unit', existing.map(function (unit) { return unit.id; }));
      sheet.appendRow(masterRowForHeader_(header, { unitid: id, unit: trimmed, bidangid: parent.id }));
      return {
        success: true,
        message: 'Unit Organisasi berhasil ditambahkan.',
        data: { id: id, name: trimmed, bidangId: parent.id, bidang: parent.name },
      };
    });
  } catch (err) {
    return { success: false, message: 'Gagal menambahkan Unit: ' + err.toString() };
  }
}

function renameMasterUnit_(token, id, name) {
  var auth = requireCurrentAdmin_(token);
  if (auth.error) return auth.error;

  var trimmed = (name === null || name === undefined ? '' : String(name)).trim();
  if (!trimmed) return { success: false, message: 'Nama Unit wajib diisi.' };
  var unitId = Number(id);
  if (!Number.isInteger(unitId) || unitId <= 0) {
    return { success: false, message: 'Unit tidak ditemukan.' };
  }

  try {
    return withMasterLock_(function () {
      var masterBidang = getMasterBidangValues_();
      var masterUnit = getMasterUnitValues_(masterBidang);
      var target = masterUnitById_(unitId, masterUnit);
      if (!target) return { success: false, message: 'Unit tidak ditemukan.' };

      var sheet = getMasterUnitSheet_();
      var header = sheet.getDataRange().getValues()[0] || [];
      var found = findMasterRow_(sheet, masterColumn_(header, 'UnitID'), unitId);
      if (!found) return { success: false, message: 'Unit tidak ditemukan.' };
      sheet.getRange(found.rowNumber, masterColumn_(header, 'Unit') + 1).setValue(trimmed);
      return {
        success: true,
        message: 'Nama Unit berhasil diperbarui.',
        data: {
          id: target.id,
          name: trimmed,
          bidangId: target.bidangId,
          bidang: target.bidang,
        },
      };
    });
  } catch (err) {
    return { success: false, message: 'Gagal memperbarui Unit: ' + err.toString() };
  }
}

function reparentMasterUnit_(token, id, bidangId) {
  var auth = requireCurrentAdmin_(token);
  if (auth.error) return auth.error;

  var unitId = Number(id);
  if (!Number.isInteger(unitId) || unitId <= 0) {
    return { success: false, message: 'Unit tidak ditemukan.' };
  }
  var parentId = Number(bidangId);
  if (!Number.isInteger(parentId) || parentId <= 0) {
    return { success: false, message: 'Bidang induk harus dipilih dari MasterBidang.' };
  }

  try {
    return withMasterLock_(function () {
      var masterBidang = getMasterBidangValues_();
      var parent = masterBidangById_(parentId, masterBidang);
      if (!parent) {
        return { success: false, message: 'Bidang induk harus dipilih dari MasterBidang.' };
      }
      var masterUnit = getMasterUnitValues_(masterBidang);
      var target = masterUnitById_(unitId, masterUnit);
      if (!target) return { success: false, message: 'Unit tidak ditemukan.' };

      var sheet = getMasterUnitSheet_();
      var header = sheet.getDataRange().getValues()[0] || [];
      var found = findMasterRow_(sheet, masterColumn_(header, 'UnitID'), unitId);
      if (!found) return { success: false, message: 'Unit tidak ditemukan.' };
      sheet.getRange(found.rowNumber, masterColumn_(header, 'BidangID') + 1).setValue(parent.id);
      return {
        success: true,
        message: 'Bidang induk Unit berhasil diperbarui.',
        data: {
          id: target.id,
          name: target.name,
          bidangId: parent.id,
          bidang: parent.name,
        },
      };
    });
  } catch (err) {
    return { success: false, message: 'Gagal memperbarui Bidang induk Unit: ' + err.toString() };
  }
}

function deleteMasterUnit_(token, id) {
  var auth = requireCurrentAdmin_(token);
  if (auth.error) return auth.error;

  var unitId = Number(id);
  if (!Number.isInteger(unitId) || unitId <= 0) {
    return { success: false, message: 'Unit tidak ditemukan.' };
  }

  try {
    return withMasterLock_(function () {
      var masterBidang = getMasterBidangValues_();
      var target = masterUnitById_(unitId, getMasterUnitValues_(masterBidang));
      if (!target) return { success: false, message: 'Unit tidak ditemukan.' };
      if (unitHasUserReference_(unitId)) {
        return {
          success: false,
          message: 'Unit tidak dapat dihapus karena masih digunakan oleh User.',
        };
      }

      var sheet = getMasterUnitSheet_();
      var header = sheet.getDataRange().getValues()[0] || [];
      var found = findMasterRow_(sheet, masterColumn_(header, 'UnitID'), unitId);
      if (!found) return { success: false, message: 'Unit tidak ditemukan.' };
      sheet.deleteRow(found.rowNumber);
      return { success: true, message: 'Unit Organisasi berhasil dihapus.' };
    });
  } catch (err) {
    return { success: false, message: 'Gagal menghapus Unit: ' + err.toString() };
  }
}

function getMasterBidang() { return getMasterBidang_.apply(this, arguments); }
function getMasterUnit() { return getMasterUnit_.apply(this, arguments); }
function createMasterBidang() { return createMasterBidang_.apply(this, arguments); }
function renameMasterBidang() { return renameMasterBidang_.apply(this, arguments); }
function deleteMasterBidang() { return deleteMasterBidang_.apply(this, arguments); }
function createMasterUnit() { return createMasterUnit_.apply(this, arguments); }
function renameMasterUnit() { return renameMasterUnit_.apply(this, arguments); }
function reparentMasterUnit() { return reparentMasterUnit_.apply(this, arguments); }
function deleteMasterUnit() { return deleteMasterUnit_.apply(this, arguments); }

