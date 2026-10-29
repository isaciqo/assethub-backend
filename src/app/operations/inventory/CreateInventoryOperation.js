const { v4: uuidv4 } = require('uuid');
const httpError = require('../../../lib/httpError');
const logger = require('../../../lib/logger');
const { formatInventory } = require('../../../lib/formatters');

class CreateInventoryOperation {
  constructor({ inventoryRepository, unitRepository, assetRepository, numberingService, auditService }) {
    this.inventoryRepository = inventoryRepository;
    this.unitRepository = unitRepository;
    this.assetRepository = assetRepository;
    this.numberingService = numberingService;
    this.auditService = auditService;
  }

  async execute({ actor, unit_id, name, locations = [] }) {
    const unit = await this.unitRepository.findById(unit_id);
    if (!unit) throw httpError(404, 'Comarca não encontrada');

    // Inventário da comarca inteira (sem setores) ou de setores escolhidos (ex.:
    // só a 1ª Vara Cível). Duas varas podem ser inventariadas ao mesmo tempo, mas
    // um setor nunca fica em dois inventários abertos: várias pessoas/aparelhos
    // trabalham no MESMO inventário, e é isso que permite detectar conferência duplicada.
    const open = await this.inventoryRepository.findOpenByUnit(unit_id);
    const clash = open.find(inv => !inv.locations.length || !locations.length || inv.locations.some(l => locations.includes(l)));
    if (clash) {
      throw httpError(409, clash.locations.length && locations.length
        ? `Algum desses setores já está no inventário em andamento ${clash.number}`
        : `Já existe um inventário em andamento nesta comarca (${clash.number})`);
    }

    let assets = await this.assetRepository.findAll({ unit_id });
    assets = assets.filter(a => a.status !== 'baixado');
    if (locations.length) assets = assets.filter(a => locations.includes(a.location));
    if (!assets.length) throw httpError(400, 'Nenhum bem previsto para esta comarca/setor. Importe a planilha de bens primeiro.');

    const scope = locations.length === 1 ? `${locations[0]} · ${unit.name}` : unit.name;
    const inventory = await this.inventoryRepository.create({
      inventory_id: uuidv4(),
      number: await this.numberingService.next('INV'),
      name: name || `Inventário ${new Date().getFullYear()} — ${scope}`,
      unit_id,
      locations,
      expected_asset_ids: assets.map(a => a.asset_id),
      created_by: actor.user_id,
    });

    await this.auditService.log({ actor_id: actor.user_id, action: 'inventory.create', resource_type: 'inventory', resource_id: inventory.inventory_id, metadata: { expected: assets.length } });
    logger.info('inventory.create: aberto', { inventory_id: inventory.inventory_id, unit_id, expected: assets.length });
    return formatInventory(inventory);
  }
}

module.exports = CreateInventoryOperation;
