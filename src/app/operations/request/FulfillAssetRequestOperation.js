const httpError = require('../../../lib/httpError');
const { formatAssetRequest } = require('../../../lib/formatters');

// Atender com bem que já existe: o pedido vira movimentação — a mesma de
// sempre (aprovação, envio, recebimento, termo com QR). Nada de fluxo paralelo
// de transporte. Quando todas as movimentações concluem, o pedido fecha sozinho
// (MovementCompletionService).
class FulfillAssetRequestOperation {
  constructor({ assetRequestService, assetRequestRepository, assetRepository, userRepository, createMovementOperation }) {
    this.assetRequestService = assetRequestService;
    this.assetRequestRepository = assetRequestRepository;
    this.assetRepository = assetRepository;
    this.userRepository = userRepository;
    this.createMovementOperation = createMovementOperation;
  }

  async execute({ actor, request_id, asset_ids, deliverer_id, note = '' }) {
    const request = await this.assetRequestService.load(request_id, actor);
    this.assetRequestService.assertOpen(request);

    const assets = await this.assetRepository.findByIds([...new Set(asset_ids)]);
    if (assets.length !== new Set(asset_ids).size) throw httpError(404, 'Algum bem escolhido não foi encontrado');
    if (!await this.userRepository.findById(request.requested_by)) throw httpError(404, 'Quem pediu não está mais cadastrado');

    // Uma movimentação por comarca de origem (a movimentação exige origem única).
    const byUnit = assets.reduce((acc, a) => { (acc[a.unit_id] = acc[a.unit_id] || []).push(a); return acc; }, {});
    const movementIds = [];
    for (const [unit_id, group] of Object.entries(byUnit)) {
      const movement = await this.createMovementOperation.execute({
        actor,
        data: {
          type: unit_id === request.unit_id ? 'transferencia_interna' : 'transferencia_unidade',
          reason: `Atendimento da solicitação ${request.number}: ${request.item}`,
          asset_ids: group.map(a => a.asset_id),
          destination: { unit_id: request.unit_id, location: request.sector, responsible_name: request.requested_by_name },
          // O gestor que atende já aprova — a decisão de atender é a aprovação.
          approver_ids: [actor.user_id],
          deliverer_id: deliverer_id || actor.user_id,
          receiver_id: request.requested_by,
        },
      });
      movementIds.push(movement.id);
    }

    const saved = await this.assetRequestRepository.update(request_id, {
      status: 'em_atendimento',
      handled_by: actor.user_id,
      handled_by_name: actor.name || '',
      decision_note: note,
      $push: {
        movement_ids: { $each: movementIds },
        history: this.assetRequestService.entry(actor, 'atendimento', `${assets.length} bem(ns) disponível(is) — ${movementIds.length} movimentação(ões)`),
      },
    });
    return formatAssetRequest(saved);
  }
}

module.exports = FulfillAssetRequestOperation;
