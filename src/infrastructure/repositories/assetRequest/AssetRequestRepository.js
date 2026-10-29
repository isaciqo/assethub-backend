const AssetRequest = require('../../../database/models/assetRequest/assetRequestModel');

class AssetRequestRepository {
  async create(data) {
    return new AssetRequest(data).save();
  }

  async findById(request_id) {
    return AssetRequest.findOne({ request_id });
  }

  async findByMovement(movement_id) {
    return AssetRequest.findOne({ movement_ids: movement_id });
  }

  // Urgentes primeiro, depois as mais antigas — a fila de quem atende.
  async find(filter = {}) {
    return AssetRequest.find(filter).sort({ urgency: -1, createdAt: 1 }).limit(500);
  }

  async update(request_id, data) {
    return AssetRequest.findOneAndUpdate({ request_id }, data, { new: true });
  }

  async countBy(field, match = {}) {
    return AssetRequest.aggregate([
      { $match: match },
      { $group: { _id: `$${field}`, count: { $sum: 1 } } },
    ]);
  }
}

module.exports = AssetRequestRepository;
