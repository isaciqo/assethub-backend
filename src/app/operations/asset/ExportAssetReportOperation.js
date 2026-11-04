const httpError = require('../../../lib/httpError');
const { MOVEMENT_TYPES } = require('../../../lib/constants');
const ExportInventoryOperation = require('../inventory/ExportInventoryOperation');

const CHECK_RESULT = {
  ok: 'Sem divergência',
  divergente: 'Com divergência',
  outra_unidade: 'De outra comarca',
  nao_cadastrado: 'Não cadastrado',
  duplicada: 'Conferência duplicada',
};

// Relatório resumo do bem (PDF): como ele está hoje, o que está em aberto e
// o histórico — conferências, movimentações e linha do tempo — com a foto da
// última conferência que teve foto.
class ExportAssetReportOperation {
  constructor({
    assetRepository, unitRepository, assetEventRepository, inventoryCheckRepository, movementRepository,
    discrepancyRepository, inventoryRepository, evidenceRepository, pdfService,
  }) {
    this.assetRepository = assetRepository;
    this.unitRepository = unitRepository;
    this.assetEventRepository = assetEventRepository;
    this.inventoryCheckRepository = inventoryCheckRepository;
    this.movementRepository = movementRepository;
    this.discrepancyRepository = discrepancyRepository;
    this.inventoryRepository = inventoryRepository;
    this.evidenceRepository = evidenceRepository;
    this.pdfService = pdfService;
  }

  async execute({ asset_id }) {
    const asset = await this.assetRepository.findById(asset_id);
    if (!asset) throw httpError(404, 'Bem não encontrado');

    const [unit, events, checks, movements, discrepancies, units] = await Promise.all([
      this.unitRepository.findById(asset.unit_id),
      this.assetEventRepository.findByAsset(asset.asset_id),
      this.inventoryCheckRepository.findByAsset(asset.asset_id),
      this.movementRepository.findByAsset(asset.asset_id),
      this.discrepancyRepository.find({ asset_id: asset.asset_id }),
      this.unitRepository.findAll(),
    ]);
    const inventories = await Promise.all([...new Set(checks.map(c => c.inventory_id))].map(id => this.inventoryRepository.findById(id)));
    const invNumber = Object.fromEntries(inventories.filter(Boolean).map(i => [i.inventory_id, i.number]));
    const unitName = Object.fromEntries(units.map(u => [u.unit_id, u.name]));
    const place = (unit_id, location) => [unitName[unit_id] !== unit?.name ? unitName[unit_id] : '', location].filter(Boolean).join(' · ') || '—';

    // Foto da conferência mais recente que tem foto (as conferências vêm da mais nova para a mais antiga).
    let photo = null;
    const withPhoto = checks.find(c => c.photo_evidence_id);
    if (withPhoto) {
      const ev = await this.evidenceRepository.findById(withPhoto.photo_evidence_id);
      if (ev && /^image\/(jpe?g|png)$/.test(ev.mime)) photo = { data: ev.data, at: withPhoto.checked_at, by: withPhoto.checked_by_name };
    }

    const buffer = await this.pdfService.assetReport({
      asset,
      unit,
      lastCheck: checks[0] || null,
      photo,
      openDiscrepancies: discrepancies.filter(d => d.status === 'aberta').map(d => ({
        type: ExportInventoryOperation.DISCREPANCY_LABEL[d.type] || d.type,
        origin: invNumber[d.inventory_id] || (d.inventory_id ? 'Inventário' : 'Validação do servidor'),
        at: d.createdAt,
      })),
      checks: checks.slice(0, 12).map(c => ({
        at: c.checked_at,
        inventory: invNumber[c.inventory_id] || '—',
        by: c.checked_by_name || '—',
        location: c.observed_location || '—',
        condition: c.observed_condition,
        result: CHECK_RESULT[c.check_status] || c.check_status,
      })),
      totalChecks: checks.length,
      movements: movements.map(m => ({
        number: m.number,
        type: MOVEMENT_TYPES[m.type]?.label || m.type,
        route: `${place(m.origin.unit_id, m.origin.location)} » ${place(m.destination.unit_id, m.destination.location)}`,
        status: m.status,
        at: m.createdAt,
      })),
      events: events.slice(0, 30).map(e => ({ at: e.occurred_at, type: e.event_type, summary: e.summary, by: e.performed_by_name || '—' })),
      totalEvents: events.length,
    });
    return { buffer, mime: 'application/pdf', fileName: `bem-${asset.code}.pdf` };
  }
}

module.exports = ExportAssetReportOperation;
