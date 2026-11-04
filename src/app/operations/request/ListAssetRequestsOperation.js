const { formatAssetRequest } = require('../../../lib/formatters');

// Caixas: "meus" (o que a pessoa pediu), "setor" (pedidos feitos aos setores
// que ela responde) e, para o gestor, a fila inteira do patrimônio.
class ListAssetRequestsOperation {
  constructor({ assetRequestRepository, unitRepository, movementPolicyService }) {
    this.assetRequestRepository = assetRequestRepository;
    this.unitRepository = unitRepository;
    this.movementPolicyService = movementPolicyService;
  }

  async execute({ actor, status, unit_id, sector, urgency, mine, box, from, to }) {
    const filter = {};
    if (box === 'setor') filter.source_owner_id = actor.user_id;
    else if (box === 'meus' || mine === true || mine === 'true') filter.requested_by = actor.user_id;
    else if (!this.movementPolicyService.isManager(actor)) filter.$or = [{ requested_by: actor.user_id }, { source_owner_id: actor.user_id }];
    if (status === 'abertas') filter.status = { $in: ['aberta', 'em_analise'] };
    else if (status) filter.status = status;
    if (unit_id) filter.unit_id = unit_id;
    if (sector) filter.sector = sector;
    if (urgency) filter.urgency = urgency;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      // "até" inclui o dia inteiro.
      if (to) filter.createdAt.$lt = new Date(new Date(to).getTime() + 24 * 60 * 60 * 1000);
    }
    const [list, units] = await Promise.all([this.assetRequestRepository.find(filter), this.unitRepository.findAll()]);
    const unitName = Object.fromEntries(units.map(u => [u.unit_id, u.name]));
    return list.map(r => ({ ...formatAssetRequest(r), unitName: unitName[r.unit_id] || '', sourceUnitName: unitName[r.source_unit_id] || '' }));
  }
}

module.exports = ListAssetRequestsOperation;
