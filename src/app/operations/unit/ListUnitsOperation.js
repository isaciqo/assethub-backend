const { formatUnit } = require('../../../lib/formatters');

class ListUnitsOperation {
  constructor({ unitRepository, assetRepository }) {
    this.unitRepository = unitRepository;
    this.assetRepository = assetRepository;
  }

  async execute() {
    const [units, counts] = await Promise.all([
      this.unitRepository.findAll(),
      this.assetRepository.countBy('unit_id'),
    ]);
    const countMap = Object.fromEntries(counts.map(c => [c._id, c.count]));
    return units.map(u => ({ ...formatUnit(u), assetCount: countMap[u.unit_id] || 0 }));
  }
}

module.exports = ListUnitsOperation;
