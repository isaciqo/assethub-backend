const httpError = require('../../../lib/httpError');
const { MOVEMENT_TYPES } = require('../../../lib/constants');

// Verificação pública do termo (QR Code impresso no PDF). Sem login e, por
// LGPD, sem nomes de pessoas: só confirma que o documento existe, em que
// situação está e se o histórico continua íntegro.
class VerifyMovementOperation {
  constructor({ movementRepository, movementEventRepository, unitRepository, hashChainService }) {
    this.movementRepository = movementRepository;
    this.movementEventRepository = movementEventRepository;
    this.unitRepository = unitRepository;
    this.hashChainService = hashChainService;
  }

  async execute({ movement_id, h }) {
    const movement = await this.movementRepository.findById(movement_id);
    if (!movement) throw httpError(404, 'Documento não encontrado');

    const [events, origin, destination] = await Promise.all([
      this.movementEventRepository.findByMovement(movement_id),
      this.unitRepository.findById(movement.origin.unit_id),
      this.unitRepository.findById(movement.destination.unit_id),
    ]);
    const chain = this.hashChainService.verify(events);

    return {
      number: movement.number,
      type: MOVEMENT_TYPES[movement.type]?.label || movement.type,
      status: movement.status,
      originUnit: origin?.name || '',
      destinationUnit: destination?.name || '',
      assetCount: movement.asset_ids.length,
      eventCount: events.length,
      createdAt: movement.createdAt,
      completedAt: movement.completed_at,
      chainValid: chain.valid,
      chainHead: chain.head,
      // O QR carrega o prefixo do hash do momento em que o PDF foi gerado.
      // Se a movimentação avançou depois, o prefixo não bate mais — e isso é
      // informado como "documento desatualizado", não como fraude.
      hashMatches: h ? !!chain.head && chain.head.startsWith(h) : null,
    };
  }
}

module.exports = VerifyMovementOperation;
