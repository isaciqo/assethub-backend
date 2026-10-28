const httpError = require('../../../lib/httpError');
const { formatMovement } = require('../../../lib/formatters');

// Ocorrência no recebimento (avaria, falta, divergência) nunca conclui sozinha:
// um gestor decide se a movimentação se conclui mesmo assim ou se é desfeita.
class ResolveMovementIssueOperation {
  constructor({ movementRepository, movementPolicyService, movementEventService, movementCompletionService }) {
    this.movementRepository = movementRepository;
    this.movementPolicyService = movementPolicyService;
    this.movementEventService = movementEventService;
    this.movementCompletionService = movementCompletionService;
  }

  async execute({ actor, movement_id, outcome, note }) {
    const movement = await this.movementRepository.findById(movement_id);
    if (!movement) throw httpError(404, 'Movimentação não encontrada');
    const { actedAs } = this.movementPolicyService.authorize(actor, movement, 'resolve_issue');

    await this.movementRepository.update(movement_id, {
      issue_resolution: { note, resolved_by: actor.user_id, resolved_at: new Date() },
    });
    const fresh = await this.movementRepository.findById(movement_id);

    if (outcome === 'concluir') {
      await this.movementCompletionService.complete(fresh, actor);
    } else {
      await this.movementCompletionService.release(fresh, actor, 'desfeita após ocorrência');
      await this.movementRepository.update(movement_id, { status: 'cancelada' });
    }

    await this.movementEventService.append({
      movement_id,
      event_type: outcome === 'concluir' ? 'ocorrencia_concluida' : 'ocorrencia_desfeita',
      summary: outcome === 'concluir'
        ? `Ocorrência tratada; movimentação concluída: ${note}`
        : `Ocorrência tratada; movimentação desfeita: ${note}`,
      actor,
      acted_as: actedAs,
      details: { outcome, note },
    });
    return formatMovement(await this.movementRepository.findById(movement_id));
  }
}

module.exports = ResolveMovementIssueOperation;
