const { v4: uuidv4 } = require('uuid');
const logger = require('../../../lib/logger');
const { formatCheck } = require('../../../lib/formatters');

const isDuplicateKey = err => err && (err.code === 11000 || err.code === 11001);

// Recebe as conferências feitas no aparelho (online ou offline) e grava cada uma
// de forma idempotente. Resultado por operação:
//   applied             gravada agora
//   duplicate_operation já tinha sido gravada antes (reenvio) — nada muda
//   duplicate_check     outro registro já conferiu este bem neste inventário;
//                       gravada como duplicada + pendência para revisão
//   rejected            não pode ser aplicada (inventário encerrado/inexistente)
// O aparelho só marca SYNCED o que voltar como applied/duplicate_*.
class SyncChecksOperation {
  constructor({
    inventoryRepository, inventoryCheckRepository, assetRepository, discrepancyRepository,
    unitRepository, discrepancyDetectionService, evidenceService, assetEventService, geoService,
  }) {
    this.inventoryRepository = inventoryRepository;
    this.inventoryCheckRepository = inventoryCheckRepository;
    this.assetRepository = assetRepository;
    this.discrepancyRepository = discrepancyRepository;
    this.unitRepository = unitRepository;
    this.discrepancyDetectionService = discrepancyDetectionService;
    this.evidenceService = evidenceService;
    this.assetEventService = assetEventService;
    this.geoService = geoService;
  }

  async execute({ actor, operations }) {
    const inventories = new Map();
    const results = [];
    for (const op of operations) {
      try {
        results.push(await this.applyOne(actor, op, inventories));
      } catch (err) {
        // Uma operação problemática não pode travar o lote inteiro — o aparelho
        // recebe "failed" só nela e tenta de novo depois.
        logger.error('sync: falha ao aplicar operação', { operation_id: op.operation_id, error: err.message, stack: err.stack });
        results.push({ operationId: op.operation_id, result: 'failed', message: err.statusCode ? err.message : 'Erro interno ao gravar a conferência' });
      }
    }

    const tally = results.reduce((acc, r) => ({ ...acc, [r.result]: (acc[r.result] || 0) + 1 }), {});
    logger.info('sync: lote processado', { total: operations.length, ...tally });
    return { results, serverTime: new Date().toISOString() };
  }

  async loadInventory(inventory_id, cache) {
    if (!cache.has(inventory_id)) cache.set(inventory_id, await this.inventoryRepository.findById(inventory_id));
    return cache.get(inventory_id);
  }

  async loadUnit(unit_id, cache) {
    const key = `unit:${unit_id}`;
    if (!cache.has(key)) cache.set(key, await this.unitRepository.findById(unit_id));
    return cache.get(key);
  }

