const httpError = require('../../../lib/httpError');
const { formatAsset } = require('../../../lib/formatters');
const { normalize } = require('../../../lib/text');

// "Procurar na minha lista": o que o responsável pelo setor pode enviar — os
// bens do setor e os que estão no nome dele, ativos e fora de outra
// movimentação. Sem busca, os da mesma categoria do pedido vêm primeiro.
class ListRequestCandidatesOperation {
  constructor({ assetRequestService, assetRepository, movementPolicyService }) {
    this.assetRequestService = assetRequestService;
    this.assetRepository = assetRepository;
    this.movementPolicyService = movementPolicyService;
  }

  async execute({ actor, request_id, search = '' }) {
    const request = await this.assetRequestService.load(request_id, actor);
    if (!this.assetRequestService.isOwner(request, actor) && !this.movementPolicyService.isManager(actor)) {
      throw httpError(403, 'Só o responsável pelo setor vê esta lista');
    }
    const [inSector, mine] = await Promise.all([
      request.source_unit_id ? this.assetRepository.findAll({ unit_id: request.source_unit_id, location: request.source_sector, status: 'ativo' }) : [],
      this.assetRepository.findByResponsible(actor.name),
    ]);
    const seen = new Set();
    const q = normalize(search);
    const item = normalize(request.item);
    return [...inSector, ...mine]
      .filter(a => !seen.has(a.asset_id) && seen.add(a.asset_id))
      .filter(a => a.status === 'ativo' && !a.active_movement_id)
      .filter(a => !q || normalize(`${a.code} ${a.description} ${a.category} ${a.brand}`).includes(q))
      .map(a => ({ a, rank: (request.category && a.category === request.category ? 0 : 2) - (item && normalize(a.description).includes(item.split(' ')[0]) ? 1 : 0) }))
      .sort((x, y) => x.rank - y.rank || String(x.a.code).localeCompare(String(y.a.code)))
      .slice(0, 60)
      .map(({ a }) => formatAsset(a));
  }
}

module.exports = ListRequestCandidatesOperation;
