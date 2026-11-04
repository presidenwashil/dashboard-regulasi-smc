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