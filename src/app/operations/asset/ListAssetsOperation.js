const { formatAsset } = require('../../../lib/formatters');

class ListAssetsOperation {
  constructor({ assetRepository }) {
    this.assetRepository = assetRepository;
  }

  async execute({ page = 1, pageSize = 50, ...filters }) {
    const limit = Math.min(Number(pageSize) || 50, 500);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * limit;
    const { items, total } = await this.assetRepository.list(filters, { skip, limit });
    return { items: items.map(formatAsset), total, page: Number(page) || 1, pageSize: limit };
  }
}

module.exports = ListAssetsOperation;
