function getDocsSheet_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_DOCS);
  if (!sheet) {
    throw new Error('Sheet dokumen "' + CONFIG.SHEET_DOCS + '" tidak ditemukan. Periksa CONFIG.SHEET_DOCS di Code.gs.');
  }
  return sheet;
}

function buildDocRow_(timestamp, data, pdfUrl, wordUrl, statusBerlaku) {
  return [
    timestamp, data.judul, data.nomor, data.jenis, data.pemilik,
    data.unit, data.bidang, data.status, data.revisi, data.tanggal,
    pdfUrl, wordUrl, data.akreditasi, data.keterangan, statusBerlaku
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

function saveDataWithFiles(token, data) {
  var auth = requireAccess_(token);
  if (auth.error) return auth.error;

  try {
    var files;
    try {
      files = uploadDocFiles_(data, '', '');
    } catch (driveErr) {
      return { success: false, message: 'Gagal menyimpan file ke Drive. Pastikan izin akses benar. ' + driveErr.toString() };
    }

    getDocsSheet_().appendRow(buildDocRow_(new Date(), data, files.pdfUrl, files.wordUrl, data.statusBerlaku || 'Aktif'));
    return { success: true, message: 'Data dan File berhasil disimpan!' };
  } catch (error) {
    return { success: false, message: 'Error Spreadsheet: ' + error.toString() };
  }
}

function updateDataWithFiles(token, data, rowIndex) {
  var auth = requireAccess_(token);
  if (auth.error) return auth.error;

  try {
    var files;
    try {
      files = uploadDocFiles_(data, data.existingPdfUrl, data.existingWordUrl);
    } catch (driveErr) {
      return { success: false, message: 'Gagal mengupdate file ke Drive. ' + driveErr.toString() };
    }

    getDocsSheet_().getRange(rowIndex, 1, 1, 15).setValues([
      buildDocRow_(new Date(), data, files.pdfUrl, files.wordUrl, data.statusBerlaku)
    ]);
    return { success: true, message: 'Data berhasil diperbarui!' };
  } catch (error) {
    return { success: false, message: 'Error Update: ' + error.toString() };
  }
}

function getAllData(token) {
  var auth = requireAccess_(token);
  if (auth.error) throw new Error(auth.error.message);

  var data = getDocsSheet_().getDataRange().getValues();
  if (data.length <= 1) return [];

  var rows = data.slice(1);
  for (var i = 0; i < rows.length; i++) {
    while (rows[i].length < 15) rows[i].push('');
    if (rows[i][0] instanceof Date) rows[i][0] = rows[i][0].getTime();
    if (rows[i][9] instanceof Date) rows[i][9] = rows[i][9].getTime();
    if (!rows[i][14] && rows[i][1]) rows[i][14] = 'Aktif';
    rows[i][15] = i + 2;
  }
  rows.reverse();
  return rows;
}