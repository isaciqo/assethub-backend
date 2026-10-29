const httpError = require('../../../lib/httpError');
const { formatAssetRequest } = require('../../../lib/formatters');

// Não há bem para reaproveitar: o pedido segue para compra, FORA do sistema.
// Se existe bem parado parecido, comprar exige justificativa — é a regra
// "reaproveitar antes de comprar".
class ForwardAssetRequestToPurchaseOperation {
  constructor({ assetRequestService, assetRequestRepository, auditService }) {
    this.assetRequestService = assetRequestService;
    this.assetRequestRepository = assetRequestRepository;
    this.auditService = auditService;
  }

  async execute({ actor, request_id, purchase_justification = '' }) {
    const request = await this.assetRequestService.load(request_id, actor);
    this.assetRequestService.assertOpen(request);

    const available = await this.assetRequestService.availableFor(request);
    if (available.length && !purchase_justification.trim()) {
      throw httpError(400, `Existem ${available.length} bem(ns) disponível(is) parecido(s). Justifique a compra.`);
    }

    const saved = await this.assetRequestRepository.update(request_id, {
      status: 'encaminhada_compra',
      handled_by: actor.user_id,
      handled_by_name: actor.name || '',
      purchase_justification: purchase_justification.trim(),
      $push: { history: this.assetRequestService.entry(actor, 'encaminhada_compra', purchase_justification.trim()) },
    });
    await this.auditService.log({ actor_id: actor.user_id, action: 'request.purchase', resource_type: 'request', resource_id: request_id, metadata: { available: available.length } });
    return formatAssetRequest(saved);
  }
}

module.exports = ForwardAssetRequestToPurchaseOperation;
