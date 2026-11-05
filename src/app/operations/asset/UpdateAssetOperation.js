const httpError = require('../../../lib/httpError');
const { formatAsset } = require('../../../lib/formatters');

const EDITABLE = ['description', 'category', 'brand', 'serial_number', 'location', 'room', 'responsible_name', 'conservation_status', 'status', 'value', 'invoice_number', 'purchase_process', 'notes'];

class UpdateAssetOperation {
  constructor({ assetRepository, unitRepository, assetEventService, evidenceService }) {
    this.assetRepository = assetRepository;
    this.unitRepository = unitRepository;
    this.assetEventService = assetEventService;
    this.evidenceService = evidenceService;
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
    const attachments = data.attachments || [];
    if (!Object.keys(changes).length && !attachments.length) return formatAsset(asset);

    const baixa = changes.status?.to === 'baixado';
    if (changes.status && asset.active_movement_id) throw httpError(409, 'Bem em movimentação: a situação muda quando a movimentação terminar');

    // Documentos da baixa (boletim de ocorrência, laudo, termo de descarte…):
    // ficam com o bem, com hash, e entram no relatório do bem.
    const stage = baixa ? 'baixa' : changes.status?.to === 'nao_localizado' ? 'nao_localizado' : 'ajuste';
    const stored = [];
    for (const a of attachments) {
      stored.push(await this.evidenceService.store({
        dataUrl: a.data_url,
        owner_type: 'asset',
        owner_id: asset_id,
        stage,
        kind: a.data_url.startsWith('data:application/pdf') ? 'documento' : 'foto',
        actor,
        file_name: a.file_name || '',
        description: a.description || '',
      }));
    }
    const anexos = stored.length ? ` · ${stored.length} anexo(s): ${stored.map(e => e.file_name || e.kind).join(', ')}` : '';

    const update = Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.to]));
    const saved = Object.keys(update).length ? await this.assetRepository.update(asset_id, update) : asset;
    if (update.location) await this.unitRepository.addLocations(saved.unit_id, [update.location]);

    await this.assetEventService.record({
      asset_id,
      event_type: baixa ? 'baixado' : 'editado',
      summary: baixa
        ? `Bem baixado (retirado do acervo)${data.notes ? ` — "${data.notes}"` : ''}${anexos}`
        : Object.keys(changes).length
          ? `Ajuste no cadastro (${Object.keys(changes).length} campo(s))${anexos}`
          : `Documento anexado${anexos}`,
      actor,
      reference_type: 'manual',
      changes: Object.keys(changes).length ? changes : null,
    });
    return formatAsset(saved);
  }
}

module.exports = UpdateAssetOperation;
