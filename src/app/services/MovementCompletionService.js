// Efeito de uma movimentação concluída (ou desfeita) sobre o cadastro dos bens.
// Usado pelo recebimento sem ocorrência e pelo tratamento de ocorrência.
class MovementCompletionService {
  constructor({ assetRepository, movementRepository, unitRepository, assetEventService }) {
    this.assetRepository = assetRepository;
    this.movementRepository = movementRepository;
    this.unitRepository = unitRepository;
    this.assetEventService = assetEventService;
  }

  async complete(movement, actor) {
    const assets = await this.assetRepository.findByIds(movement.asset_ids);
    const receiptCond = Object.fromEntries((movement.receipt?.conditions || []).map(c => [c.asset_id, c.condition]));
    const dest = movement.destination;

    for (const asset of assets) {
      const update = {
        unit_id: dest.unit_id,
        location: dest.location || asset.location,
        responsible_name: dest.responsible_name || asset.responsible_name,
        conservation_status: receiptCond[asset.asset_id] || asset.conservation_status,
        status: 'ativo',
        active_movement_id: null,
      };
      const changes = {};
      ['unit_id', 'location', 'responsible_name', 'conservation_status'].forEach(k => {
        if (String(asset[k] ?? '') !== String(update[k] ?? '')) changes[k] = { from: asset[k], to: update[k] };
      });
      await this.assetRepository.update(asset.asset_id, update);
      await this.assetEventService.record({
        asset_id: asset.asset_id,
        event_type: 'movimentacao_concluida',
        summary: `Movimentação ${movement.number} concluída — bem recebido no destino`,
        actor,
        reference_type: 'movement',
        reference_id: movement.movement_id,
        changes,
      });
    }
    if (dest.location) await this.unitRepository.addLocations(dest.unit_id, [dest.location]);

    return this.movementRepository.update(movement.movement_id, { status: 'concluida', completed_at: new Date() });
  }

  async release(movement, actor, reason) {
    await this.assetRepository.updateMany(movement.asset_ids, { status: 'ativo', active_movement_id: null });
    await this.assetEventService.recordMany(movement.asset_ids.map(asset_id => ({
      asset_id,
      event_type: 'movimentacao_encerrada',
      summary: `Movimentação ${movement.number} ${reason} — bem permanece na origem`,
      actor,
      reference_type: 'movement',
      reference_id: movement.movement_id,
    })));
  }
}

module.exports = MovementCompletionService;
