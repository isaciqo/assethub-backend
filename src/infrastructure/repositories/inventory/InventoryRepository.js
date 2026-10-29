const Inventory = require('../../../database/models/inventory/inventoryModel');

class InventoryRepository {
  async create(data) {
    return new Inventory(data).save();
  }

  async findById(inventory_id) {
    return Inventory.findOne({ inventory_id });
  }

  async find(filter = {}) {
    return Inventory.find(filter).sort({ createdAt: -1 }).limit(500);
  }

  async findOpenByUnit(unit_id) {
    return Inventory.find({ unit_id, status: 'em_andamento' });
  }

  async update(inventory_id, data) {
    return Inventory.findOneAndUpdate({ inventory_id }, data, { new: true });
  }
}

module.exports = InventoryRepository;
