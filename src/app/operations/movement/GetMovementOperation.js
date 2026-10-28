const httpError = require('../../../lib/httpError');
const { MOVEMENT_TYPES } = require('../../../lib/constants');
const {
  formatMovement, formatMovementEvent, formatAsset, formatUnit, formatUser, formatEvidence,
} = require('../../../lib/formatters');

class GetMovementOperation {
  constructor({
    movementRepository, movementEventRepository, assetRepository, unitRepository, userRepository,
    evidenceRepository, hashChainService, movementPolicyService,
  }) {
    this.movementRepository = movementRepository;
    this.movementEventRepository = movementEventRepository;
    this.assetRepository = assetRepository;
    this.unitRepository = unitRepository;
    this.userRepository = userRepository;
    this.evidenceRepository = evidenceRepository;
    this.hashChainService = hashChainService;
    this.movementPolicyService = movementPolicyService;
  }

  async execute({ actor, movement_id }) {
    const movement = await this.movementRepository.findById(movement_id);
    if (!movement) throw httpError(404, 'Movimentação não encontrada');
    if (actor.role === 'servidor' && ![movement.deliverer_id, movement.receiver_id].includes(actor.user_id)) {
      throw httpError(403, 'Você não participa desta movimentação');
    }

    const userIds = [movement.requested_by, movement.deliverer_id, movement.receiver_id, ...movement.approvals.map(a => a.user_id)];
    const [events, assets, units, users, evidences] = await Promise.all([
      this.movementEventRepository.findByMovement(movement_id),
      this.assetRepository.findByIds(movement.asset_ids),
      this.unitRepository.findByIds([movement.origin.unit_id, movement.destination.unit_id]),
      this.userRepository.findByIds([...new Set(userIds)]),
      this.evidenceRepository.findMetaByOwner('movement', movement_id),
    ]);

    return {
      movement: { ...formatMovement(movement), typeLabel: MOVEMENT_TYPES[movement.type]?.label || movement.type },
      assets: assets.map(formatAsset),
      units: Object.fromEntries(units.map(u => [u.unit_id, formatUnit(u)])),
      users: Object.fromEntries(users.map(u => [u.user_id, formatUser(u)])),
      events: events.map(formatMovementEvent),
      evidences: evidences.map(formatEvidence),
      chain: this.hashChainService.verify(events),
      actions: this.movementPolicyService.availableActions(actor, movement),
      waitingOn: this.movementPolicyService.waitingOn(movement),
    };
  }
}

module.exports = GetMovementOperation;
