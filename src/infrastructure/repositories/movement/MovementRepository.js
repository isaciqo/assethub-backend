const Movement = require('../../../database/models/movement/movementModel');

class MovementRepository {
  async create(data) {
    return new Movement(data).save();
  }

  async findById(movement_id) {
    return Movement.findOne({ movement_id });
  }

  async find(filter = {}) {
    return Movement.find(filter).sort({ createdAt: -1 }).limit(500);
  }

  async findByAsset(asset_id) {
    return Movement.find({ asset_ids: asset_id }).sort({ createdAt: -1 }).limit(100);
  }

  async update(movement_id, data) {
    return Movement.findOneAndUpdate({ movement_id }, data, { new: true });
  }

  async countBy(field, match = {}) {
    return Movement.aggregate([
      { $match: match },
      { $group: { _id: `$${field}`, count: { $sum: 1 } } },
    ]);
  }
}

module.exports = MovementRepository;