  async applyOne(actor, op, inventories) {
    const previous = await this.inventoryCheckRepository.findByOperationId(op.operation_id);
    if (previous) return { operationId: op.operation_id, result: 'duplicate_operation', check: formatCheck(previous) };

    const inventory = await this.loadInventory(op.inventory_id, inventories);
    if (!inventory) return { operationId: op.operation_id, result: 'rejected', reason: 'inventory_not_found', message: 'Inventário não encontrado' };
    if (inventory.status !== 'em_andamento') {
      return { operationId: op.operation_id, result: 'rejected', reason: 'inventory_closed', message: `O inventário ${inventory.number} foi encerrado antes desta sincronização` };
    }

    let asset = op.asset_id ? await this.assetRepository.findById(op.asset_id) : null;
    if (!asset) asset = await this.assetRepository.findByCode(op.asset_code);

    const observed = {
      location: op.observed_location || '',
      condition: op.observed_condition || null,
      responsible: op.observed_responsible || '',
      description: op.observed_description || '',
    };
    const detection = this.discrepancyDetectionService.detect({ asset, inventory, observed });

    // Relógio do aparelho pode estar errado; data no futuro vira "agora".
    const now = new Date();
    let checkedAt = new Date(op.checked_at);
    if (Number.isNaN(checkedAt.getTime()) || checkedAt > new Date(now.getTime() + 5 * 60 * 1000)) checkedAt = now;

    const check = {
      check_id: uuidv4(),
      operation_id: op.operation_id,
      inventory_id: inventory.inventory_id,
      asset_id: asset ? asset.asset_id : null,
      asset_code: asset ? asset.code : op.asset_code,
      observed_location: observed.location,
      observed_condition: op.observed_condition || (asset ? asset.conservation_status : 'bom'),
      observed_responsible: observed.responsible,
      observed_description: observed.description,
      notes: op.notes || '',
      check_status: detection.check_status,
      is_primary: true,
      method: op.method || 'manual',
      elapsed_ms: Number.isFinite(op.elapsed_ms) ? op.elapsed_ms : null,
      device_id: op.device_id || '',
      checked_by: actor.user_id,
      checked_by_name: actor.name || '',
      checked_at: checkedAt,
      synced_at: now,
      was_offline: !!op.was_offline,
      geo: this.geoService.assess(op.geo, await this.loadUnit(inventory.unit_id, inventories)),
    };

    let result = 'applied';
    let saved;
    // Código desconhecido lido duas vezes também é duplicidade — senão o mesmo
    // "bem não cadastrado" geraria duas pendências iguais.
    let firstCheck = asset
      ? await this.inventoryCheckRepository.findPrimary(inventory.inventory_id, asset.asset_id)
      : await this.inventoryCheckRepository.findPrimaryUnregistered(inventory.inventory_id, op.asset_code);

    if (!firstCheck) {
      try {
        saved = await this.inventoryCheckRepository.create(check);
      } catch (err) {
        if (!isDuplicateKey(err)) throw err;
        // Corrida: dois aparelhos sincronizando ao mesmo tempo. Descobre qual
        // índice único barrou para saber se é reenvio ou conferência duplicada.
        const raced = await this.inventoryCheckRepository.findByOperationId(op.operation_id);
        if (raced) return { operationId: op.operation_id, result: 'duplicate_operation', check: formatCheck(raced) };
        if (!asset) throw err;
        firstCheck =await this.inventoryCheckRepository.findPrimary(inventory.inventory_id, asset.asset_id);
      }
    }

    if (firstCheck) {
      result = 'duplicate_check';
      saved = await this.inventoryCheckRepository.create({ ...check, is_primary: false, check_status: 'duplicada' });
    }

    if (op.photo) {
      const evidence = await this.evidenceService.store({
        dataUrl: op.photo,
        owner_type: 'check',
        owner_id: saved.check_id,
        stage: 'conferencia',
        kind: 'foto',
        actor,
        description: `Foto da conferência do bem ${saved.asset_code}`,
      });
      saved = await this.inventoryCheckRepository.update(saved.check_id, { photo_evidence_id: evidence.evidence_id });
    }

    const discrepancies = result === 'duplicate_check'
      ? [{
        type: 'conferencia_duplicada',
        expected: { check_id: firstCheck.check_id, checked_by_name: firstCheck.checked_by_name, checked_at: firstCheck.checked_at, location: firstCheck.observed_location, condition: firstCheck.observed_condition },
        observed: { check_id: saved.check_id, checked_by_name: saved.checked_by_name, checked_at: saved.checked_at, location: saved.observed_location, condition: saved.observed_condition },
      }]
      : detection.discrepancies;

    await this.discrepancyRepository.createMany(discrepancies.map(d => ({
      discrepancy_id: uuidv4(),
      inventory_id: inventory.inventory_id,
      unit_id: inventory.unit_id,
      asset_id: saved.asset_id,
      asset_code: saved.asset_code,
      check_id: saved.check_id,
      type: d.type,
      expected: d.expected,
      observed: d.observed,
    })));

    if (asset && result === 'applied') {
      await this.assetRepository.update(asset.asset_id, { last_checked_at: checkedAt });
      await this.assetEventService.record({
        asset_id: asset.asset_id,
        event_type: 'conferido',
        summary: detection.discrepancies.length
          ? `Conferido no ${inventory.number} com ${detection.discrepancies.length} divergência(s)`
          : `Conferido no ${inventory.number} sem divergências`,
        actor,
        reference_type: 'inventory',
        reference_id: inventory.inventory_id,
        occurred_at: checkedAt,
      });
    }
    if (observed.location && (!asset || asset.unit_id === inventory.unit_id)) {
      await this.unitRepository.addLocations(inventory.unit_id, [observed.location]);
    }

    return {
      operationId: op.operation_id,
      result,
      check: formatCheck(saved),
      discrepancies: discrepancies.map(d => d.type),
    };
  }
}

module.exports = SyncChecksOperation;
