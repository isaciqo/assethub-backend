const httpError = require('../../../lib/httpError');
const { formatAssetRequest } = require('../../../lib/formatters');

// Só quem pediu desiste, e só enquanto ninguém decidiu.
class CancelAssetRequestOperation {
  constructor({ assetRequestService, assetRequestRepository }) {
    this.assetRequestService = assetRequestService;
    this.assetRequestRepository = assetRequestRepository;
  }

  async execute({ actor, request_id }) {
    const request = await this.assetRequestService.load(request_id, actor);
    if (request.requested_by !== actor.user_id) throw httpError(403, 'Só quem pediu pode cancelar');
    this.assetRequestService.assertOpen(request);

    const saved = await this.assetRequestRepository.update(request_id, {
      status: 'cancelada',
      $push: { history: this.assetRequestService.entry(actor, 'cancelada') },
    });
    return formatAssetRequest(saved);
  }
}

module.exports = CancelAssetRequestOperation;
