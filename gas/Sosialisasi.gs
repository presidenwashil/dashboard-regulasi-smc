function getSosialisasiSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_SOSIALISASI);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_SOSIALISASI);
    sheet.appendRow(['Timestamp', 'NRP', 'Nama', 'DocRowIndex', 'JudulDokumen']);
  }
  return sheet;
}

function markDocumentRead(token, docRowIndex, judulDokumen) {
  var auth = requireAccess_(token);
  if (auth.error) return auth.error;
  var session = auth.session;

  try {
    var sheet = getSosialisasiSheet_();
    var rows = sheet.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][1] === session.nrp && Number(rows[i][3]) === Number(docRowIndex)) {
        return { success: true, message: 'Dokumen sudah ditandai dibaca sebelumnya.' };
      }
    }
    sheet.appendRow([new Date(), session.nrp, session.nama, docRowIndex, judulDokumen]);
    return { success: true, message: 'Dokumen ditandai sudah dibaca.' };
  } catch (err) {
    return { success: false, message: 'Gagal menandai dokumen: ' + err.toString() };
  }
}

function getMyReadDocs(token) {
  var auth = requireAccess_(token);
  if (auth.error) return auth.error;
  var session = auth.session;

  try {
    var rows = getSosialisasiSheet_().getDataRange().getValues();
    var readDocs = [];
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][1] === session.nrp) readDocs.push(Number(rows[i][3]));
    }
    return { success: true, data: readDocs };
  } catch (err) {
    return { success: false, message: 'Gagal mengambil status baca: ' + err.toString() };
  }
}

function getSosialisasiSummary(token) {
  var auth = requireAccess_(token, 'Admin');
  if (auth.error) return auth.error;

  try {
    var userRows = getUsersSheet_().getDataRange().getValues();
    var approvedUsers = [];
    for (var i = 1; i < userRows.length; i++) {
      if (userRows[i][8] === 'Approved') {
        approvedUsers.push({
          nrp: userRows[i][5],
          nama: userRows[i][1],
          bidang: userRows[i][3],
          unit: userRows[i][4]
        });
      }
    }

    var readMap = {};
    var sosRows = getSosialisasiSheet_().getDataRange().getValues();
    for (var j = 1; j < sosRows.length; j++) {
      var docIdx = Number(sosRows[j][3]);
      var ts = sosRows[j][0];
      if (!readMap[docIdx]) readMap[docIdx] = {};
      if (!Object.prototype.hasOwnProperty.call(readMap[docIdx], sosRows[j][1])) {
        readMap[docIdx][sosRows[j][1]] = (ts instanceof Date) ? ts.getTime() : ts;
      }
    }

    return { success: true, totalUser: approvedUsers.length, approvedUsers: approvedUsers, readMap: readMap };
  } catch (err) {
    return { success: false, message: 'Gagal mengambil ringkasan: ' + err.toString() };
  }
}

function buildSosialisasiDetail_(docRowIndex) {
  var docRow = getDocsSheet_().getRange(docRowIndex, 1, 1, 15).getValues()[0];

  var approvedUsers = [];
  var userRows = getUsersSheet_().getDataRange().getValues();
  for (var i = 1; i < userRows.length; i++) {
    if (userRows[i][8] === 'Approved') {
      approvedUsers.push({ nrp: userRows[i][5], nama: userRows[i][1], bidang: userRows[i][3], unit: userRows[i][4] });
    }
  }

  var readMap = {};
  var sosRows = getSosialisasiSheet_().getDataRange().getValues();
  for (var j = 1; j < sosRows.length; j++) {
    if (Number(sosRows[j][3]) === Number(docRowIndex)) {
      var ts = sosRows[j][0];
      if (!Object.prototype.hasOwnProperty.call(readMap, sosRows[j][1])) {
        readMap[sosRows[j][1]] = (ts instanceof Date) ? ts.getTime() : ts;
      }
    }
  }

  var sudah = [], belum = [];
  approvedUsers.forEach(function (u) {
    if (Object.prototype.hasOwnProperty.call(readMap, u.nrp)) {
      sudah.push({ nama: u.nama, nrp: u.nrp, bidang: u.bidang, unit: u.unit, waktu: readMap[u.nrp] });
    } else {
      belum.push({ nama: u.nama, nrp: u.nrp, bidang: u.bidang, unit: u.unit });
    }
  });
  sudah.sort(function (a, b) { return b.waktu - a.waktu; });

  return { judul: docRow[1], nomor: docRow[2], totalUser: approvedUsers.length, sudah: sudah, belum: belum };
}

function getSosialisasiDetail(token, docRowIndex) {
  var auth = requireAccess_(token, 'Admin');
  if (auth.error) return auth.error;

  try {
    return { success: true, data: buildSosialisasiDetail_(docRowIndex) };
  } catch (err) {
    return { success: false, message: 'Gagal mengambil detail: ' + err.toString() };
  }
}