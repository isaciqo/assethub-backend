const { formatAsset } = require('../../../lib/formatters');

// "Reaproveitar antes de comprar": bens parados que podem atender o pedido.
class SuggestAvailableAssetsOperation {
  constructor({ assetRequestService, unitRepository }) {
    this.assetRequestService = assetRequestService;
    this.unitRepository = unitRepository;
  }

  async execute({ actor, request_id }) {
    const request = await this.assetRequestService.load(request_id, actor);
    const [assets, units] = await Promise.all([this.assetRequestService.availableFor(request), this.unitRepository.findAll()]);
    const unitName = Object.fromEntries(units.map(u => [u.unit_id, u.name]));
    return assets.slice(0, 50).map(a => ({ ...formatAsset(a), unitName: unitName[a.unit_id] || '' }));
  }
}

module.exports = SuggestAvailableAssetsOperation;
