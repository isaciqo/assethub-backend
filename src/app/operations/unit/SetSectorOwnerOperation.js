const httpError = require('../../../lib/httpError');
const { formatUnit } = require('../../../lib/formatters');

// Define quem responde pelos pedidos de bens feitos a um setor. Sem
// responsável (user_id vazio), os pedidos ao setor seguem para o patrimônio.
class SetSectorOwnerOperation {
  constructor({ unitRepository, userRepository, auditService }) {
    this.unitRepository = unitRepository;
    this.userRepository = userRepository;
    this.auditService = auditService;
  }

  async execute({ actor, unit_id, location, user_id }) {
    const unit = await this.unitRepository.findById(unit_id);
    if (!unit) throw httpError(404, 'Comarca não encontrada');
    if (!(unit.locations || []).includes(location)) throw httpError(400, 'Setor não encontrado nesta comarca');
    const user = user_id ? await this.userRepository.findById(user_id) : null;
    if (user_id && !user) throw httpError(404, 'Pessoa não encontrada');

    const owners = (unit.sector_owners || []).filter(o => o.location !== location);
    if (user) owners.push({ location, user_id: user.user_id, user_name: user.name });
    const saved = await this.unitRepository.update(unit_id, { sector_owners: owners });
    await this.auditService.log({
      actor_id: actor.user_id, action: 'unit.sector_owner', resource_type: 'unit', resource_id: unit_id,
      metadata: { location, user_id: user?.user_id || null },
    });
    return formatUnit(saved);
  }
}

module.exports = SetSectorOwnerOperation;
