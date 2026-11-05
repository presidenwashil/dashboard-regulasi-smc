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

function normalizeUnitTargets_(value, masterUnit) {
  var targets = documentBidangList_(value);
  var canonical = [];
  for (var i = 0; i < targets.length; i++) {
    var unit = masterUnitById_(targets[i], masterUnit);
    if (!unit) return null;
    if (!canonical.some(function (current) { return current.id === unit.id; })) canonical.push(unit);
  }
  return canonical;
}

function isValidCurrentBidang_(actor, master) {
  return Boolean(masterBidangById_(actor.bidangId, master));
}

function canReadDocument_(row, actor, master, masterUnit) {
  if (!actor || actor.status !== 'Approved') return false;
  if (actor.role === 'Admin') return true;

  if (!masterUnit) masterUnit = getMasterUnitValues_(master);

  // Bidang targets: column 17 (hydrated from DocBidang) + legacy text column 6.
  var rawBidangTargetIds = row[17] === null || row[17] === undefined ? '' : String(row[17]).trim();
  var rawLegacyBidang = row[6] === null || row[6] === undefined ? '' : String(row[6]).trim();
  var bidangIdTargets = documentBidangList_(rawBidangTargetIds);
  var validBidangIdTargets = bidangIdTargets.map(function (target) { return masterBidangById_(target, master); }).filter(Boolean);
  var legacyBidangNames = documentBidangList_(rawLegacyBidang);
  var validLegacyBidangTargets = legacyBidangNames.filter(function (name) {
    return master.some(function (bidang) { return normalizeBidangKey_(bidang.name) === normalizeBidangKey_(name); });
  });
  // Garbage handling: raw non-empty counts as "has targets" even if all entries invalid.
  var hasBidangTargets = (validBidangIdTargets.length > 0) || (validLegacyBidangTargets.length > 0) ||
    (rawBidangTargetIds !== '' && rawBidangTargetIds !== '-') ||
    (rawLegacyBidang !== '' && rawLegacyBidang !== '-');

  var bidangTargets = validBidangIdTargets.length > 0 ? validBidangIdTargets : legacyBidangNames.map(function (name) {
    for (var i = 0; i < master.length; i++) {
      if (normalizeBidangKey_(master[i].name) === normalizeBidangKey_(name)) return master[i];
    }
    return null;
  }).filter(Boolean);

  // Unit targets: transport index 19 (hydrated from DocUnit).
  var rawUnitTargetIds = (row.length > 19 && row[19] !== null && row[19] !== undefined) ? String(row[19]).trim() : '';
  var unitIdTargets = documentBidangList_(rawUnitTargetIds);
  var validUnitIdTargets = unitIdTargets.map(function (target) { return masterUnitById_(target, masterUnit); }).filter(Boolean);
  var hasUnitTargets = (validUnitIdTargets.length > 0) ||
    (rawUnitTargetIds !== '' && rawUnitTargetIds !== '-');

  var hasTargets = hasBidangTargets || hasUnitTargets;
  // Empty targets on both axes => public to all Approved Users.
  if (!hasTargets) return true;

  var bidangMatch = false;
  if (hasBidangTargets && isValidCurrentBidang_(actor, master)) {
    bidangMatch = bidangTargets.some(function (bidang) {
      return bidang.id === Number(actor.bidangId);
    });
  }

  var unitMatch = false;
  if (hasUnitTargets && actor.unitId !== null && actor.unitId !== undefined && actor.unitId !== '') {
    unitMatch = validUnitIdTargets.some(function (unit) {
      return unit.id === Number(actor.unitId);
    });
  }

  if (bidangMatch || unitMatch) return true;

  // Uploader snapshot branch.
  var uploaderBidangId = Number(row[18]);
  if (Number.isInteger(uploaderBidangId) && uploaderBidangId > 0 &&
      uploaderBidangId === Number(actor.bidangId)) return true;

  var uploaderUnitId = (row.length > 21 && row[21] !== null && row[21] !== undefined) ? String(row[21]).trim() : '';
  if (uploaderUnitId !== '' && uploaderUnitId !== '-') {
    var uploaderUnitNum = Number(uploaderUnitId);
    if (Number.isInteger(uploaderUnitNum) && uploaderUnitNum > 0 &&
        actor.unitId !== null && actor.unitId !== undefined && actor.unitId !== '' &&
        uploaderUnitNum === Number(actor.unitId)) return true;
  }

  var uploaderNrp = (row[15] === null || row[15] === undefined) ? '' : String(row[15]).trim();
  if (uploaderNrp !== '' && uploaderNrp === String(actor.nrp).trim()) return true;

  return false;
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