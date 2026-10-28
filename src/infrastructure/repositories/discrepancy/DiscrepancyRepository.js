const Discrepancy = require('../../../database/models/discrepancy/discrepancyModel');

class DiscrepancyRepository {
  async create(data) {
    return new Discrepancy(data).save();
  }

  async createMany(docs) {
    if (!docs.length) return [];
    return Discrepancy.insertMany(docs, { ordered: false });
  }

  async findById(discrepancy_id) {
    return Discrepancy.findOne({ discrepancy_id });
  }

  async find(filter = {}) {
    return Discrepancy.find(filter).sort({ status: 1, createdAt: -1 }).limit(5000);
  }

  async findOpenByCheck(check_id) {
    return Discrepancy.find({ check_id, status: 'aberta' });
  }

  async update(discrepancy_id, data) {
    return Discrepancy.findOneAndUpdate({ discrepancy_id }, data, { new: true });
  }

  async countBy(field, match = {}) {
    return Discrepancy.aggregate([
      { $match: match },
      { $group: { _id: `$${field}`, count: { $sum: 1 } } },
    ]);
  }

  async count(filter = {}) {
    return Discrepancy.countDocuments(filter);
  }
}

module.exports = DiscrepancyRepository;
