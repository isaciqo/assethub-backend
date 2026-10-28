const httpError = require('../../../lib/httpError');
const { formatMovement } = require('../../../lib/formatters');

class CancelMovementOperation {
  constructor({ movementRepository, movementPolicyService, movementEventService, movementCompletionService }) {
    this.movementRepository = movementRepository;
    this.movementPolicyService = movementPolicyService;
    this.movementEventService = movementEventService;
    this.movementCompletionService = movementCompletionService;
  }

  async execute({ actor, movement_id, note }) {
    const movement = await this.movementRepository.findById(movement_id);
    if (!movement) throw httpError(404, 'Movimentação não encontrada');
    const { actedAs } = this.movementPolicyService.authorize(actor, movement, 'cancel');

    await this.movementRepository.update(movement_id, { status: 'cancelada' });
    await this.movementCompletionService.release(movement, actor, 'cancelada');
    await this.movementEventService.append({
      movement_id,
      event_type: 'cancelada',
      summary: `Movimentação cancelada: ${note}`,
      actor,
      acted_as: actedAs,
      details: { note },
    });
    return formatMovement(await this.movementRepository.findById(movement_id));
  }
}

module.exports = CancelMovementOperation;
