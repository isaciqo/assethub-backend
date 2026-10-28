const httpError = require('../../../lib/httpError');
const { formatMovement } = require('../../../lib/formatters');

class DecideApprovalOperation {
  constructor({ movementRepository, movementPolicyService, movementEventService, movementCompletionService }) {
    this.movementRepository = movementRepository;
    this.movementPolicyService = movementPolicyService;
    this.movementEventService = movementEventService;
    this.movementCompletionService = movementCompletionService;
  }

  async execute({ actor, movement_id, decision, note = '' }) {
    const movement = await this.movementRepository.findById(movement_id);
    if (!movement) throw httpError(404, 'Movimentação não encontrada');
    const { actedAs } = this.movementPolicyService.authorize(actor, movement, 'approve');
    if (decision === 'rejeitada' && !note.trim()) throw httpError(400, 'Informe o motivo da rejeição');

    // Admin decide no lugar do primeiro aprovador pendente.
    const target = this.movementPolicyService.pendingApproval(movement, actor) || movement.approvals.find(a => a.status === 'pendente');
    const approvals = movement.approvals.map(a => (a.user_id === target.user_id
      ? { user_id: a.user_id, status: decision, note, decided_at: new Date(), decided_by: actor.user_id }
      : a.toObject()));

    let status = movement.status;
    if (decision === 'rejeitada') status = 'rejeitada';
    else if (approvals.every(a => a.status === 'aprovada')) status = 'aprovada';

    await this.movementRepository.update(movement_id, { approvals, status });
    await this.movementEventService.append({
      movement_id,
      event_type: decision === 'aprovada' ? 'aprovacao' : 'rejeicao',
      summary: decision === 'aprovada'
        ? `Aprovação registrada (${approvals.filter(a => a.status === 'aprovada').length}/${approvals.length})`
        : `Movimentação rejeitada: ${note}`,
      actor,
      acted_as: actedAs,
      details: { approver_id: target.user_id, decision, note },
    });

    const saved = await this.movementRepository.findById(movement_id);
    if (status === 'rejeitada') await this.movementCompletionService.release(saved, actor, 'rejeitada');
    return formatMovement(saved);
  }
}

module.exports = DecideApprovalOperation;
