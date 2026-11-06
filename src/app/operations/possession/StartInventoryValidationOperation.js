const { v4: uuidv4 } = require('uuid');
const httpError = require('../../../lib/httpError');
const logger = require('../../../lib/logger');
const { formatPossessionCheck } = require('../../../lib/formatters');

// Inventário aberto com bens no nome da pessoa: ela mesma abre a validação
// ("estão comigo?") só dos bens dela que estão no inventário. Responder segue o
// fluxo normal: "não está" vira pendência para o gerente decidir.
class StartInventoryValidationOperation {
  constructor({ inventoryRepository, possessionCheckRepository, assetRepository, userRepository, numberingService, auditService }) {
    this.inventoryRepository = inventoryRepository;
    this.possessionCheckRepository = possessionCheckRepository;
    this.assetRepository = assetRepository;
    this.userRepository = userRepository;
    this.numberingService = numberingService;
    this.auditService = auditService;
  }

  async execute({ actor, inventory_id }) {
    const inventory = await this.inventoryRepository.findById(inventory_id);
    if (!inventory) throw httpError(404, 'Inventário não encontrado');
    if (inventory.status !== 'em_andamento') throw httpError(409, 'Este inventário já foi encerrado');

    // Clicou duas vezes ou em dois aparelhos: devolve a mesma validação.
    const [existing] = await this.possessionCheckRepository.find({ user_id: actor.user_id, inventory_id, status: 'pendente' });
    if (existing) return formatPossessionCheck(existing);

    const expected = new Set(inventory.expected_asset_ids);
    const assets = (await this.assetRepository.findByResponsible(actor.name)).filter(a => expected.has(a.asset_id));
    if (!assets.length) throw httpError(400, 'Nenhum bem no seu nome está neste inventário');

    const [creator] = await this.userRepository.findByIds([inventory.created_by]);
    const check = await this.possessionCheckRepository.create({
      check_id: uuidv4(),
      number: await this.numberingService.next('VAL'),
      user_id: actor.user_id,
      user_name: actor.name,
      requested_by: inventory.created_by,
      requested_by_name: creator?.name || '',
      inventory_id,
      inventory_number: inventory.number,
      items: assets.map(a => ({ asset_id: a.asset_id, code: a.code, description: a.description, location: a.location })),
    });
    await this.auditService.log({ actor_id: actor.user_id, action: 'possession.inventory_start', resource_type: 'possession_check', resource_id: check.check_id, metadata: { inventory_id, items: assets.length } });
    logger.info('possession.inventory_start', { inventory_id, items: assets.length });
    return formatPossessionCheck(check);
  }
}

module.exports = StartInventoryValidationOperation;
