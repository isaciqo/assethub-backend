const httpError = require('../../../lib/httpError');
const { formatInventory, formatUnit, formatCheck } = require('../../../lib/formatters');

class GetInventoryOperation {
  constructor({ inventoryRepository, unitRepository, inventoryCheckRepository, inventorySummaryService, assetRepository }) {
    this.inventoryRepository = inventoryRepository;
    this.unitRepository = unitRepository;
    this.inventoryCheckRepository = inventoryCheckRepository;
    this.inventorySummaryService = inventorySummaryService;
    this.assetRepository = assetRepository;
  }

  async execute(inventory_id) {
    const inventory = await this.inventoryRepository.findById(inventory_id);
    if (!inventory) throw httpError(404, 'Inventário não encontrado');

    const [unit, summary, checks] = await Promise.all([
      this.unitRepository.findById(inventory.unit_id),
      this.inventorySummaryService.summarize(inventory, { detailed: true }),
      this.inventoryCheckRepository.findByInventory(inventory_id, { limit: 300 }),
    ]);

    const assets = await this.assetRepository.findByIds([...new Set(checks.map(c => c.asset_id).filter(Boolean))]);
    const desc = Object.fromEntries(assets.map(a => [a.asset_id, a.description]));

    // Ranking da equipe: quem conferiu quanto. Dá visibilidade ao trabalho de
    // campo e ajuda a redistribuir salas no meio do inventário.
    const team = {};
    checks.filter(c => c.is_primary).forEach(c => {
      const row = team[c.checked_by] || { userId: c.checked_by, name: c.checked_by_name, count: 0 };
      row.count += 1;
      team[c.checked_by] = row;
    });

    return {
      ...formatInventory(inventory, { summary }),
      unit: formatUnit(unit),
      recentChecks: checks.slice(0, 40).map(c => ({ ...formatCheck(c), assetDescription: desc[c.asset_id] || c.observed_description || '' })),
      team: Object.values(team).sort((a, b) => b.count - a.count),
    };
  }
}

module.exports = GetInventoryOperation;
