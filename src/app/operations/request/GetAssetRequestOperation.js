const { formatAssetRequest } = require('../../../lib/formatters');

// Detalhe do pedido. A primeira vez que o gestor abre, ele passa para "em
// análise" — quem pediu vê que alguém já está olhando.
class GetAssetRequestOperation {
  constructor({ assetRequestService, assetRequestRepository, movementRepository, unitRepository, movementPolicyService }) {
    this.assetRequestService = assetRequestService;
    this.assetRequestRepository = assetRequestRepository;
    this.movementRepository = movementRepository;
    this.unitRepository = unitRepository;
    this.movementPolicyService = movementPolicyService;
  }

  async execute({ actor, request_id }) {
    let request = await this.assetRequestService.load(request_id, actor);
    if (request.status === 'aberta' && this.movementPolicyService.isManager(actor)) {
      request = await this.assetRequestRepository.update(request_id, {
        status: 'em_analise',
        handled_by: actor.user_id,
        handled_by_name: actor.name || '',
        $push: { history: this.assetRequestService.entry(actor, 'em_analise') },
      });
    }
    const [unit, movements] = await Promise.all([
      this.unitRepository.findById(request.unit_id),
      Promise.all(request.movement_ids.map(id => this.movementRepository.findById(id))),
    ]);
    return {
      ...formatAssetRequest(request),
      unitName: unit?.name || '',
      movements: movements.filter(Boolean).map(m => ({ id: m.movement_id, number: m.number, status: m.status, assetCount: m.asset_ids.length })),
    };
  }
}

module.exports = GetAssetRequestOperation;
