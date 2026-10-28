const { MOVEMENT_TYPES } = require('../../../lib/constants');
const { formatMovement } = require('../../../lib/formatters');

class ListMovementsOperation {
  constructor({ movementRepository, assetRepository, movementPolicyService }) {
    this.movementRepository = movementRepository;
    this.assetRepository = assetRepository;
    this.movementPolicyService = movementPolicyService;
  }

  async execute({ actor, status, scope }) {
    const filter = {};
    if (status) filter.status = status;
    if (scope === 'mine') {
      filter.$or = [
        { requested_by: actor.user_id },
        { deliverer_id: actor.user_id },
        { receiver_id: actor.user_id },
        { 'approvals.user_id': actor.user_id },
      ];
    }
    let list = await this.movementRepository.find(filter);
    if (scope === 'waiting_me') list = list.filter(m => this.movementPolicyService.waitingOn(m).includes(actor.user_id));

    const assetIds = [...new Set(list.flatMap(m => m.asset_ids.slice(0, 3)))];
    const assets = await this.assetRepository.findByIds(assetIds);
    const assetMap = Object.fromEntries(assets.map(a => [a.asset_id, { code: a.code, description: a.description }]));

    return list.map(m => ({
      ...formatMovement(m),
      typeLabel: MOVEMENT_TYPES[m.type]?.label || m.type,
      assetsPreview: m.asset_ids.slice(0, 3).map(id => assetMap[id]).filter(Boolean),
      waitingOn: this.movementPolicyService.waitingOn(m),
      waitingOnMe: this.movementPolicyService.waitingOn(m).includes(actor.user_id),
    }));
  }
}

module.exports = ListMovementsOperation;
