const { v4: uuidv4 } = require('uuid');
const httpError = require('../../../lib/httpError');
const logger = require('../../../lib/logger');
const { formatPossessionCheck } = require('../../../lib/formatters');

// O gerente pede a uma ou mais pessoas que confirmem se ainda estão com os
// bens no nome delas. Cada pessoa recebe a tarefa na própria tela.
class CreatePossessionChecksOperation {
  constructor({ possessionCheckRepository, userRepository, assetRepository, numberingService, auditService }) {
    this.possessionCheckRepository = possessionCheckRepository;
    this.userRepository = userRepository;
    this.assetRepository = assetRepository;
    this.numberingService = numberingService;
    this.auditService = auditService;
  }

  async execute({ actor, user_ids }) {
    const users = await this.userRepository.findByIds([...new Set(user_ids)]);
    if (!users.length) throw httpError(404, 'Nenhuma pessoa encontrada');

    const created = [];
    const skipped = [];
    for (const user of users) {
      const [pending] = await this.possessionCheckRepository.find({ user_id: user.user_id, status: 'pendente' });
      if (pending) { skipped.push({ name: user.name, reason: 'já tem uma validação pendente' }); continue; }
      const assets = await this.assetRepository.findByResponsible(user.name);
      if (!assets.length) { skipped.push({ name: user.name, reason: 'não tem bens no nome' }); continue; }

      const check = await this.possessionCheckRepository.create({
        check_id: uuidv4(),
        number: await this.numberingService.next('VAL'),
        user_id: user.user_id,
        user_name: user.name,
        requested_by: actor.user_id,
        requested_by_name: actor.name || '',
        items: assets.map(a => ({ asset_id: a.asset_id, code: a.code, description: a.description, location: a.location })),
      });
      created.push(formatPossessionCheck(check));
      await this.auditService.log({ actor_id: actor.user_id, action: 'possession.request', resource_type: 'possession_check', resource_id: check.check_id });
    }

    logger.info('possession.request', { created: created.length, skipped: skipped.length });
    return { created, skipped };
  }
}

module.exports = CreatePossessionChecksOperation;
