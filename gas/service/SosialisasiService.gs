function getSosialisasiSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_SOSIALISASI);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_SOSIALISASI);
    sheet.appendRow(['Timestamp', 'NRP', 'Nama', 'DocRowIndex', 'JudulDokumen']);
  }
  return sheet;
}

function markDocumentRead_(token, docRowIndex, judulDokumen) {
  var auth = requireAccess_(token);
  if (auth.error) return auth.error;
  var actor = currentDocumentActor_(auth.session);
  if (!actor) return { success: false, message: 'Akses ditolak.' };

  try {
    var docs = getDocsSheet_().getDataRange().getValues();
    var docIndex = Number(docRowIndex);
    if (!Number.isInteger(docIndex) || docIndex < 2 || docIndex - 1 >= docs.length) {
      return { success: false, message: 'Dokumen tidak ditemukan.' };
    }
    var docRow = docs[docIndex - 1];
    while (docRow.length < 19) docRow.push('');
    if (!canReadDocument_(docRow, actor, getMasterBidangValues_())) {
      return { success: false, message: 'Akses ditolak.' };
    }

    var sheet = getSosialisasiSheet_();
    var rows = sheet.getDataRange().getValues();
    var sessionNrp = nrpDisplay_(actor.nrp);
    var sessionKey = nrpKey_(actor.nrp);
    for (var i = 1; i < rows.length; i++) {
      if (nrpKey_(rows[i][1]) === sessionKey && Number(rows[i][3]) === Number(docRowIndex)) {
        return { success: true, message: 'Dokumen sudah ditandai dibaca sebelumnya.' };
      }
    }
    sheet.appendRow([new Date(), sessionNrp, actor.nama, docRowIndex, docRow[1] || judulDokumen]);
    return { success: true, message: 'Dokumen ditandai sudah dibaca.' };
  } catch (err) {
    return { success: false, message: 'Gagal menandai dokumen: ' + err.toString() };
  }
}

function getMyReadDocs_(token) {
  var auth = requireAccess_(token);
  if (auth.error) return auth.error;
  var actor = currentDocumentActor_(auth.session);
  if (!actor) return { success: false, message: 'Akses ditolak.' };

  try {
    var rows = getSosialisasiSheet_().getDataRange().getValues();
    var docs = getDocsSheet_().getDataRange().getValues();
    var master = getMasterBidangValues_();
    var readDocs = [];
    var sessionKey = nrpKey_(actor.nrp);
    for (var i = 1; i < rows.length; i++) {
      if (nrpKey_(rows[i][1]) !== sessionKey) continue;
      var docIndex = Number(rows[i][3]);
      if (!Number.isInteger(docIndex) || docIndex < 2 || docIndex - 1 >= docs.length) continue;
      var docRow = docs[docIndex - 1];
      while (docRow.length < 19) docRow.push('');
      if (canReadDocument_(docRow, actor, master)) readDocs.push(docIndex);
    }
    return { success: true, data: readDocs };
  } catch (err) {
    return { success: false, message: 'Gagal mengambil status baca: ' + err.toString() };
  }
}

function getSosialisasiSummary_(token) {
  var auth = requireCurrentAdmin_(token);
  if (auth.error) return auth.error;

  try {
    var usersSheet = getUsersSheet_();
    var userRows = usersSheet.getDataRange().getValues();
    var masterBidang = getMasterBidangValues_();
    var approvedUsers = [];
    var displayByKey = {};
    for (var i = 1; i < userRows.length; i++) {
      if (userRows[i][8] === 'Approved') {
        var displayNrp = nrpDisplay_(userRows[i][5]);
        var organization = userOrganization_(userRows[i], usersSheet, masterBidang);
        approvedUsers.push({
          nrp: displayNrp,
          nama: userRows[i][1],
          bidang: organization ? organization.bidang : '',
          unit: organization ? organization.unit : ''
        });
        var userKey = nrpKey_(userRows[i][5]);
        if (!Object.prototype.hasOwnProperty.call(displayByKey, userKey)) {
          displayByKey[userKey] = displayNrp;
        }
      }
    }

    var readMap = {};
    var seenByDoc = {};
    var sosRows = getSosialisasiSheet_().getDataRange().getValues();
    for (var j = 1; j < sosRows.length; j++) {
      var docIdx = Number(sosRows[j][3]);
      var ts = sosRows[j][0];
      var sosKey = nrpKey_(sosRows[j][1]);
      if (!readMap[docIdx]) {
        readMap[docIdx] = {};
        seenByDoc[docIdx] = {};
      }
      if (Object.prototype.hasOwnProperty.call(seenByDoc[docIdx], sosKey)) continue;
      var emittedKey = Object.prototype.hasOwnProperty.call(displayByKey, sosKey)
        ? displayByKey[sosKey]
        : nrpDisplay_(sosRows[j][1]);
      seenByDoc[docIdx][sosKey] = emittedKey;
      readMap[docIdx][emittedKey] = toTimestamp_(ts);
    }

    return { success: true, totalUser: approvedUsers.length, approvedUsers: approvedUsers, readMap: readMap };
  } catch (err) {
    return { success: false, message: 'Gagal mengambil ringkasan: ' + err.toString() };
  }
}

