const httpError = require('../../../lib/httpError');
const { formatAsset } = require('../../../lib/formatters');

const EDITABLE = ['description', 'category', 'brand', 'serial_number', 'location', 'room', 'responsible_name', 'conservation_status', 'status', 'value', 'notes'];

class UpdateAssetOperation {
  constructor({ assetRepository, unitRepository, assetEventService }) {
    this.assetRepository = assetRepository;
    this.unitRepository = unitRepository;
    this.assetEventService = assetEventService;
  }

  async execute({ actor, asset_id, data }) {
    const asset = await this.assetRepository.findById(asset_id);
    if (!asset) throw httpError(404, 'Bem não encontrado');

    const changes = {};
    EDITABLE.forEach(field => {
      if (data[field] !== undefined && String(data[field] ?? '') !== String(asset[field] ?? '')) {
        changes[field] = { from: asset[field] ?? null, to: data[field] };
      }
    });
    if (!Object.keys(changes).length) return formatAsset(asset);

    const baixa = changes.status?.to === 'baixado';
    if (changes.status && asset.active_movement_id) throw httpError(409, 'Bem em movimentação: a situação muda quando a movimentação terminar');

    const update = Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.to]));
    const saved = await this.assetRepository.update(asset_id, update);
    if (update.location) await this.unitRepository.addLocations(saved.unit_id, [update.location]);

    await this.assetEventService.record({
      asset_id,
      event_type: baixa ? 'baixado' : 'editado',
      summary: baixa
        ? `Bem baixado (retirado do acervo)${data.notes ? ` — "${data.notes}"` : ''}`
        : `Ajuste no cadastro (${Object.keys(changes).length} campo(s))`,
      actor,
      reference_type: 'manual',
      changes,
    });
    return formatAsset(saved);
  }
}

module.exports = UpdateAssetOperation;
