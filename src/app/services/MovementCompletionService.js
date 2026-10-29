// Efeito de uma movimentação concluída (ou desfeita) sobre o cadastro dos bens.
// Usado pelo recebimento sem ocorrência e pelo tratamento de ocorrência.
class MovementCompletionService {
  constructor({ assetRepository, movementRepository, unitRepository, assetEventService, assetRequestRepository }) {
    this.assetRepository = assetRepository;
    this.movementRepository = movementRepository;
    this.unitRepository = unitRepository;
    this.assetEventService = assetEventService;
    this.assetRequestRepository = assetRequestRepository;
  }

  // Movimentação que atende uma solicitação de bem: quando todas as do pedido
  // concluem, ele vira "atendida"; se uma é cancelada/rejeitada/desfeita, ele
  // volta para análise, para o gestor escolher outro bem ou outra saída.
  async syncRequest(movement, outcome) {
    const request = await this.assetRequestRepository.findByMovement(movement.movement_id);
    if (!request || request.status !== 'em_atendimento') return;
    const entry = action => ({ at: new Date(), by: 'sistema', by_name: 'Sistema', action, note: `Movimentação ${movement.number}` });
    if (outcome === 'released') {
      await this.assetRequestRepository.update(request.request_id, {
        status: 'em_analise',
        $pull: { movement_ids: movement.movement_id },
        $push: { history: entry('movimentacao_encerrada') },
      });
      return;
    }
    const others = await Promise.all(request.movement_ids
      .filter(id => id !== movement.movement_id)
      .map(id => this.movementRepository.findById(id)));
    if (others.every(m => !m || m.status === 'concluida')) {
      await this.assetRequestRepository.update(request.request_id, { status: 'atendida', $push: { history: entry('atendida') } });
    }
  }

  async complete(movement, actor) {
    const assets = await this.assetRepository.findByIds(movement.asset_ids);
    const receiptCond = Object.fromEntries((movement.receipt?.conditions || []).map(c => [c.asset_id, c.condition]));
    const dest = movement.destination;

    for (const asset of assets) {
      const update = {
        unit_id: dest.unit_id,
        location: dest.location || asset.location,
        // Mudou de setor: a sala antiga não vale mais.
        room: dest.location && dest.location !== asset.location ? '' : asset.room,
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

    const saved = await this.movementRepository.update(movement.movement_id, { status: 'concluida', completed_at: new Date() });
    await this.syncRequest(movement, 'completed');
    return saved;
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
    await this.syncRequest(movement, 'released');
  }
}

module.exports = MovementCompletionService;
