const httpError = require('../../../lib/httpError');
const { formatMovement } = require('../../../lib/formatters');

class ConfirmReceiptOperation {
  constructor({ movementRepository, movementPolicyService, movementEventService, handoverService, movementCompletionService }) {
    this.movementRepository = movementRepository;
    this.movementPolicyService = movementPolicyService;
    this.movementEventService = movementEventService;
    this.handoverService = handoverService;
    this.movementCompletionService = movementCompletionService;
  }

  async execute({ actor, movement_id, input }) {
    const movement = await this.movementRepository.findById(movement_id);
    if (!movement) throw httpError(404, 'Movimentação não encontrada');
    const { actedAs } = this.movementPolicyService.authorize(actor, movement, 'receive');

    const { handover, evidenceHashes } = await this.handoverService.build({ actor, movement, stage: 'recebimento', input });

    // Bem que chegou pior do que saiu vira ocorrência automaticamente, mesmo que
    // quem recebeu não tenha marcado "houve problema".
    const delivered = Object.fromEntries((movement.delivery?.conditions || []).map(c => [c.asset_id, c.condition]));
    const worsened = handover.conditions.filter(c => this.movementPolicyService.worsened(delivered[c.asset_id], c.condition));
    if (worsened.length && !handover.has_issue) {
      handover.has_issue = true;
      handover.issue_description = `Estado de conservação piorou entre o envio e o recebimento em ${worsened.length} bem(ns)`;
    }
    if (handover.has_issue && !handover.issue_description) throw httpError(400, 'Descreva a ocorrência encontrada no recebimento');

    await this.movementRepository.update(movement_id, { receipt: handover, status: handover.has_issue ? 'com_pendencia' : 'em_transito' });
    await this.movementEventService.append({
      movement_id,
      event_type: handover.has_issue ? 'recebimento_com_ocorrencia' : 'recebimento',
      summary: handover.has_issue
        ? `Recebido com ocorrência: ${handover.issue_description}`
        : `Recebimento confirmado e assinado por ${handover.signer_name}`,
      actor,
      acted_as: actedAs,
      details: { conditions: handover.conditions, notes: handover.notes, issue: handover.issue_description, evidence: evidenceHashes },
    });

    const fresh = await this.movementRepository.findById(movement_id);
    if (!handover.has_issue) {
      await this.movementCompletionService.complete(fresh, actor);
      await this.movementEventService.append({
        movement_id,
        event_type: 'concluida',
        summary: 'Movimentação concluída — cadastro dos bens atualizado para o destino',
        actor,
        acted_as: 'sistema',
      });
    }
    return formatMovement(await this.movementRepository.findById(movement_id));
  }
}

module.exports = ConfirmReceiptOperation;
