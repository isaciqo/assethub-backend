const { MOVEMENT_TYPES } = require('../../../lib/constants');
const { formatMovement } = require('../../../lib/formatters');

class ListMovementsOperation {
  constructor({ movementRepository, assetRepository, movementPolicyService }) {
    this.movementRepository = movementRepository;
    this.assetRepository = assetRepository;
    this.movementPolicyService = movementPolicyService;
  }

  async execute({ actor, status, scope, type, unit_id, location, person_id, from, to }) {
    const filter = {};
    const and = [];
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (scope === 'mine') {
      and.push({ $or: [
        { requested_by: actor.user_id },
        { deliverer_id: actor.user_id },
        { receiver_id: actor.user_id },
        { 'approvals.user_id': actor.user_id },
      ] });
    }
    // Comarca/setor valem tanto para a origem quanto para o destino.
    if (unit_id || location) {
      const place = side => ({
        ...(unit_id ? { [`${side}.unit_id`]: unit_id } : {}),
        ...(location ? { [`${side}.location`]: location } : {}),
      });
      and.push({ $or: [place('origin'), place('destination')] });
    }
    // Pessoa = quem envia ou quem recebe.
    if (person_id) and.push({ $or: [{ deliverer_id: person_id }, { receiver_id: person_id }] });
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      // "até" inclui o dia inteiro.
      if (to) filter.createdAt.$lt = new Date(new Date(to).getTime() + 24 * 60 * 60 * 1000);
    }
    if (and.length) filter.$and = and;
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
