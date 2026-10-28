const httpError = require('../../../lib/httpError');
const { formatAsset, formatAssetEvent, formatUnit, formatCheck, formatMovement } = require('../../../lib/formatters');

// Visão 360 do bem: cadastro, linha do tempo, conferências e movimentações.
class GetAssetOperation {
  constructor({ assetRepository, unitRepository, assetEventRepository, inventoryCheckRepository, movementRepository }) {
    this.assetRepository = assetRepository;
    this.unitRepository = unitRepository;
    this.assetEventRepository = assetEventRepository;
    this.inventoryCheckRepository = inventoryCheckRepository;
    this.movementRepository = movementRepository;
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

    return {
      asset: formatAsset(asset),
      unit: formatUnit(unit),
      events: events.map(formatAssetEvent),
      checks: checks.map(formatCheck),
      movements: movements.map(formatMovement),
    };
  }
}

module.exports = GetAssetOperation;
