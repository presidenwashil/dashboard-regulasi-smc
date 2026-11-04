function masterColumn_(header, name) {
  var key = String(name).trim().toLowerCase();
  for (var i = 0; i < header.length; i++) {
    if (String(header[i] || '').trim().toLowerCase() === key) return i;
  }
  return -1;
}

function masterNextColumn_(header) {
  var last = 0;
  for (var i = 0; i < header.length; i++) {
    if (String(header[i] || '').trim() !== '') last = i + 1;
  }
  return last + 1;
}

function masterRowColumn_(header, name, fallback) {
  var column = masterColumn_(header, name);
  return column >= 0 ? column : fallback;
}

function masterRowForHeader_(header, values) {
  var row = [];
  for (var i = 0; i < header.length; i++) {
    var key = String(header[i] || '').trim().toLowerCase();
    row.push(Object.prototype.hasOwnProperty.call(values, key) ? values[key] : '');
  }
  return row;
}

function findMasterRow_(sheet, idColumn, id) {
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (Number(rows[i][idColumn]) === id) {
      return { rowNumber: i + 1, values: rows[i] };
    }
  }
  return null;
}

function withMasterLock_(action) {
  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    return action();
  } finally {
    lock.releaseLock();
  }
}

function masterIdHighWaterKey_(kind) {
  return kind === 'bidang' ? 'MASTER_BIDANG_ID_HIGH_WATER' : 'MASTER_UNIT_ID_HIGH_WATER';
}

function nextMasterId_(kind, existingIds) {
  var properties = PropertiesService.getScriptProperties();
  var key = masterIdHighWaterKey_(kind);
  var stored = Number(properties.getProperty(key) || 0);
  var highest = Number.isInteger(stored) && stored > 0 ? stored : 0;
  for (var i = 0; i < existingIds.length; i++) {
    var id = Number(existingIds[i]);
    if (Number.isInteger(id) && id > highest) highest = id;
  }
  var next = highest + 1;
  properties.setProperty(key, String(next));
  return next;
}