function buildSosialisasiDetail_(docRowIndex) {
  var docRow = getDocsSheet_().getRange(docRowIndex, 1, 1, 15).getValues()[0];

  var approvedUsers = [];
  var usersSheet = getUsersSheet_();
  var userRows = usersSheet.getDataRange().getValues();
  var masterBidang = getMasterBidangValues_();
  for (var i = 1; i < userRows.length; i++) {
    if (userRows[i][8] === 'Approved') {
      var organization = userOrganization_(userRows[i], usersSheet, masterBidang);
      approvedUsers.push({
        nrp: nrpDisplay_(userRows[i][5]),
        nama: userRows[i][1],
        bidang: organization ? organization.bidang : '',
        unit: organization ? organization.unit : ''
      });
    }
  }

  var readMap = {};
  var sosRows = getSosialisasiSheet_().getDataRange().getValues();
  for (var j = 1; j < sosRows.length; j++) {
    if (Number(sosRows[j][3]) === Number(docRowIndex)) {
      var ts = sosRows[j][0];
      var sosKey = nrpKey_(sosRows[j][1]);
      if (!Object.prototype.hasOwnProperty.call(readMap, sosKey)) {
        readMap[sosKey] = toTimestamp_(ts);
      }
    }
  }

  var sudah = [], belum = [];
  approvedUsers.forEach(function (u) {
    var userKey = nrpKey_(u.nrp);
    if (Object.prototype.hasOwnProperty.call(readMap, userKey)) {
      sudah.push({ nama: u.nama, nrp: u.nrp, bidang: u.bidang, unit: u.unit, waktu: readMap[userKey] });
    } else {
      belum.push({ nama: u.nama, nrp: u.nrp, bidang: u.bidang, unit: u.unit });
    }
  });
  sudah.sort(function (a, b) { return b.waktu - a.waktu; });

  return { judul: docRow[1], nomor: docRow[2], totalUser: approvedUsers.length, sudah: sudah, belum: belum };
}

function getSosialisasiDetail_(token, docRowIndex) {
  var auth = requireCurrentAdmin_(token);
  if (auth.error) return auth.error;

  try {
    return { success: true, data: buildSosialisasiDetail_(docRowIndex) };
  } catch (err) {
    return { success: false, message: 'Gagal mengambil detail: ' + err.toString() };
  }
}

