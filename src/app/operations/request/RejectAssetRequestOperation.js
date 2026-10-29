const httpError = require('../../../lib/httpError');
const { formatAssetRequest } = require('../../../lib/formatters');

class RejectAssetRequestOperation {
  constructor({ assetRequestService, assetRequestRepository }) {
    this.assetRequestService = assetRequestService;
    this.assetRequestRepository = assetRequestRepository;
  }

  async execute({ actor, request_id, reason }) {
    if (!String(reason || '').trim()) throw httpError(400, 'Informe o motivo da recusa');
    const request = await this.assetRequestService.load(request_id, actor);
    this.assetRequestService.assertOpen(request);

    const saved = await this.assetRequestRepository.update(request_id, {
      status: 'recusada',
      handled_by: actor.user_id,
      handled_by_name: actor.name || '',
      decision_note: reason.trim(),
      $push: { history: this.assetRequestService.entry(actor, 'recusada', reason.trim()) },
    });
    return formatAssetRequest(saved);
  }
}

module.exports = RejectAssetRequestOperation;
