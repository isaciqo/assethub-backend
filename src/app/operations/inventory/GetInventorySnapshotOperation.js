const httpError = require('../../../lib/httpError');
const { formatInventory, formatUnit } = require('../../../lib/formatters');

// Pacote que o aparelho baixa antes de ir a campo: tudo o que a conferência
// precisa para funcionar 100% offline. Só os campos necessários — o aparelho é
// tratado como ambiente potencialmente exposto (sem valor, sem notas internas).
class GetInventorySnapshotOperation {
  constructor({ inventoryRepository, unitRepository, assetRepository, inventoryCheckRepository }) {
    this.inventoryRepository = inventoryRepository;
    this.unitRepository = unitRepository;
    this.assetRepository = assetRepository;
    this.inventoryCheckRepository = inventoryCheckRepository;
  }

  async execute(inventory_id) {
    const inventory = await this.inventoryRepository.findById(inventory_id);
    if (!inventory) throw httpError(404, 'Inventário não encontrado');
    if (inventory.status !== 'em_andamento') throw httpError(409, 'Inventário encerrado — não pode ser preparado para conferência');

    const [unit, assets, checks] = await Promise.all([
      this.unitRepository.findById(inventory.unit_id),
      this.assetRepository.findByIds(inventory.expected_asset_ids),
      this.inventoryCheckRepository.findByInventory(inventory_id),
    ]);

    return {
      inventory: formatInventory(inventory),
      unit: formatUnit(unit),
      assets: assets.map(a => ({
        id: a.asset_id,
        code: a.code,
        codeNormalized: a.code_normalized,
        description: a.description,
        category: a.category,
        brand: a.brand || '',
        serialNumber: a.serial_number || '',
        location: a.location || '',
        room: a.room || '',
        responsibleName: a.responsible_name || '',
        conservationStatus: a.conservation_status,
      })),
      // Conferências já feitas por QUALQUER aparelho — evita que a equipe
      // confira de novo o que outro colega já conferiu.
      serverChecks: checks.filter(c => c.is_primary && c.asset_id).map(c => ({
        assetId: c.asset_id,
        status: c.check_status,
        checkedByName: c.checked_by_name,
        checkedAt: c.checked_at,
        operationId: c.operation_id,
      })),
      generatedAt: new Date().toISOString(),
    };
  }
}

module.exports = GetInventorySnapshotOperation;
