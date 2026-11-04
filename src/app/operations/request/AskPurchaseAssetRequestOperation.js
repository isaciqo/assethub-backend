const httpError = require('../../../lib/httpError');
const { formatAssetRequest } = require('../../../lib/formatters');

// O setor negou: quem pediu leva o pedido ao patrimônio, que decide se compra,
// se atende com outro bem parado ou se recusa.
class AskPurchaseAssetRequestOperation {
  constructor({ assetRequestService, assetRequestRepository }) {
    this.assetRequestService = assetRequestService;
    this.assetRequestRepository = assetRequestRepository;
  }

  async execute({ actor, request_id, note = '' }) {
    const request = await this.assetRequestService.load(request_id, actor);
    if (request.requested_by !== actor.user_id) throw httpError(403, 'Só quem pediu pode pedir a compra');
    if (request.status !== 'negada_setor') throw httpError(409, 'Só dá para pedir a compra depois que o setor nega o pedido');

    const saved = await this.assetRequestRepository.update(request_id, {
      status: 'aberta',
      handled_by: null,
      handled_by_name: '',
      $push: { history: this.assetRequestService.entry(actor, 'pedido_compra', note) },
    });
    return formatAssetRequest(saved);
  }
}

module.exports = AskPurchaseAssetRequestOperation;
