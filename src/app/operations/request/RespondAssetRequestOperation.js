const httpError = require('../../../lib/httpError');
const { formatAssetRequest } = require('../../../lib/formatters');

// Resposta do responsável pelo setor a quem o pedido foi feito:
//   enviar → escolhe o(s) bem(ns) da lista dele; nasce a movimentação já
//            aprovada por ele (ele envia, quem pediu confirma o recebimento);
//   negar  → quem pediu é avisado e pode pedir a compra ao patrimônio.
class RespondAssetRequestOperation {
  constructor({ assetRequestService, assetRequestRepository, assetRepository, createMovementOperation, movementPolicyService }) {
    this.assetRequestService = assetRequestService;
    this.assetRequestRepository = assetRequestRepository;
    this.assetRepository = assetRepository;
    this.createMovementOperation = createMovementOperation;
    this.movementPolicyService = movementPolicyService;
  }

  async execute({ actor, request_id, decision, asset_ids = [], note = '' }) {
    const request = await this.assetRequestService.load(request_id, actor);
    if (!this.assetRequestService.isOwner(request, actor) && !this.movementPolicyService.isManager(actor)) {
      throw httpError(403, 'Só o responsável pelo setor responde a este pedido');
    }
    if (request.status !== 'aguardando_setor') throw httpError(409, 'Este pedido já foi respondido');

    if (decision === 'negar') {
      const saved = await this.assetRequestRepository.update(request_id, {
        status: 'negada_setor',
        handled_by: actor.user_id,
        handled_by_name: actor.name || '',
        decision_note: note,
        $push: { history: this.assetRequestService.entry(actor, 'negada_setor', note) },
      });
      return formatAssetRequest(saved);
    }

    const ids = [...new Set(asset_ids)];
    if (!ids.length) throw httpError(400, 'Escolha o bem que vai enviar');
    const assets = await this.assetRepository.findByIds(ids);
    if (assets.length !== ids.length) throw httpError(404, 'Algum bem escolhido não foi encontrado');

    // Uma movimentação por comarca de origem (a movimentação exige origem única).
    const byUnit = assets.reduce((acc, a) => { (acc[a.unit_id] = acc[a.unit_id] || []).push(a); return acc; }, {});
    const movementIds = [];
    for (const [unit_id, group] of Object.entries(byUnit)) {
      const movement = await this.createMovementOperation.execute({
        actor,
        data: {
          type: unit_id === request.unit_id ? 'transferencia_interna' : 'transferencia_unidade',
          reason: `Atendimento da solicitação ${request.number}: ${request.item}`,
          asset_ids: group.map(a => a.asset_id),
          destination: { unit_id: request.unit_id, location: request.sector, responsible_name: request.requested_by_name },
          // Quem responde pelo setor decidiu enviar: a decisão dele é a aprovação.
          approver_ids: [actor.user_id],
          self_approve: true,
          deliverer_id: actor.user_id,
          receiver_id: request.requested_by,
        },
      });
      movementIds.push(movement.id);
    }

    const saved = await this.assetRequestRepository.update(request_id, {
      status: 'em_atendimento',
      handled_by: actor.user_id,
      handled_by_name: actor.name || '',
      decision_note: note,
      $push: {
        movement_ids: { $each: movementIds },
        history: this.assetRequestService.entry(actor, 'enviada_setor', `${assets.map(a => a.code).join(', ')}${note ? ` — ${note}` : ''}`),
      },
    });
    return formatAssetRequest(saved);
  }
}

module.exports = RespondAssetRequestOperation;
