const { v4: uuidv4 } = require('uuid');
const httpError = require('../../../lib/httpError');
const logger = require('../../../lib/logger');
const { formatInventory } = require('../../../lib/formatters');

// Encerrar é o momento em que "ainda não conferido" vira "não localizado":
// cada bem previsto sem conferência gera uma pendência para revisão humana.
// O status do bem no cadastro NÃO muda aqui — só quando alguém decide.
class CompleteInventoryOperation {
  constructor({ inventoryRepository, inventoryCheckRepository, discrepancyRepository, assetRepository, inventorySummaryService, auditService }) {
    this.inventoryRepository = inventoryRepository;
    this.inventoryCheckRepository = inventoryCheckRepository;
    this.discrepancyRepository = discrepancyRepository;
    this.assetRepository = assetRepository;
    this.inventorySummaryService = inventorySummaryService;
    this.auditService = auditService;
  }

  async execute({ actor, inventory_id }) {
    const inventory = await this.inventoryRepository.findById(inventory_id);
    if (!inventory) throw httpError(404, 'Inventário não encontrado');
    if (inventory.status !== 'em_andamento') throw httpError(409, 'Inventário já encerrado');

    const checked = new Set(await this.inventoryCheckRepository.findPrimaryAssetIds(inventory_id));
    const missingIds = inventory.expected_asset_ids.filter(id => !checked.has(id));
    const missing = await this.assetRepository.findByIds(missingIds);

    await this.discrepancyRepository.createMany(missing.map(a => ({
      discrepancy_id: uuidv4(),
      inventory_id,
      unit_id: inventory.unit_id,
      asset_id: a.asset_id,
      asset_code: a.code,
      type: 'nao_localizado',
      expected: { location: a.location, responsible_name: a.responsible_name },
      observed: null,
    })));

    const now = new Date();
    const checkedIds = [...checked];
    await this.assetRepository.updateMany(checkedIds, { last_inventory_id: inventory_id });
    const saved = await this.inventoryRepository.update(inventory_id, { status: 'concluido', completed_at: now, completed_by: actor.user_id });

    await this.auditService.log({ actor_id: actor.user_id, action: 'inventory.complete', resource_type: 'inventory', resource_id: inventory_id, metadata: { notFound: missing.length } });
    logger.info('inventory.complete: encerrado', { inventory_id, notFound: missing.length });
    return formatInventory(saved, { summary: await this.inventorySummaryService.summarize(saved) });
  }
}

module.exports = CompleteInventoryOperation;
