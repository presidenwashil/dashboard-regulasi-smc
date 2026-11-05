function getDocsSheet_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_DOCS);
  if (!sheet) {
    throw new Error('Sheet dokumen "' + CONFIG.SHEET_DOCS + '" tidak ditemukan. Periksa CONFIG.SHEET_DOCS di config/Config.gs.');
  }
  return sheet;
}

function buildDocRow_(timestamp, data, pdfUrl, wordUrl, statusBerlaku, uploaderNrp, uploaderBidang, targetBidangIds, uploaderBidangId, uploaderUnitId) {
  return [
    timestamp, data.judul, data.nomor, data.jenis, data.pemilik,
    data.unit, data.bidang, data.status, data.revisi, data.tanggal,
    pdfUrl, wordUrl, data.akreditasi, data.keterangan, statusBerlaku,
    uploaderNrp || '', uploaderBidang || '', targetBidangIds || '', uploaderBidangId || '', uploaderUnitId || ''
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
  var header = sheet.getRange(1, 16, 1, 5).getValues()[0];
  if (!header[0]) sheet.getRange(1, 16).setValue('UploaderNRP');
  if (!header[1]) sheet.getRange(1, 17).setValue('UploaderBidang');
  if (!header[2]) sheet.getRange(1, 18).setValue('BidangTargetIDs');
  if (!header[3]) sheet.getRange(1, 19).setValue('UploaderBidangID');
  if (!header[4]) sheet.getRange(1, 20).setValue('UploaderUnitID');
}
