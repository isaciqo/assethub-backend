const AssetEvent = require('../../../database/models/assetEvent/assetEventModel');

class AssetEventRepository {
  async create(data) {
    return new AssetEvent(data).save();
  }

  async createMany(docs) {
    if (!docs.length) return [];
    return AssetEvent.insertMany(docs, { ordered: false });
  }

  async findByAsset(asset_id, limit = 200) {
    return AssetEvent.find({ asset_id }).sort({ occurred_at: -1 }).limit(limit);
  }

  async findRecent(limit = 15) {
    return AssetEvent.find({}).sort({ occurred_at: -1 }).limit(limit);
  }
}

module.exports = AssetEventRepository;
