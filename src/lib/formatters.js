// Formato público das entidades na API. Nunca expõe _id, __v, senha nem o
// binário das evidências; datas saem como ISO.

const { sectorKind } = require('./sectors');

const iso = d => (d ? new Date(d).toISOString() : null);

function formatUser(u) {
  if (!u) return null;
  return {
    id: u.user_id,
    name: u.name,
    email: u.email,
    role: u.role,
    registration: u.registration || '',
    unitId: u.unit_id || null,
  };
}

function formatGeo(g) {
  if (!g || g.lat == null) return null;
  return { lat: g.lat, lng: g.lng, accuracy: g.accuracy ?? null, distanceM: g.distance_m ?? null, outsideUnit: !!g.outside_unit };
}

function formatUnit(u) {
  if (!u) return null;
  return {
    id: u.unit_id,
    name: u.name,
    code: u.code,
    city: u.city || '',
    kind: u.kind || (u.code === 'SEDE' ? 'sede' : 'comarca'),
    region: u.region,
    locations: [...(u.locations || [])].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    sectors: [...(u.locations || [])]
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
      .map(name => ({ name, kind: sectorKind(name) })),
    geo: u.geo?.lat != null ? { lat: u.geo.lat, lng: u.geo.lng } : null,
  };
}

function formatAsset(a) {
  if (!a) return null;
  return {
    id: a.asset_id,
    code: a.code,
    codeNormalized: a.code_normalized,
    description: a.description,
    category: a.category,
    brand: a.brand || '',
    serialNumber: a.serial_number || '',
    unitId: a.unit_id,
    location: a.location || '',
    room: a.room || '',
    responsibleName: a.responsible_name || '',
    conservationStatus: a.conservation_status,
    status: a.status,
    acquisitionDate: iso(a.acquisition_date),
    value: a.value ?? null,
    notes: a.notes || '',
    lastCheckedAt: iso(a.last_checked_at),
    lastInventoryId: a.last_inventory_id || null,
    activeMovementId: a.active_movement_id || null,
    createdAt: iso(a.createdAt),
    updatedAt: iso(a.updatedAt),
  };
}

function formatAssetEvent(e) {
  return {
    id: e.event_id,
    assetId: e.asset_id,
    type: e.event_type,
    summary: e.summary,
    performedBy: e.performed_by,
    performedByName: e.performed_by_name || '',
    referenceType: e.reference_type,
    referenceId: e.reference_id,
    changes: e.changes ?? null,
    occurredAt: iso(e.occurred_at),
  };
}

function formatInventory(inv, extra = {}) {
  return {
    id: inv.inventory_id,
    number: inv.number,
    name: inv.name,
    unitId: inv.unit_id,
    locations: inv.locations || [],
    status: inv.status,
    expectedCount: (inv.expected_asset_ids || []).length,
    startedAt: iso(inv.started_at),
    completedAt: iso(inv.completed_at),
    createdBy: inv.created_by,
    ...extra,
  };
}

function formatCheck(c) {
  return {
    id: c.check_id,
    operationId: c.operation_id,
    inventoryId: c.inventory_id,
    assetId: c.asset_id,
    assetCode: c.asset_code,
    observedLocation: c.observed_location || '',
    observedCondition: c.observed_condition,
    observedResponsible: c.observed_responsible || '',
    observedDescription: c.observed_description || '',
    notes: c.notes || '',
    photoEvidenceId: c.photo_evidence_id || null,
    status: c.check_status,
    isPrimary: c.is_primary,
    method: c.method,
    elapsedMs: c.elapsed_ms ?? null,
    checkedBy: c.checked_by,
    checkedByName: c.checked_by_name || '',
    checkedAt: iso(c.checked_at),
    syncedAt: iso(c.synced_at),
    wasOffline: !!c.was_offline,
    geo: formatGeo(c.geo),
  };
}

function formatDiscrepancy(d) {
  return {
    id: d.discrepancy_id,
    source: d.source || 'inventario',
    inventoryId: d.inventory_id,
    unitId: d.unit_id,
    assetId: d.asset_id,
    assetCode: d.asset_code,
    checkId: d.check_id,
    type: d.type,
    expected: d.expected ?? null,
    observed: d.observed ?? null,
    status: d.status,
    resolution: d.resolution?.action ? {
      action: d.resolution.action,
      note: d.resolution.note || '',
      resolvedBy: d.resolution.resolved_by,
      resolvedByName: d.resolution.resolved_by_name || '',
      resolvedAt: iso(d.resolution.resolved_at),
      movementId: d.resolution.movement_id || null,
    } : null,
    createdAt: iso(d.createdAt),
  };
}

