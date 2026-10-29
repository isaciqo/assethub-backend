const Asset = require('../../../database/models/asset/assetModel');
const { escapeRegex, normalizeCode } = require('../../../lib/text');

// Janela da "cobertura": bem conferido há até 12 meses está em dia.
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

class AssetRepository {
  buildFilter({ unit_id, location, room, status, category, brand, responsible_name, conservation_status, checked, search } = {}) {
    const filter = {};
    if (unit_id) filter.unit_id = unit_id;
    if (location) filter.location = location;
    if (room) filter.room = room;
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (brand) filter.brand = brand;
    if (responsible_name) filter.responsible_name = responsible_name;
    if (conservation_status) filter.conservation_status = conservation_status;
    if (checked) {
      const since = new Date(Date.now() - YEAR_MS);
      if (checked === 'em_dia') filter.last_checked_at = { $gte: since };
      if (checked === 'atrasada') filter.last_checked_at = { $lt: since };
      if (checked === 'nunca') filter.last_checked_at = null;
    }
    if (search) {
      const rx = { $regex: escapeRegex(search), $options: 'i' };
      filter.$or = [
        { code: rx },
        { code_normalized: { $regex: escapeRegex(normalizeCode(search)), $options: 'i' } },
        { description: rx },
        { responsible_name: rx },
        { serial_number: rx },
        { location: rx },
        { room: rx },
        { brand: rx },
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
  // Bens "no nome" da pessoa: o cadastro guarda o responsável por nome (é o que
  // vem da planilha), então compara o nome inteiro sem diferenciar maiúsculas.
  async findByResponsible(name) {
    if (!String(name || '').trim()) return [];
    const rx = new RegExp(`^\\s*${escapeRegex(String(name).trim())}\\s*$`, 'i');
    return Asset.find({ responsible_name: rx, status: { $ne: 'baixado' } }).sort({ location: 1, code: 1 });
  }

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

  // Cobertura por setor: total de bens e quantos foram conferidos desde "since",
  // agrupados por comarca + setor. Bens baixados não contam.
  async coverageBySector(since) {
    return Asset.aggregate([
      { $match: { status: { $ne: 'baixado' } } },
      {
        $group: {
          _id: { unit_id: '$unit_id', location: '$location' },
          assets: { $sum: 1 },
          checked: { $sum: { $cond: [{ $gte: ['$last_checked_at', since] }, 1, 0] } },
        },
      },
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
