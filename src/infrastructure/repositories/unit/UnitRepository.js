const Unit = require('../../../database/models/unit/unitModel');
const { escapeRegex } = require('../../../lib/text');

class UnitRepository {
  async findAll() {
    return Unit.find({}).sort({ region: 1, name: 1 }).limit(500);
  }

  async findById(unit_id) {
    return Unit.findOne({ unit_id });
  }

  async findByIds(ids) {
    if (!ids.length) return [];
    return Unit.find({ unit_id: { $in: ids } });
  }

  // A planilha pode trazer a unidade pelo código (FCB) ou pelo nome por extenso.
  async findByCodeOrName(value) {
    const term = String(value).trim();
    return Unit.findOne({
      $or: [
        { code: term.toUpperCase() },
        { name: { $regex: new RegExp(`^${escapeRegex(term)}$`, 'i') } },
      ],
    });
  }

  async create(data) {
    return new Unit(data).save();
  }

  async update(unit_id, data) {
    return Unit.findOneAndUpdate({ unit_id }, data, { new: true });
  }

  async addLocations(unit_id, locations) {
    const clean = [...new Set(locations.map(l => String(l || '').trim()).filter(Boolean))];
    if (!clean.length) return null;
    return Unit.updateOne({ unit_id }, { $addToSet: { locations: { $each: clean } } });
  }
}

module.exports = UnitRepository;