// Diagnostik baca-saja untuk pemilik sheet: tidak pernah menulis, menambah,
// atau menghapus baris. Duplikat = NRP kanonik yang sama pada Dokumen yang sama;
// pembaca yang sah membaca beberapa Dokumen berbeda bukan duplikat.
function listSosialisasiDuplicates_() {
  var result = [];

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(CONFIG.SHEET_SOSIALISASI);
    if (sheet) {
      var rows = sheet.getDataRange().getValues();
      var groups = {};
      var groupOrder = [];
      for (var i = 1; i < rows.length; i++) {
        var docRowIndex = Number(rows[i][3]);
        var groupKey = nrpKey_(rows[i][1]) + '|' + docRowIndex;
        if (!Object.prototype.hasOwnProperty.call(groups, groupKey)) {
          groups[groupKey] = { nrp: nrpDisplay_(rows[i][1]), docRowIndex: docRowIndex, count: 0, rows: [] };
          groupOrder.push(groupKey);
        }
        groups[groupKey].count += 1;
        groups[groupKey].rows.push({
          rowIndex: i + 1,
          timestamp: toTimestamp_(rows[i][0]),
          nama: rows[i][2],
          judul: rows[i][4]
        });
      }
      groupOrder.forEach(function (groupKey) {
        if (groups[groupKey].count > 1) result.push(groups[groupKey]);
      });
    }
  } catch (err) {
    Logger.log('listSosialisasiDuplicates gagal: ' + err.toString());
  }

  Logger.log(JSON.stringify(result));
  return result;
}
function generateSosialisasiPdf_(token, docRowIndex) {
  var auth = requireCurrentAdmin_(token);
  if (auth.error) return auth.error;

  try {
    var detail = buildSosialisasiDetail_(docRowIndex);
    var tz = Session.getScriptTimeZone();
    var fmt = function (millis) {
      return Utilities.formatDate(new Date(millis), tz, 'dd MMM yyyy, HH:mm');
    };

    var rowsSudah = detail.sudah.map(function (u, idx) {
      return '<tr><td>' + (idx + 1) + '</td><td>' + escapeHtml_(u.nama) + '</td><td>' + escapeHtml_(u.nrp) +
        '</td><td>' + escapeHtml_(u.bidang) + '</td><td>' + escapeHtml_(u.unit) + '</td><td>' + fmt(u.waktu) + '</td></tr>';
    }).join('');

    var totalRead = detail.sudah.length;
    var persen = detail.totalUser > 0 ? Math.round((totalRead / detail.totalUser) * 100) : 0;
    var tanggalCetak = Utilities.formatDate(new Date(), tz, 'dd MMM yyyy, HH:mm');

    var html = "<!DOCTYPE html><html><head><meta charset='UTF-8'><style>" +
      'body{font-family:Arial,sans-serif;padding:24px;color:#111;}' +
      'h1{font-size:16px;margin-bottom:4px;}' +
      '.subtitle{font-size:11px;color:#555;margin-bottom:16px;}' +
      '.meta{font-size:11px;margin-bottom:16px;line-height:1.6;}' +
      'table{width:100%;border-collapse:collapse;margin-bottom:24px;font-size:10px;}' +
      'th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;}' +
      'th{background:#f0f0f0;}' +
      '.section-title{font-size:12px;font-weight:bold;margin:16px 0 8px;}' +
      '</style></head><body>' +
      '<h1>Rekap Sosialisasi Dokumen</h1>' +
      "<div class='subtitle'>RS Samarinda Medika Citra</div>" +
      "<div class='meta'>Dokumen: <b>" + escapeHtml_(detail.judul) + '</b><br>Nomor: ' + escapeHtml_(detail.nomor || '-') +
      '<br>Dicetak: ' + tanggalCetak + '<br>Progres: ' + totalRead + ' / ' + detail.totalUser + ' karyawan (' + persen + '%)</div>' +
      "<div class='section-title'>Sudah Tersosialisasi (" + totalRead + ')</div>' +
      '<table><tr><th>No</th><th>Nama</th><th>NRP</th><th>Bidang</th><th>Unit</th><th>Waktu Baca</th></tr>' +
      (rowsSudah || "<tr><td colspan='6'>Belum ada</td></tr>") + '</table>' +
      '</body></html>';

    var pdfBlob = Utilities.newBlob(html, 'text/html', 'rekap.html').getAs('application/pdf');
    var safeName = detail.judul.replace(/[^a-zA-Z0-9]+/g, '_').substring(0, 50);

    return {
      success: true,
      base64: Utilities.base64Encode(pdfBlob.getBytes()),
      filename: 'Rekap-Sosialisasi-' + safeName + '.pdf'
    };
  } catch (err) {
    return { success: false, message: 'Gagal membuat PDF: ' + err.toString() };
  }
}

function markDocumentRead() { return markDocumentRead_.apply(this, arguments); }
function getMyReadDocs() { return getMyReadDocs_.apply(this, arguments); }
function getSosialisasiSummary() { return getSosialisasiSummary_.apply(this, arguments); }
function getSosialisasiDetail() { return getSosialisasiDetail_.apply(this, arguments); }
function generateSosialisasiPdf() { return generateSosialisasiPdf_.apply(this, arguments); }
function listSosialisasiDuplicates() { return listSosialisasiDuplicates_.apply(this, arguments); }

