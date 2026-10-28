const Asset = require('../../../database/models/asset/assetModel');
const { escapeRegex, normalizeCode } = require('../../../lib/text');

class AssetRepository {
  buildFilter({ unit_id, location, status, category, conservation_status, search } = {}) {
    const filter = {};
    if (unit_id) filter.unit_id = unit_id;
    if (location) filter.location = location;
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (conservation_status) filter.conservation_status = conservation_status;
    if (search) {
      const rx = { $regex: escapeRegex(search), $options: 'i' };
      filter.$or = [
        { code: rx },
        { code_normalized: { $regex: escapeRegex(normalizeCode(search)), $options: 'i' } },
        { description: rx },
        { responsible_name: rx },
        { serial_number: rx },
        { location: rx },
      ];
    }
    return filter;
  }

  async list(query = {}, { skip = 0, limit = 50 } = {}) {
    const filter = this.buildFilter(query);
    const [items, total] = await Promise.all([
      Asset.find(filter).sort({ unit_id: 1, location: 1, code: 1 }).skip(skip).limit(limit),
      Asset.countDocuments(filter),
    ]);
    return { items, total };
  }

  // Sem paginação — exportação e snapshot offline. Teto de segurança alto o
  // bastante para uma unidade grande do interior.
  async findAll(query = {}) {
    return Asset.find(this.buildFilter(query)).sort({ location: 1, code: 1 }).limit(50000);
  }

  async findById(asset_id) {
    return Asset.findOne({ asset_id });
  }

  async findByIds(ids) {
    if (!ids.length) return [];
    return Asset.find({ asset_id: { $in: ids } });
  }

  async findByCode(code) {
    return Asset.findOne({ code_normalized: normalizeCode(code) });
  }

  async findByNormalizedCodes(codes) {
    if (!codes.length) return [];
    return Asset.find({ code_normalized: { $in: codes } });
  }

  async create(data) {
    return new Asset(data).save();
  }

  async bulkWrite(ops) {
    if (!ops.length) return null;
    return Asset.bulkWrite(ops, { ordered: false });
  }

  async update(asset_id, data) {
    return Asset.findOneAndUpdate({ asset_id }, data, { new: true });
  }

  async updateMany(ids, data) {
    if (!ids.length) return null;
    return Asset.updateMany({ asset_id: { $in: ids } }, data);
  }

  async distinct(field, query = {}) {
    return Asset.distinct(field, this.buildFilter(query));
  }

  async count(query = {}) {
    return Asset.countDocuments(this.buildFilter(query));
  }

  async countCheckedSinceByUnit(since) {
    return Asset.aggregate([
      { $match: { last_checked_at: { $gte: since } } },
      { $group: { _id: '$unit_id', count: { $sum: 1 } } },
    ]);
  }

  async countBy(field, query = {}) {
    return Asset.aggregate([
      { $match: this.buildFilter(query) },
      { $group: { _id: `$${field}`, count: { $sum: 1 } } },
    ]);
  }
}

module.exports = AssetRepository;
