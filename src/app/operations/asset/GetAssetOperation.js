const httpError = require('../../../lib/httpError');
const { formatAsset, formatAssetEvent, formatUnit, formatCheck, formatMovement, formatEvidence, iso } = require('../../../lib/formatters');

// Visão 360 do bem: cadastro, última foto, documentos anexados, linha do tempo,
// conferências e movimentações.
class GetAssetOperation {
  constructor({ assetRepository, unitRepository, assetEventRepository, inventoryCheckRepository, movementRepository, evidenceRepository, assetPhotoService }) {
    this.assetRepository = assetRepository;
    this.unitRepository = unitRepository;
    this.assetEventRepository = assetEventRepository;
    this.inventoryCheckRepository = inventoryCheckRepository;
    this.movementRepository = movementRepository;
    this.evidenceRepository = evidenceRepository;
    this.assetPhotoService = assetPhotoService;
  }

  async execute({ asset_id, code }) {
    const asset = asset_id ? await this.assetRepository.findById(asset_id) : await this.assetRepository.findByCode(code);
    if (!asset) throw httpError(404, 'Bem não encontrado');

    const [unit, events, checks, movements] = await Promise.all([
      this.unitRepository.findById(asset.unit_id),
      this.assetEventRepository.findByAsset(asset.asset_id),
      this.inventoryCheckRepository.findByAsset(asset.asset_id),
      this.movementRepository.findByAsset(asset.asset_id),
    ]);
    const [photo, attachments] = await Promise.all([
      this.assetPhotoService.latest(asset.asset_id, { checks, movements }),
      this.evidenceRepository.findMetaByOwner('asset', asset.asset_id),
    ]);

    return {
      asset: formatAsset(asset),
      unit: formatUnit(unit),
      lastPhoto: photo ? { evidenceId: photo.evidence_id, at: iso(photo.at), by: photo.by, source: photo.source } : null,
      attachments: attachments.map(formatEvidence),
      events: events.map(formatAssetEvent),
      checks: checks.map(formatCheck),
      movements: movements.map(formatMovement),
    };
  }
}

module.exports = GetAssetOperation;
