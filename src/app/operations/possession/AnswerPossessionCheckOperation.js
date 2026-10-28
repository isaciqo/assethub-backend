const { v4: uuidv4 } = require('uuid');
const httpError = require('../../../lib/httpError');
const logger = require('../../../lib/logger');
const { formatPossessionCheck } = require('../../../lib/formatters');

// A pessoa responde a validação. "Está comigo" fica na linha do tempo do bem;
// "não está" abre uma pendência de não localizado para o gerente decidir —
// o cadastro nunca muda sozinho.
class AnswerPossessionCheckOperation {
  constructor({ possessionCheckRepository, assetRepository, discrepancyRepository, assetEventService, auditService }) {
    this.possessionCheckRepository = possessionCheckRepository;
    this.assetRepository = assetRepository;
    this.discrepancyRepository = discrepancyRepository;
    this.assetEventService = assetEventService;
    this.auditService = auditService;
  }

  async execute({ actor, check_id, answers }) {
    const check = await this.possessionCheckRepository.findById(check_id);
    if (!check) throw httpError(404, 'Validação não encontrada');
    if (check.user_id !== actor.user_id) throw httpError(403, 'Esta validação é de outra pessoa');
    if (check.status !== 'pendente') throw httpError(409, 'Esta validação já foi respondida');

    const byAsset = Object.fromEntries(answers.map(a => [a.asset_id, a]));
    const missingAnswer = check.items.find(i => !byAsset[i.asset_id]);
    if (missingAnswer) throw httpError(400, `Responda o bem ${missingAnswer.code}`);

    const items = check.items.map(i => ({
      ...i.toObject(),
      has_it: !!byAsset[i.asset_id].has_it,
      note: String(byAsset[i.asset_id].note || '').trim(),
    }));
    const assets = await this.assetRepository.findByIds(items.map(i => i.asset_id));
    const assetMap = Object.fromEntries(assets.map(a => [a.asset_id, a]));

    const missing = items.filter(i => !i.has_it && assetMap[i.asset_id]);
    await this.discrepancyRepository.createMany(missing.map(i => {
      const a = assetMap[i.asset_id];
      return {
        discrepancy_id: uuidv4(),
        source: 'validacao',
        possession_check_id: check_id,
        unit_id: a.unit_id,
        asset_id: a.asset_id,
        asset_code: a.code,
        type: 'nao_localizado',
        expected: { location: a.location, responsible_name: a.responsible_name },
        observed: { note: i.note },
      };
    }));

    await this.assetEventService.recordMany(items.filter(i => assetMap[i.asset_id]).map(i => ({
      asset_id: i.asset_id,
      event_type: i.has_it ? 'posse_confirmada' : 'posse_nao_confirmada',
      summary: i.has_it
        ? `${actor.name} confirmou que está com o bem (${check.number})`
        : `${actor.name} informou que não está com o bem (${check.number})${i.note ? ` — "${i.note}"` : ''}`,
      actor,
      reference_type: 'possession_check',
      reference_id: check_id,
    })));

    const saved = await this.possessionCheckRepository.update(check_id, { items, status: 'respondida', answered_at: new Date() });
    await this.auditService.log({ actor_id: actor.user_id, action: 'possession.answer', resource_type: 'possession_check', resource_id: check_id, metadata: { missing: missing.length } });
    logger.info('possession.answer', { check_id, items: items.length, missing: missing.length });
    return formatPossessionCheck(saved);
  }
}

module.exports = AnswerPossessionCheckOperation;
