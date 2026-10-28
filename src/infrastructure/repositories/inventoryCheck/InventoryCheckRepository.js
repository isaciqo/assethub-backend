const InventoryCheck = require('../../../database/models/inventoryCheck/inventoryCheckModel');

class InventoryCheckRepository {
  async create(data) {
    return new InventoryCheck(data).save();
  }

  async findByOperationId(operation_id) {
    return InventoryCheck.findOne({ operation_id });
  }

  async findById(check_id) {
    return InventoryCheck.findOne({ check_id });
  }

  async findPrimary(inventory_id, asset_id) {
    return InventoryCheck.findOne({ inventory_id, asset_id, is_primary: true });
  }

  async findPrimaryUnregistered(inventory_id, asset_code) {
    return InventoryCheck.findOne({ inventory_id, asset_id: null, asset_code, is_primary: true });
  }

  async findByInventory(inventory_id, { limit = 5000 } = {}) {
    return InventoryCheck.find({ inventory_id }).sort({ checked_at: -1 }).limit(limit);
  }

  async findPrimaryAssetIds(inventory_id) {
    return InventoryCheck.distinct('asset_id', { inventory_id, is_primary: true, asset_id: { $type: 'string' } });
  }

  async update(check_id, data) {
    return InventoryCheck.findOneAndUpdate({ check_id }, data, { new: true });
  }

  async findByAsset(asset_id, limit = 50) {
    return InventoryCheck.find({ asset_id }).sort({ checked_at: -1 }).limit(limit);
  }

  // Métricas de produtividade: só conferências primárias entram, e só tempos
  // plausíveis (até 10 min) — um conferente que parou pro café não pode virar
  // "bem que levou 40 minutos para ser conferido".
  async stats(match = {}) {
    const [row] = await InventoryCheck.aggregate([
      { $match: { is_primary: true, ...match } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          offline: { $sum: { $cond: ['$was_offline', 1, 0] } },
          avg_elapsed_ms: {
            $avg: {
              $cond: [
                { $and: [{ $gt: ['$elapsed_ms', 0] }, { $lte: ['$elapsed_ms', 600000] }] },
                '$elapsed_ms',
                null,
              ],
            },
          },
          first_at: { $min: '$checked_at' },
          last_at: { $max: '$checked_at' },
        },
      },
    ]);
    return row || { total: 0, offline: 0, avg_elapsed_ms: null, first_at: null, last_at: null };
  }

  async countByMethod(match = {}) {
    return InventoryCheck.aggregate([
      { $match: { is_primary: true, ...match } },
      { $group: { _id: '$method', count: { $sum: 1 } } },
    ]);
  }

  async countByStatus(inventory_id) {
    return InventoryCheck.aggregate([
      { $match: { inventory_id } },
      { $group: { _id: '$check_status', count: { $sum: 1 } } },
    ]);
  }

  async countByLocation(inventory_id) {
    return InventoryCheck.aggregate([
      { $match: { inventory_id, is_primary: true } },
      { $group: { _id: '$observed_location', count: { $sum: 1 } } },
    ]);
  }
}

module.exports = InventoryCheckRepository;
