const httpError = require('../../../lib/httpError');
const logger = require('../../../lib/logger');
const { DISCREPANCY_ACTIONS } = require('../../../lib/constants');
const { formatDiscrepancy } = require('../../../lib/formatters');

const NOTE_REQUIRED = new Set(['manter_cadastro', 'descartar', 'localizado_depois', 'marcar_nao_localizado']);

const ACTION_LABEL = {
  atualizar_cadastro: 'cadastro atualizado com o que foi encontrado em campo',
  manter_cadastro: 'cadastro mantido',
  marcar_nao_localizado: 'bem marcado como não localizado',
  localizado_depois: 'bem localizado posteriormente',
  descartar: 'pendência descartada',
  cadastrar_bem: 'bem cadastrado a partir da conferência',
  manter_primeira: 'mantida a primeira conferência',
  usar_esta: 'conferência repetida passou a valer',
};

class ResolveDiscrepancyOperation {
  constructor({
    discrepancyRepository, assetRepository, inventoryCheckRepository, inventoryRepository, unitRepository,
    assetEventService, createAssetOperation, discrepancyDetectionService, auditService,
  }) {
    this.discrepancyRepository = discrepancyRepository;
    this.assetRepository = assetRepository;
    this.inventoryCheckRepository = inventoryCheckRepository;
    this.inventoryRepository = inventoryRepository;
    this.unitRepository = unitRepository;
    this.assetEventService = assetEventService;
    this.createAssetOperation = createAssetOperation;
    this.discrepancyDetectionService = discrepancyDetectionService;
    this.auditService = auditService;
  }

  async execute({ actor, discrepancy_id, action, note = '', data = {} }) {
    const d = await this.discrepancyRepository.findById(discrepancy_id);
    if (!d) throw httpError(404, 'Pendência não encontrada');
    if (d.status === 'resolvida') throw httpError(409, 'Pendência já resolvida');
    if (!DISCREPANCY_ACTIONS[d.type]?.includes(action)) throw httpError(400, 'Ação não permitida para este tipo de pendência');
    if (action === 'abrir_movimentacao') throw httpError(400, 'Para regularizar por movimentação, abra a movimentação a partir da pendência');
    if (NOTE_REQUIRED.has(action) && !String(note).trim()) throw httpError(400, 'Informe uma justificativa para esta decisão');

    let changes = null;
    let assetId = d.asset_id;

    if (action === 'atualizar_cadastro') {
      const asset = await this.assetRepository.findById(d.asset_id);
      if (!asset) throw httpError(404, 'Bem não encontrado');
      const o = d.observed || {};
      const update = {};
      if (d.type === 'localizacao_divergente') update.location = o.location;
      if (d.type === 'outra_unidade') { update.unit_id = o.unit_id; update.location = o.location; }
      if (d.type === 'estado_alterado') update.conservation_status = o.condition;
      if (d.type === 'responsavel_divergente') update.responsible_name = o.responsible_name;
      changes = Object.fromEntries(Object.entries(update).map(([k, v]) => [k, { from: asset[k] ?? null, to: v }]));
      await this.assetRepository.update(asset.asset_id, update);
      if (update.location) await this.unitRepository.addLocations(update.unit_id || asset.unit_id, [update.location]);
    }

    if (action === 'marcar_nao_localizado') {
      await this.assetRepository.update(d.asset_id, { status: 'nao_localizado' });
      changes = { status: { from: 'ativo', to: 'nao_localizado' } };
    }

    if (action === 'localizado_depois') {
      const asset = await this.assetRepository.findById(d.asset_id);
      if (asset?.status === 'nao_localizado') await this.assetRepository.update(d.asset_id, { status: 'ativo' });
    }

    if (action === 'cadastrar_bem') {
      const o = d.observed || {};
      const created = await this.createAssetOperation.execute({
        actor,
        reference_type: 'discrepancy',
        reference_id: d.discrepancy_id,
        data: {
          code: d.asset_code,
          description: data.description || o.description || 'Bem sem descrição',
          category: data.category || 'Outros',
          unit_id: d.unit_id,
          location: data.location || o.location || '',
          responsible_name: data.responsible_name || '',
          conservation_status: data.conservation_status || o.condition || 'bom',
        },
      });
      assetId = created.id;
      if (d.check_id) await this.inventoryCheckRepository.update(d.check_id, { asset_id: created.id });
    }

    if (action === 'usar_esta') {
      const first = await this.inventoryCheckRepository.findById(d.expected?.check_id);
      const chosen = await this.inventoryCheckRepository.findById(d.check_id);
      if (!first || !chosen) throw httpError(404, 'Conferências envolvidas não encontradas');
      const [asset, inventory] = await Promise.all([
        chosen.asset_id ? this.assetRepository.findById(chosen.asset_id) : null,
        this.inventoryRepository.findById(chosen.inventory_id),
      ]);
      const { check_status } = this.discrepancyDetectionService.detect({
        asset,
        inventory,
        observed: { location: chosen.observed_location, condition: chosen.observed_condition, responsible: chosen.observed_responsible },
      });
      // Ordem importa: o índice único só admite uma primária por bem/inventário.
      await this.inventoryCheckRepository.update(first.check_id, { is_primary: false, check_status: 'duplicada' });
      await this.inventoryCheckRepository.update(chosen.check_id, { is_primary: true, check_status });
    }

    const resolved = await this.discrepancyRepository.update(discrepancy_id, {
      status: 'resolvida',
      resolution: {
        action,
        note,
        resolved_by: actor.user_id,
        resolved_by_name: actor.name || '',
        resolved_at: new Date(),
        movement_id: null,
      },
    });

    if (assetId) {
      await this.assetEventService.record({
        asset_id: assetId,
        event_type: 'pendencia_resolvida',
        summary: `Pendência resolvida: ${ACTION_LABEL[action]}${note ? ` — "${note}"` : ''}`,
        actor,
        reference_type: 'discrepancy',
        reference_id: discrepancy_id,
        changes,
      });
    }
    await this.auditService.log({ actor_id: actor.user_id, action: 'discrepancy.resolve', resource_type: 'discrepancy', resource_id: discrepancy_id, metadata: { type: d.type, action } });
    logger.info('discrepancy.resolve', { discrepancy_id, type: d.type, action });
    return formatDiscrepancy(resolved);
  }
}

module.exports = ResolveDiscrepancyOperation;
