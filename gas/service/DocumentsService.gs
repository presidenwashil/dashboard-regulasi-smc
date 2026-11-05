function getDocsSheet_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_DOCS);
  if (!sheet) {
    throw new Error('Sheet dokumen "' + CONFIG.SHEET_DOCS + '" tidak ditemukan. Periksa CONFIG.SHEET_DOCS di config/Config.gs.');
  }
  return sheet;
}

function buildDocRow_(timestamp, data, pdfUrl, wordUrl, statusBerlaku, uploaderNrp, uploaderBidang, targetBidangIds, uploaderBidangId) {
  return [
    timestamp, data.judul, data.nomor, data.jenis, data.pemilik,
    data.unit, data.bidang, data.status, data.revisi, data.tanggal,
    pdfUrl, wordUrl, data.akreditasi, data.keterangan, statusBerlaku,
    uploaderNrp || '', uploaderBidang || '', targetBidangIds || '', uploaderBidangId || ''
  ];
}

function uploadFile_(folder, file) {
  var blob = Utilities.newBlob(Utilities.base64Decode(file.data), file.mimeType, file.name);
  var saved = folder.createFile(blob);
  saved.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return saved.getUrl();
}

function uploadDocFiles_(data, fallbackPdf, fallbackWord) {
  var folder = DriveApp.getRootFolder();
  var pdfUrl = fallbackPdf || '';
  var wordUrl = fallbackWord || '';
  if (data.pdfFile && data.pdfFile.data) pdfUrl = uploadFile_(folder, data.pdfFile);
  if (data.wordFile && data.wordFile.data) wordUrl = uploadFile_(folder, data.wordFile);
  return { pdfUrl: pdfUrl, wordUrl: wordUrl };
}


function ensureDocMetadataHeaders_(sheet) {
  var header = sheet.getRange(1, 16, 1, 4).getValues()[0];
  if (header.length < 4) {
    Logger.log('Warning: Database_Regulasi metadata columns (16-19) appear shifted or removed; BidangTargetIDs at column 18 must remain in place.');
  }
  if (!header[0]) sheet.getRange(1, 16).setValue('UploaderNRP');
  if (!header[1]) sheet.getRange(1, 17).setValue('UploaderBidang');
  if (!header[2]) sheet.getRange(1, 18).setValue('BidangTargetIDs');
  if (!header[3]) sheet.getRange(1, 19).setValue('UploaderBidangID');
}

function saveDataWithFiles_(token, data) {
  var auth = requireAccess_(token);
  if (auth.error) return auth.error;

  try {
    var actor = currentDocumentActor_(auth.session);
    if (!actor) return { success: false, message: 'Akses ditolak.' };
    var master = getMasterBidangValues_();
    var uploaderBidang = masterBidangById_(actor.bidangId, master);
    if (!uploaderBidang) {
      return { success: false, message: 'Unit akun belum terpetakan ke Bidang. Hubungi Admin sebelum mengunggah dokumen.' };
    }
    var targets = normalizeDocumentTargets_(data.bidangIds, master);
    if (targets === null) {
      return { success: false, message: 'Tujuan Bidang/Komite harus dipilih dari ID MasterBidang yang valid.' };
    }
    data.bidang = targets.length ? targets.map(function (target) { return target.name; }).join(', ') : '-';
    var targetIds = targets.map(function (target) { return target.id; });
    var files;
    try {
      files = uploadDocFiles_(data, '', '');
    } catch (driveErr) {
      return { success: false, message: 'Gagal menyimpan file ke Drive. Pastikan izin akses benar. ' + driveErr.toString() };
    }

    var lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) {
      return { success: false, message: 'Sistem sedang sibuk, coba lagi.' };
    }
    try {
      var sheet = getDocsSheet_();
      ensureDocMetadataHeaders_(sheet);
      sheet.appendRow(buildDocRow_(
        new Date(), data, files.pdfUrl, files.wordUrl, data.statusBerlaku || 'Aktif',
        actor.nrp, uploaderBidang.name, '', uploaderBidang.id
      ));
      var newRowNumber = sheet.getLastRow();
      replaceTargetsForDoc_(newRowNumber, targetIds);
      return { success: true, message: 'Data dan File berhasil disimpan!' };
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return { success: false, message: 'Error Spreadsheet: ' + error.toString() };
  }
}

