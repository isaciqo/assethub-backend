const httpError = require('../../lib/httpError');
const { REQUEST_OPEN_STATUS } = require('../../lib/constants');
const { normalize } = require('../../lib/text');

// Regras comuns das solicitações de bem: quem pode ver, em que situação ainda
// dá para decidir e como cada passo entra no histórico.
class AssetRequestService {
  constructor({ assetRequestRepository, assetRepository, movementPolicyService }) {
    this.assetRequestRepository = assetRequestRepository;
    this.assetRepository = assetRepository;
    this.movementPolicyService = movementPolicyService;
  }

  async load(request_id, actor) {
    const request = await this.assetRequestRepository.findById(request_id);
    if (!request) throw httpError(404, 'Solicitação não encontrada');
    if (!this.movementPolicyService.isManager(actor) && request.requested_by !== actor.user_id) {
      throw httpError(403, 'Esta solicitação é de outra pessoa');
    }
    return request;
  }

  assertOpen(request) {
    if (!REQUEST_OPEN_STATUS.includes(request.status)) throw httpError(409, 'Esta solicitação já foi decidida');
  }

  entry(actor, action, note = '') {
    return { at: new Date(), by: actor.user_id, by_name: actor.name || '', action, note };
  }

  // Bens parados que podem atender o pedido antes de qualquer compra: ativos,
  // sem movimentação em curso, em bom estado e sem dono (ou guardados num
  // almoxarifado), da mesma categoria. Primeiro os da mesma comarca.
  async availableFor(request) {
    if (!request.category) return [];
    const assets = await this.assetRepository.findAll({ category: request.category, status: 'ativo' });
    const rank = { novo: 0, bom: 1, regular: 2 };
    const stored = a => /almoxarifado|deposito/.test(normalize(`${a.location} ${a.room}`));
    return assets
      .filter(a => !a.active_movement_id && a.conservation_status in rank && (!String(a.responsible_name || '').trim() || stored(a)))
      .sort((a, b) => (a.unit_id === request.unit_id ? 0 : 1) - (b.unit_id === request.unit_id ? 0 : 1)
        || rank[a.conservation_status] - rank[b.conservation_status]
        || String(a.code).localeCompare(String(b.code)));
  }
}

module.exports = AssetRequestService;
