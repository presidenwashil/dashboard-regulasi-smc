function getDocsSheet_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_DOCS);
  if (!sheet) {
    throw new Error('Sheet dokumen "' + CONFIG.SHEET_DOCS + '" tidak ditemukan. Periksa CONFIG.SHEET_DOCS di Code.gs.');
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

function currentDocumentActor_(session) {
  var nrp = (session.nrp || '').toString().trim();
  var sheet = getUsersSheet_();
  var rows = sheet.getDataRange().getValues();
  var unitIdColumn = ensureUsersUnitIdColumn_(sheet);
  var masterBidang = getMasterBidangValues_();
  for (var i = 1; i < rows.length; i++) {
    if ((rows[i][5] || '').toString().trim() !== nrp) continue;
    if (rows[i][8] !== 'Approved') return null;
    var organization = userOrganizationByUnitId_(rows[i][unitIdColumn - 1], masterBidang);
    return {
      nrp: nrp,
      nama: rows[i][1],
      bidang: organization ? organization.bidang : '',
      bidangId: organization ? organization.bidangId : null,
      unit: organization ? organization.unit : '',
      unitId: organization ? organization.unitId : null,
      status: rows[i][8],
      role: (rows[i][9] || '').toString(),
    };
  }
  return null;
}

function documentBidangList_(value) {
  if (Array.isArray(value)) {
    return value.map(function (entry) { return (entry || '').toString().trim(); }).filter(Boolean);
  }
  var text = value === null || value === undefined ? '' : String(value).trim();
  if (!text || text === '-') return [];
  return text.split(',').map(function (entry) { return entry.trim(); }).filter(Boolean);
}

function normalizeDocumentTargets_(value, master) {
  var targets = documentBidangList_(value);
  var canonical = [];
  for (var i = 0; i < targets.length; i++) {
    var bidang = masterBidangById_(targets[i], master);
    if (!bidang) return null;
    if (!canonical.some(function (current) { return current.id === bidang.id; })) canonical.push(bidang);
  }
  return canonical;
}

function isValidCurrentBidang_(actor, master) {
  return Boolean(masterBidangById_(actor.bidangId, master));
}

function canReadDocument_(row, actor, master) {
  if (!actor || actor.status !== 'Approved') return false;
  if (actor.role === 'Admin') return true;

  var rawTargetIds = row[17] === null || row[17] === undefined ? '' : String(row[17]).trim();
  var rawLegacyTargets = row[6] === null || row[6] === undefined ? '' : String(row[6]).trim();
  var hasTargets = (rawTargetIds && rawTargetIds !== '-') ||
    (rawLegacyTargets && rawLegacyTargets !== '-');
  if (!hasTargets) return true;

  var targets = documentBidangList_(rawTargetIds);
  var hasGeneralTarget = targets.some(function (target) {
    var bidang = masterBidangById_(target, master);
    return Boolean(bidang) && normalizeBidangKey_(bidang.name) === 'umum';
  });
  if (hasGeneralTarget) return true;
  if (!isValidCurrentBidang_(actor, master)) return false;

  var matchesTarget = targets.some(function (target) {
    var bidang = masterBidangById_(target, master);
    return Boolean(bidang) && bidang.id === Number(actor.bidangId);
  });
  var uploaderBidangId = Number(row[18]);
  return matchesTarget || (
    Number.isInteger(uploaderBidangId) &&
    uploaderBidangId > 0 &&
    uploaderBidangId === Number(actor.bidangId)
  );
}

function canEditDocument_(row, actor, master) {
  if (!actor || actor.status !== 'Approved') return false;
  if (actor.role === 'Admin') return true;
  return (row[15] || '').toString().trim() === actor.nrp &&
    canReadDocument_(row, actor, master);
}

function ensureDocMetadataHeaders_(sheet) {
  var header = sheet.getRange(1, 16, 1, 4).getValues()[0];
  if (!header[0]) sheet.getRange(1, 16).setValue('UploaderNRP');
  if (!header[1]) sheet.getRange(1, 17).setValue('UploaderBidang');
  if (!header[2]) sheet.getRange(1, 18).setValue('BidangTargetIDs');
  if (!header[3]) sheet.getRange(1, 19).setValue('UploaderBidangID');
}

function saveDataWithFiles(token, data) {
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
    var targetBidangIds = targets.map(function (target) { return target.id; }).join(',');
    var files;
    try {
      files = uploadDocFiles_(data, '', '');
    } catch (driveErr) {
      return { success: false, message: 'Gagal menyimpan file ke Drive. Pastikan izin akses benar. ' + driveErr.toString() };
    }

    var sheet = getDocsSheet_();
    ensureDocMetadataHeaders_(sheet);
    sheet.appendRow(buildDocRow_(
      new Date(), data, files.pdfUrl, files.wordUrl, data.statusBerlaku || 'Aktif',
      actor.nrp, uploaderBidang.name, targetBidangIds, uploaderBidang.id
    ));
    return { success: true, message: 'Data dan File berhasil disimpan!' };
  } catch (error) {
    return { success: false, message: 'Error Spreadsheet: ' + error.toString() };
  }
}

function updateDataWithFiles(token, data, rowIndex) {
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
    if (actor.role === 'Admin') {
      var targets = normalizeDocumentTargets_(data.bidangIds, master);
      if (targets === null) {
        return { success: false, message: 'Tujuan Bidang/Komite harus dipilih dari ID MasterBidang yang valid.' };
      }
      data.bidang = targets.length ? targets.map(function (target) { return target.name; }).join(', ') : '-';
      data.bidangIds = targets.map(function (target) { return target.id; }).join(',');
    } else {
      data.bidang = existing[6] || '-';
      data.bidangIds = existing[17] || '';
    }

    var files;
    try {
      files = uploadDocFiles_(data, existing[10], existing[11]);
    } catch (driveErr) {
      return { success: false, message: 'Gagal mengupdate file ke Drive. ' + driveErr.toString() };
    }

    ensureDocMetadataHeaders_(sheet);
    sheet.getRange(rowNumber, 1, 1, 19).setValues([
      buildDocRow_(
        new Date(), data, files.pdfUrl, files.wordUrl, data.statusBerlaku || existing[14] || 'Aktif',
        existing[15], existing[16], data.bidangIds, existing[18]
      )
    ]);
    return { success: true, message: 'Data berhasil diperbarui!' };
  } catch (error) {
    return { success: false, message: 'Error Update: ' + error.toString() };
  }
}

function getAllData(token) {
  var auth = requireAccess_(token);
  if (auth.error) throw new Error(auth.error.message);

  var actor = currentDocumentActor_(auth.session);
  if (!actor) return { success: false, message: 'Akses ditolak.' };
  var master = getMasterBidangValues_();
  var data = getDocsSheet_().getDataRange().getValues();
  if (data.length <= 1) return [];

  var rows = data.slice(1);
  var visibleRows = [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    while (row.length < 19) row.push('');
    if (!canReadDocument_(row, actor, master)) continue;
    var visible = row.slice(0, 15);
    if (visible[0] instanceof Date) visible[0] = visible[0].getTime();
    if (visible[9] instanceof Date) visible[9] = visible[9].getTime();
    if (!visible[14] && visible[1]) visible[14] = 'Aktif';
    visible[15] = i + 2;
    visible[16] = canEditDocument_(row, actor, master);
    visible[17] = row[17];
    visibleRows.push(visible);
  }
  visibleRows.reverse();
  return visibleRows;
}