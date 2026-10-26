function escapeHtml_(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function generateSosialisasiPdf(token, docRowIndex) {
  var auth = requireAccess_(token, 'Admin');
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