function nrpKey_(value) {
  if (value === null || value === undefined) return '';
  var trimmed = String(value).trim();
  if (/^\d+$/.test(trimmed)) return trimmed.replace(/^0+(?=\d)/, '');
  return trimmed;
}

function nrpDisplay_(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function toTimestamp_(value) {
  if (value && typeof value.getTime === 'function') return value.getTime();
  return value;
}

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

function getMyReadDocs(token) {
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

function getSosialisasiSummary(token) {
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

function getSosialisasiDetail(token, docRowIndex) {
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
function listSosialisasiDuplicates() {
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