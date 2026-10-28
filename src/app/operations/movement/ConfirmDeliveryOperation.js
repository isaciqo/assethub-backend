const httpError = require('../../../lib/httpError');
const { formatMovement } = require('../../../lib/formatters');

class ConfirmDeliveryOperation {
  constructor({ movementRepository, assetRepository, movementPolicyService, movementEventService, handoverService, assetEventService }) {
    this.movementRepository = movementRepository;
    this.assetRepository = assetRepository;
    this.movementPolicyService = movementPolicyService;
    this.movementEventService = movementEventService;
    this.handoverService = handoverService;
    this.assetEventService = assetEventService;
  }

  async execute({ actor, movement_id, input }) {
    const movement = await this.movementRepository.findById(movement_id);
    if (!movement) throw httpError(404, 'Movimentação não encontrada');
    const { actedAs } = this.movementPolicyService.authorize(actor, movement, 'deliver');

    const { handover, evidenceHashes } = await this.handoverService.build({ actor, movement, stage: 'entrega', input });
    const update = { delivery: handover, status: 'em_transito' };
    if (input.carrier) {
      update.carrier = {
        company: input.carrier.company ?? movement.carrier.company,
        driver_name: input.carrier.driver_name ?? movement.carrier.driver_name,
        driver_document: input.carrier.driver_document ?? movement.carrier.driver_document,
        vehicle_plate: input.carrier.vehicle_plate ?? movement.carrier.vehicle_plate,
      };
    }
    await this.movementRepository.update(movement_id, update);
    await this.assetRepository.updateMany(movement.asset_ids, { status: 'em_movimentacao' });

    await this.movementEventService.append({
      movement_id,
      event_type: 'entrega',
      summary: `Entrega confirmada e assinada por ${handover.signer_name}`,
      actor,
      acted_as: actedAs,
      // Hashes das evidências entram na cadeia: trocar a foto depois quebra a verificação.
      details: { conditions: handover.conditions, notes: handover.notes, evidence: evidenceHashes },
    });
    await this.assetEventService.recordMany(movement.asset_ids.map(asset_id => ({
      asset_id,
      event_type: 'movimentacao_entrega',
      summary: `Entregue para transporte/recebimento (${movement.number})`,
      actor,
      reference_type: 'movement',
      reference_id: movement_id,
    })));

    return formatMovement(await this.movementRepository.findById(movement_id));
  }
}

module.exports = ConfirmDeliveryOperation;
