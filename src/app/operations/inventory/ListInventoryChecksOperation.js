const { formatCheck } = require('../../../lib/formatters');

class ListInventoryChecksOperation {
  constructor({ inventoryCheckRepository, assetRepository }) {
    this.inventoryCheckRepository = inventoryCheckRepository;
    this.assetRepository = assetRepository;
  }

  async execute(inventory_id) {
    const checks = await this.inventoryCheckRepository.findByInventory(inventory_id);
    const assets = await this.assetRepository.findByIds([...new Set(checks.map(c => c.asset_id).filter(Boolean))]);
    const desc = Object.fromEntries(assets.map(a => [a.asset_id, a.description]));
    return checks.map(c => ({ ...formatCheck(c), assetDescription: desc[c.asset_id] || c.observed_description || '' }));
  }
}

module.exports = ListInventoryChecksOperation;
