const { formatInventory } = require('../../../lib/formatters');

class ListInventoriesOperation {
  constructor({ inventoryRepository, inventorySummaryService }) {
    this.inventoryRepository = inventoryRepository;
    this.inventorySummaryService = inventorySummaryService;
  }

  async execute({ status, unit_id } = {}) {
    const filter = {};
    if (status) filter.status = status;
    if (unit_id) filter.unit_id = unit_id;
    const inventories = await this.inventoryRepository.find(filter);
    return Promise.all(inventories.map(async inv => formatInventory(inv, {
      summary: await this.inventorySummaryService.summarize(inv),
    })));
  }
}

module.exports = ListInventoriesOperation;