function updateDataWithFiles_(token, data, rowIndex) {
  var auth = requireAccess_(token);
  if (auth.error) return auth.error;

  try {
    var actor = currentDocumentActor_(auth.session);
    if (!actor) return { success: false, message: 'Akses ditolak.' };
    var sheet = getDocsSheet_();
    var rowNumber = Number(rowIndex);
    var allRows = sheet.getDataRange().getValues();
    if (!Number.isInteger(rowNumber) || rowNumber < 2 || rowNumber > allRows.length) {
      return { success: false, message: 'Dokumen tidak ditemukan.' };
    }
    var existing = allRows[rowNumber - 1];
    while (existing.length < 19) existing.push('');
    var master = getMasterBidangValues_();
    if (!canEditDocument_(existing, actor, master)) {
      return { success: false, message: 'Akses ditolak.' };
    }
    var isAdmin = actor.role === 'Admin';
    var adminTargetIds = null;
    if (isAdmin) {
      var targets = normalizeDocumentTargets_(data.bidangIds, master);
      if (targets === null) {
        return { success: false, message: 'Tujuan Bidang/Komite harus dipilih dari ID MasterBidang yang valid.' };
      }
      data.bidang = targets.length ? targets.map(function (target) { return target.name; }).join(', ') : '-';
      adminTargetIds = targets.map(function (target) { return target.id; });
    } else {
      data.bidang = existing[6] || '-';
    }
 
    var files;
    try {
      files = uploadDocFiles_(data, existing[10], existing[11]);
    } catch (driveErr) {
      return { success: false, message: 'Gagal mengupdate file ke Drive. ' + driveErr.toString() };
    }
 
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) {
      return { success: false, message: 'Sistem sedang sibuk, coba lagi.' };
    }
    try {
      ensureDocMetadataHeaders_(sheet);
      sheet.getRange(rowNumber, 1, 1, 19).setValues([
        buildDocRow_(
          new Date(), data, files.pdfUrl, files.wordUrl, data.statusBerlaku || existing[14] || 'Aktif',
          existing[15], existing[16], '', existing[18]
        )
      ]);
      if (isAdmin && adminTargetIds !== null) {
        replaceTargetsForDoc_(rowNumber, adminTargetIds);
      }
      return { success: true, message: 'Data berhasil diperbarui!' };
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return { success: false, message: 'Error Update: ' + error.toString() };
  }
}

function getAllData_(token) {
  var auth = requireAccess_(token);
  if (auth.error) throw new Error(auth.error.message);

  var actor = currentDocumentActor_(auth.session);
  if (!actor) return { success: false, message: 'Akses ditolak.' };
  var master = getMasterBidangValues_();
  var data = getDocsSheet_().getDataRange().getValues();
  if (data.length <= 1) return [];
 
  var junctionRows = getAllDocBidangRows_();
  var junctionMap = groupDocBidangByDoc_(junctionRows);
 
  var rows = data.slice(1);
  var visibleRows = [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    while (row.length < 19) row.push('');
    var docRowIndex = i + 2;
    // Hydrate column R from the junction when available; fall back to the
    // legacy comma-joined value for not-yet-migrated sheets.
    var junctionIds = junctionMap[docRowIndex];
    if (junctionIds && junctionIds.length > 0) {
      row[17] = junctionIds.join(',');
    }
    // row[17] keeps its legacy value otherwise
    if (!canReadDocument_(row, actor, master)) continue;
    var visible = row.slice(0, 15);
    if (visible[0] instanceof Date) visible[0] = visible[0].getTime();
    if (visible[9] instanceof Date) visible[9] = visible[9].getTime();
    if (!visible[14] && visible[1]) visible[14] = 'Aktif';
    visible[15] = docRowIndex;
    visible[16] = canEditDocument_(row, actor, master);
    visible[17] = row[17];
    visibleRows.push(visible);
  }
  visibleRows.reverse();
  return visibleRows;
}

function migrateDocTargetsToJunction_(token) {
  var auth = requireCurrentAdmin_(token);
  if (auth.error) return auth.error;

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return { success: false, message: 'Sistem sedang sibuk, coba lagi.' };
  }
  try {
    var docsSheet = getDocsSheet_();
    ensureDocMetadataHeaders_(docsSheet);
    var rows = docsSheet.getDataRange().getValues();
    if (rows.length <= 1) {
      return { success: true, migrated: 0, skippedAsDate: 0, alreadyMigrated: 0 };
    }

    var getDocBidangSheetFn = getDocBidangSheet_;
    var junctionSheet = getDocBidangSheetFn();
    var junctionRows = getAllDocBidangRows_();
    var junctionMap = groupDocBidangByDoc_(junctionRows);

    var migrated = 0;
    var skippedAsDate = 0;
    var alreadyMigrated = 0;
    var regex = /^\d+(,\s*\d+)*$/;

    for (var r = 1; r < rows.length; r++) {
      var docRowIndex = r + 1;
      var row = rows[r];
      while (row.length < 19) row.push('');

      if (junctionMap[docRowIndex] && junctionMap[docRowIndex].length > 0) {
        alreadyMigrated++;
        continue;
      }

      var raw = row[17];
      if (raw instanceof Date) {
        skippedAsDate++;
        Logger.log('migrateDocTargetsToJunction_: DocRowIndex ' + docRowIndex + ' BidangTargetIDs is a Date; manual re-entry required.');
        continue;
      }

      var text = (raw === null || raw === undefined) ? '' : String(raw).trim();
      if (!text) continue;
      if (!regex.test(text)) {
        Logger.log('migrateDocTargetsToJunction_: DocRowIndex ' + docRowIndex + ' has invalid format, skipped: ' + text);
        continue;
      }

      var ids = [];
      var parts = text.split(',');
      for (var p = 0; p < parts.length; p++) {
        var id = Number(parts[p].trim());
        if (Number.isInteger(id) && id > 0 && ids.indexOf(id) === -1) ids.push(id);
      }
      if (ids.length === 0) continue;

      replaceTargetsForDoc_(docRowIndex, ids);
      migrated++;
    }

    return { success: true, migrated: migrated, skippedAsDate: skippedAsDate, alreadyMigrated: alreadyMigrated };
  } catch (error) {
    return { success: false, message: 'Error migrasi: ' + error.toString() };
  } finally {
    lock.releaseLock();
  }
}

function saveDataWithFiles() { return saveDataWithFiles_.apply(this, arguments); }
function updateDataWithFiles() { return updateDataWithFiles_.apply(this, arguments); }
function getAllData() { return getAllData_.apply(this, arguments); }


