const PossessionCheck = require('../../../database/models/possessionCheck/possessionCheckModel');

class PossessionCheckRepository {
  async create(data) {
    return new PossessionCheck(data).save();
  }

  async findById(check_id) {
    return PossessionCheck.findOne({ check_id });
  }

  async findByIds(ids) {
    if (!ids.length) return [];
    return PossessionCheck.find({ check_id: { $in: ids } });
  }

  async find(filter = {}) {
    return PossessionCheck.find(filter).sort({ createdAt: -1 }).limit(200);
  }

  async update(check_id, data) {
    return PossessionCheck.findOneAndUpdate({ check_id }, data, { new: true });
  }
}

module.exports = PossessionCheckRepository;