function formatHandover(h) {
  if (!h || !h.at) return null;
  return {
    at: iso(h.at),
    by: h.by,
    byName: h.by_name || '',
    conditions: (h.conditions || []).map(c => ({ assetId: c.asset_id, condition: c.condition })),
    notes: h.notes || '',
    signatureEvidenceId: h.signature_evidence_id || null,
    signerName: h.signer_name || '',
    photoEvidenceIds: h.photo_evidence_ids || [],
    hasIssue: !!h.has_issue,
    issueDescription: h.issue_description || '',
    geo: formatGeo(h.geo),
  };
}

function formatPlace(p) {
  return { unitId: p.unit_id, location: p.location || '', responsibleName: p.responsible_name || '' };
}

function formatMovement(m) {
  return {
    id: m.movement_id,
    number: m.number,
    type: m.type,
    reason: m.reason,
    assetIds: m.asset_ids,
    origin: formatPlace(m.origin),
    destination: formatPlace(m.destination),
    requestedBy: m.requested_by,
    approvals: (m.approvals || []).map(a => ({
      userId: a.user_id,
      status: a.status,
      note: a.note || '',
      decidedAt: iso(a.decided_at),
      decidedBy: a.decided_by,
    })),
    delivererId: m.deliverer_id,
    receiverId: m.receiver_id,
    carrier: {
      company: m.carrier?.company || '',
      driverName: m.carrier?.driver_name || '',
      driverDocument: m.carrier?.driver_document || '',
      vehiclePlate: m.carrier?.vehicle_plate || '',
    },
    expectedDate: iso(m.expected_date),
    delivery: formatHandover(m.delivery),
    receipt: formatHandover(m.receipt),
    issueResolution: m.issue_resolution?.resolved_at ? {
      note: m.issue_resolution.note,
      resolvedBy: m.issue_resolution.resolved_by,
      resolvedAt: iso(m.issue_resolution.resolved_at),
    } : null,
    status: m.status,
    chainHead: m.chain_head,
    sourceDiscrepancyId: m.source_discrepancy_id || null,
    createdAt: iso(m.createdAt),
    completedAt: iso(m.completed_at),
  };
}

function formatMovementEvent(e) {
  return {
    id: e.event_id,
    seq: e.seq,
    type: e.event_type,
    summary: e.summary,
    performedBy: e.performed_by,
    performedByName: e.performed_by_name || '',
    actedAs: e.acted_as || '',
    details: e.details ?? null,
    occurredAt: iso(e.occurred_at),
    prevHash: e.prev_hash,
    hash: e.hash,
  };
}

function formatEvidence(e) {
  return {
    id: e.evidence_id,
    ownerType: e.owner_type,
    ownerId: e.owner_id,
    stage: e.stage || '',
    kind: e.kind,
    mime: e.mime,
    fileName: e.file_name || '',
    size: e.size,
    sha256: e.sha256,
    description: e.description || '',
    createdBy: e.created_by,
    createdByName: e.created_by_name || '',
    createdAt: iso(e.createdAt),
  };
}

function formatPossessionCheck(c) {
  if (!c) return null;
  const answered = c.items.filter(i => i.has_it !== null);
  return {
    id: c.check_id,
    number: c.number,
    userId: c.user_id,
    userName: c.user_name,
    requestedByName: c.requested_by_name || '',
    status: c.status,
    items: c.items.map(i => ({
      assetId: i.asset_id, code: i.code, description: i.description, location: i.location, hasIt: i.has_it, note: i.note || '',
    })),
    total: c.items.length,
    confirmed: answered.filter(i => i.has_it).length,
    missing: answered.filter(i => !i.has_it).length,
    answeredAt: iso(c.answered_at),
    createdAt: iso(c.createdAt),
  };
}

function formatAssetRequest(r) {
  if (!r) return null;
  return {
    id: r.request_id,
    number: r.number,
    requestedBy: r.requested_by,
    requestedByName: r.requested_by_name || '',
    unitId: r.unit_id,
    sector: r.sector || '',
    room: r.room || '',
    item: r.item,
    category: r.category || '',
    quantity: r.quantity,
    justification: r.justification,
    urgency: r.urgency,
    attachmentId: r.attachment_evidence_id || null,
    status: r.status,
    handledBy: r.handled_by || null,
    handledByName: r.handled_by_name || '',
    decisionNote: r.decision_note || '',
    movementIds: r.movement_ids || [],
    purchaseJustification: r.purchase_justification || '',
    history: (r.history || []).map(h => ({ at: iso(h.at), by: h.by, byName: h.by_name || '', action: h.action, note: h.note || '' })),
    createdAt: iso(r.createdAt),
    updatedAt: iso(r.updatedAt),
  };
}

module.exports = {
  formatAssetRequest,
  formatPossessionCheck,
  iso,
  formatUser,
  formatUnit,
  formatAsset,
  formatAssetEvent,
  formatInventory,
  formatCheck,
  formatDiscrepancy,
  formatMovement,
  formatMovementEvent,
  formatEvidence,
};
