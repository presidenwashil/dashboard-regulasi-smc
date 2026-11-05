function normalizeBidangKey_(value) {
  return (value === null || value === undefined ? '' : String(value)).trim().toLowerCase();
}

function masterBidangById_(value, master) {
  var id = Number(value);
  if (!Number.isInteger(id) || id <= 0) return null;
  for (var i = 0; i < master.length; i++) {
    if (master[i].id === id) return master[i];
  }
  return null;
}

function masterUnitById_(value, master) {
  var id = Number(value);
  if (!Number.isInteger(id) || id <= 0) return null;
  for (var i = 0; i < master.length; i++) {
    if (master[i].id === id) return master[i];
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
  var idTargets = documentBidangList_(rawTargetIds);
  var validIdTargets = idTargets.map(function (target) { return masterBidangById_(target, master); }).filter(Boolean);
  var legacyNames = documentBidangList_(rawLegacyTargets);
  var validLegacyTargets = legacyNames.filter(function (name) {
    return master.some(function (bidang) { return normalizeBidangKey_(bidang.name) === normalizeBidangKey_(name); });
  });
  var hasTargets = (validIdTargets.length > 0) || (validLegacyTargets.length > 0) ||
    (rawLegacyTargets && rawLegacyTargets !== '-' && rawLegacyTargets !== '');
  if (!hasTargets) return true;

  var targets = validIdTargets.length > 0 ? validIdTargets : legacyNames.map(function (name) {
    for (var i = 0; i < master.length; i++) {
      if (normalizeBidangKey_(master[i].name) === normalizeBidangKey_(name)) return master[i];
    }
    return null;
  }).filter(Boolean);
  var hasGeneralTarget = targets.some(function (bidang) {
    return normalizeBidangKey_(bidang.name) === 'umum';
  });
  if (hasGeneralTarget) return true;
  if (!isValidCurrentBidang_(actor, master)) return false;

  var matchesTarget = targets.some(function (bidang) {
    return bidang.id === Number(actor.bidangId);
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

function masterIdList_(value) {
  var text = value === null || value === undefined ? '' : String(value).trim();
  if (!text || text === '-') return [];
  return text.split(',').map(function (entry) {
    return entry.trim();
  }).filter(Boolean);
}