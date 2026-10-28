const httpError = require('../../../lib/httpError');
const { MOVEMENT_TYPES } = require('../../../lib/constants');

class GenerateMovementTermOperation {
  constructor({ movementRepository, movementEventRepository, assetRepository, unitRepository, userRepository, evidenceRepository, hashChainService, pdfService }) {
    this.movementRepository = movementRepository;
    this.movementEventRepository = movementEventRepository;
    this.assetRepository = assetRepository;
    this.unitRepository = unitRepository;
    this.userRepository = userRepository;
    this.evidenceRepository = evidenceRepository;
    this.hashChainService = hashChainService;
    this.pdfService = pdfService;
  }

  async execute(movement_id) {
    const movement = await this.movementRepository.findById(movement_id);
    if (!movement) throw httpError(404, 'Movimentação não encontrada');

    const userIds = [movement.requested_by, movement.deliverer_id, movement.receiver_id, ...movement.approvals.map(a => a.user_id)];
    const [events, assets, units, users, evidences] = await Promise.all([
      this.movementEventRepository.findByMovement(movement_id),
      this.assetRepository.findByIds(movement.asset_ids),
      this.unitRepository.findByIds([movement.origin.unit_id, movement.destination.unit_id]),
      this.userRepository.findByIds([...new Set(userIds)]),
      this.evidenceRepository.findMetaByOwner('movement', movement_id),
    ]);

    const loadSig = async id => (id ? this.evidenceRepository.findById(id) : null);
    const [deliverySig, receiptSig] = await Promise.all([
      loadSig(movement.delivery?.signature_evidence_id),
      loadSig(movement.receipt?.signature_evidence_id),
    ]);

    const appUrl = (process.env.PUBLIC_APP_URL || 'http://localhost:8080').replace(/\/$/, '');
    const chain = this.hashChainService.verify(events);
    const verifyUrl = `${appUrl}/verificar/${movement_id}?h=${(chain.head || '').slice(0, 16)}`;

    const buffer = await this.pdfService.movementTerm({
      movement: { ...movement.toObject(), typeLabel: MOVEMENT_TYPES[movement.type]?.label || movement.type },
      assets,
      units: Object.fromEntries(units.map(u => [u.unit_id, u])),
      users: Object.fromEntries(users.map(u => [u.user_id, u])),
      events,
      signatures: { delivery: deliverySig, receipt: receiptSig },
      photos: evidences.filter(e => e.kind !== 'assinatura'),
      chain,
      verifyUrl,
    });
    return { buffer, mime: 'application/pdf', fileName: `termo-${movement.number}.pdf` };
  }
}

module.exports = GenerateMovementTermOperation;
