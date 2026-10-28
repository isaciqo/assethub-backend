const { v4: uuidv4 } = require('uuid');
const httpError = require('../../../lib/httpError');
const logger = require('../../../lib/logger');
const { formatMovement } = require('../../../lib/formatters');

const common = values => {
  const set = [...new Set(values.filter(Boolean))];
  return set.length === 1 ? set[0] : set.length ? 'Diversos' : '';
};

class CreateMovementOperation {
  constructor({
    movementRepository, assetRepository, unitRepository, userRepository, discrepancyRepository,
    movementPolicyService, movementEventService, numberingService, assetEventService, auditService,
  }) {
    this.movementRepository = movementRepository;
    this.assetRepository = assetRepository;
    this.unitRepository = unitRepository;
    this.userRepository = userRepository;
    this.discrepancyRepository = discrepancyRepository;
    this.movementPolicyService = movementPolicyService;
    this.movementEventService = movementEventService;
    this.numberingService = numberingService;
    this.assetEventService = assetEventService;
    this.auditService = auditService;
  }

  async execute({ actor, data }) {
    const rule = this.movementPolicyService.rule(data.type);
    const approverIds = [...new Set(data.approver_ids || [])];
    if (approverIds.length < rule.minApprovals) {
      throw httpError(400, `"${rule.label}" exige pelo menos ${rule.minApprovals} aprovador(es)`);
    }
    if (rule.requiresCarrier && !data.carrier?.company) throw httpError(400, 'Informe a empresa transportadora');

    const assets = await this.assetRepository.findByIds([...new Set(data.asset_ids)]);
    if (assets.length !== new Set(data.asset_ids).size) throw httpError(404, 'Algum bem informado não foi encontrado');
    const blocked = assets.find(a => a.active_movement_id);
    if (blocked) throw httpError(409, `O bem ${blocked.code} já está em outra movimentação em andamento`);
    if (assets.some(a => a.status === 'baixado')) throw httpError(409, 'Bens baixados não podem ser movimentados');
    if (new Set(assets.map(a => a.unit_id)).size > 1) throw httpError(400, 'Todos os bens de uma movimentação precisam sair da mesma unidade');

    if (!await this.unitRepository.findById(data.destination.unit_id)) throw httpError(404, 'Unidade de destino não encontrada');
    const people = [...approverIds, data.deliverer_id, data.receiver_id];
    const found = await this.userRepository.findByIds([...new Set(people)]);
    if (found.length !== new Set(people).size) throw httpError(404, 'Algum participante informado não foi encontrado');

    const movement_id = uuidv4();
    // Gerente que pede e se indica como aprovador já gerou a necessidade: a
    // aprovação dele vale na hora, sem uma etapa extra para ele mesmo clicar.
    const selfApproves = this.movementPolicyService.isManager(actor) && approverIds.includes(actor.user_id);
    const approvals = approverIds.map(user_id => (selfApproves && user_id === actor.user_id
      ? { user_id, status: 'aprovada', note: 'Aprovada por quem solicitou', decided_at: new Date(), decided_by: actor.user_id }
      : { user_id }));
    const autoApproved = approvals.every(a => a.status === 'aprovada');
    const movement = await this.movementRepository.create({
      movement_id,
      number: await this.numberingService.next('MOV'),
      type: data.type,
      reason: data.reason,
      asset_ids: assets.map(a => a.asset_id),
      origin: {
        unit_id: assets[0].unit_id,
        location: common(assets.map(a => a.location)),
        responsible_name: common(assets.map(a => a.responsible_name)),
      },
      destination: {
        unit_id: data.destination.unit_id,
        location: data.destination.location || '',
        responsible_name: data.destination.responsible_name || '',
      },
      requested_by: actor.user_id,
      approvals,
      deliverer_id: data.deliverer_id,
      receiver_id: data.receiver_id,
      carrier: {
        company: data.carrier?.company || '',
        driver_name: data.carrier?.driver_name || '',
        driver_document: data.carrier?.driver_document || '',
        vehicle_plate: data.carrier?.vehicle_plate || '',
      },
      expected_date: data.expected_date || null,
      status: autoApproved ? 'aprovada' : 'aguardando_aprovacao',
      source_discrepancy_id: data.source_discrepancy_id || null,
    });

    await this.assetRepository.updateMany(movement.asset_ids, { active_movement_id: movement_id });

    await this.movementEventService.append({
      movement_id,
      event_type: 'solicitada',
      summary: `Movimentação solicitada (${assets.length} bem/bens)`,
      actor,
      acted_as: 'solicitante',
      details: { type: data.type, reason: data.reason, asset_codes: assets.map(a => a.code), approvers: approverIds.length },
    });
    if (autoApproved) {
      await this.movementEventService.append({
        movement_id,
        event_type: 'aprovada',
        summary: selfApproves ? 'Aprovada por quem solicitou (gestor)' : 'Aprovada automaticamente — tipo sem exigência de aprovação',
        actor,
        acted_as: selfApproves ? 'aprovador' : 'sistema',
      });
    }

    await this.assetEventService.recordMany(assets.map(a => ({
      asset_id: a.asset_id,
      event_type: 'movimentacao_aberta',
      summary: `Incluído na movimentação ${movement.number}`,
      actor,
      reference_type: 'movement',
      reference_id: movement_id,
    })));

    // Regularização de uma pendência de inventário: a pendência fica resolvida
    // apontando para a movimentação que vai corrigir a situação.
    if (data.source_discrepancy_id) {
      await this.discrepancyRepository.update(data.source_discrepancy_id, {
        status: 'resolvida',
        resolution: {
          action: 'abrir_movimentacao',
          note: `Regularização pela movimentação ${movement.number}`,
          resolved_by: actor.user_id,
          resolved_by_name: actor.name || '',
          resolved_at: new Date(),
          movement_id,
        },
      });
    }

    await this.auditService.log({ actor_id: actor.user_id, action: 'movement.create', resource_type: 'movement', resource_id: movement_id });
    logger.info('movement.create', { movement_id, type: data.type, assets: assets.length });
    return formatMovement(await this.movementRepository.findById(movement_id));
  }
}

module.exports = CreateMovementOperation;
