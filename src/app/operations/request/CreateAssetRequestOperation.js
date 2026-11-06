const { v4: uuidv4 } = require('uuid');
const httpError = require('../../../lib/httpError');
const { REQUEST_CATALOG } = require('../../../lib/constants');
const { normalize } = require('../../../lib/text');
const { formatAssetRequest } = require('../../../lib/formatters');

// Qualquer perfil pede um bem — inclusive o servidor, pela Minha área. Destino
// padrão: a comarca da pessoa e o setor onde está a maioria dos bens no nome dela.
class CreateAssetRequestOperation {
  constructor({ assetRequestRepository, assetRepository, unitRepository, numberingService, evidenceService, auditService }) {
    this.assetRequestRepository = assetRequestRepository;
    this.assetRepository = assetRepository;
    this.unitRepository = unitRepository;
    this.numberingService = numberingService;
    this.evidenceService = evidenceService;
    this.auditService = auditService;
  }

  async defaultPlace(actor) {
    const mine = await this.assetRepository.findByResponsible(actor.name);
    const count = {};
    mine.forEach(a => { const k = `${a.unit_id}|${a.location}`; count[k] = (count[k] || 0) + 1; });
    const [best] = Object.entries(count).sort((a, b) => b[1] - a[1]);
    if (!best) return { unit_id: actor.unit_id, sector: '' };
    const [unit_id, sector] = best[0].split('|');
    return { unit_id, sector };
  }

  async execute({ actor, data }) {
    const place = data.unit_id && data.sector ? data : { ...(await this.defaultPlace(actor)), ...data };
    const unit_id = place.unit_id || actor.unit_id;
    if (!unit_id || !await this.unitRepository.findById(unit_id)) throw httpError(400, 'Informe a comarca de destino');

    // Pedido feito a um setor: com responsável definido, vai primeiro para ele.
    let source = {};
    let status = 'aberta';
    if (data.source_unit_id && data.source_sector) {
      const sourceUnit = await this.unitRepository.findById(data.source_unit_id);
      if (!sourceUnit) throw httpError(400, 'Comarca do setor não encontrada');
      const owner = (sourceUnit.sector_owners || []).find(o => o.location === data.source_sector);
      source = {
        source_unit_id: sourceUnit.unit_id,
        source_sector: data.source_sector,
        source_owner_id: owner?.user_id || null,
        source_owner_name: owner?.user_name || '',
      };
      if (owner && owner.user_id !== actor.user_id) status = 'aguardando_setor';
    }

    // Item digitado ("Mouse sem fio") também acha a categoria pelo item do catálogo
    // contido no texto — sem categoria, não há bem parado para sugerir.
    const catalog = REQUEST_CATALOG.find(c => normalize(c.item) === normalize(data.item))
      || REQUEST_CATALOG.find(c => normalize(data.item).includes(normalize(c.item).split(' ')[0]));
    const request_id = uuidv4();
    const number = await this.numberingService.next('SOL');

    let attachment_evidence_id = null;
    if (data.attachment) {
      const evidence = await this.evidenceService.store({
        dataUrl: data.attachment,
        owner_type: 'request',
        owner_id: request_id,
        kind: 'documento',
        actor,
        description: `Anexo da solicitação ${number}`,
        file_name: data.attachment_name || '',
      });
      attachment_evidence_id = evidence.evidence_id;
    }

    const request = await this.assetRequestRepository.create({
      request_id,
      number,
      requested_by: actor.user_id,
      requested_by_name: actor.name || '',
      unit_id,
      sector: place.sector || '',
      room: data.room || '',
      ...source,
      status,
      item: data.item.trim(),
      category: data.category || catalog?.category || '',
      quantity: data.quantity || 1,
      justification: data.justification.trim(),
      urgency: data.urgency || 'normal',
      attachment_evidence_id,
      history: [{
        at: new Date(), by: actor.user_id, by_name: actor.name || '', action: 'criada',
        note: source.source_sector ? `Pedido ao setor ${source.source_sector}${status === 'aguardando_setor' ? ` (${source.source_owner_name})` : ' (sem responsável: segue para o patrimônio)'}` : '',
      }],
    });
    await this.auditService.log({ actor_id: actor.user_id, action: 'request.create', resource_type: 'request', resource_id: request_id });
    return formatAssetRequest(request);
  }
}

module.exports = CreateAssetRequestOperation;
