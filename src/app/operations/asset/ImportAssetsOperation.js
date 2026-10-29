const { v4: uuidv4 } = require('uuid');
const httpError = require('../../../lib/httpError');
const logger = require('../../../lib/logger');
const { normalizeCode, normalize } = require('../../../lib/text');
const { formatUnit } = require('../../../lib/formatters');

// Campos que a planilha oficial pode atualizar num bem já existente.
const UPDATABLE = ['code', 'description', 'category', 'brand', 'serial_number', 'unit_id', 'location', 'room', 'responsible_name', 'conservation_status', 'acquisition_date', 'value', 'notes'];

function unitCodeFrom(name) {
  const words = normalize(name).split(' ').filter(w => w.length > 2 && !['de', 'da', 'do', 'das', 'dos'].includes(w));
  return (words.map(w => w[0]).join('') || 'UN').toUpperCase().slice(0, 6);
}

// Uma operação para prévia e importação: com dryRun nada é gravado, mas o
// relatório (novos, atualizados, erros por linha) é exatamente o que seria aplicado.
class ImportAssetsOperation {
  constructor({ importParserService, assetRepository, unitRepository, assetEventService, auditService }) {
    this.importParserService = importParserService;
    this.assetRepository = assetRepository;
    this.unitRepository = unitRepository;
    this.assetEventService = assetEventService;
    this.auditService = auditService;
  }

  async execute({ buffer, fileName, mapping, default_unit_id, dryRun = false, actor }) {
    if (!buffer || !buffer.length) throw httpError(400, 'Envie um arquivo CSV ou XLSX');

    let parsed;
    try {
      parsed = await this.importParserService.parse(buffer, fileName);
    } catch (err) {
      logger.warn('import: arquivo ilegível', { fileName, error: err.message });
      throw httpError(400, 'Não foi possível ler o arquivo. Verifique se é um CSV ou XLSX válido.');
    }
    if (!parsed.headers.length) throw httpError(400, 'A planilha está vazia');

    const effectiveMapping = mapping && Object.keys(mapping).length
      ? mapping
      : this.importParserService.suggestMapping(parsed.headers);
    const missing = ['code', 'description'].filter(f => !effectiveMapping[f]);

    const base = {
      fileName,
      headers: parsed.headers,
      mapping: effectiveMapping,
      totalRows: parsed.rows.length,
      missingRequired: missing,
    };
    if (missing.length) return { ...base, dryRun: true, created: 0, updated: 0, unchanged: 0, errors: [], warnings: [], createdUnits: [], sample: [] };

    const { records, errors } = this.importParserService.mapRows(parsed, effectiveMapping);
    const warnings = records
      .filter(r => r.conservation_warning)
      .map(r => ({ line: r.line, code: r.code, message: `Estado "${r.conservation_warning}" não reconhecido — importado como "bom"` }));

    const defaultUnit = default_unit_id ? await this.unitRepository.findById(default_unit_id) : null;
    if (default_unit_id && !defaultUnit) throw httpError(404, 'Comarca padrão não encontrada');

    // Resolve as unidades citadas na planilha (código ou nome), criando as que
    // não existem — só de verdade quando não é prévia.
    const unitCache = new Map();
    const createdUnits = [];
    const resolveUnit = async name => {
      const key = normalize(name);
      if (unitCache.has(key)) return unitCache.get(key);
      let unit = await this.unitRepository.findByCodeOrName(name);
      if (!unit) {
        const draft = { unit_id: uuidv4(), name: name.trim(), code: `${unitCodeFrom(name)}${createdUnits.length + 1}`, kind: 'comarca', region: 'interior', locations: [] };
        unit = dryRun ? draft : await this.unitRepository.create(draft);
        createdUnits.push(formatUnit(unit));
      }
      unitCache.set(key, unit);
      return unit;
    };

    const valid = [];
    for (const r of records) {
      const unit = r.unit ? await resolveUnit(r.unit) : defaultUnit;
      if (!unit) {
        errors.push({ line: r.line, code: r.code, message: 'Comarca não informada na linha e nenhuma comarca padrão selecionada' });
        continue;
      }
      valid.push({ ...r, unit_id: unit.unit_id, code_normalized: normalizeCode(r.code) });
    }

    const existing = await this.assetRepository.findByNormalizedCodes(valid.map(v => v.code_normalized));
    const existingMap = new Map(existing.map(a => [a.code_normalized, a]));

    const ops = [];
    const events = [];
    let created = 0;
    let updated = 0;
    let unchanged = 0;

    valid.forEach(r => {
      const data = {
        code: r.code,
        description: r.description,
        category: r.category,
        brand: r.brand,
        serial_number: r.serial_number,
        unit_id: r.unit_id,
        location: r.location,
        room: r.room,
        responsible_name: r.responsible_name,
        conservation_status: r.conservation_status,
        acquisition_date: r.acquisition_date,
        value: r.value,
        notes: r.notes,
      };
      const current = existingMap.get(r.code_normalized);

      if (!current) {
        created += 1;
        const asset_id = uuidv4();
        ops.push({ insertOne: { document: { asset_id, code_normalized: r.code_normalized, status: 'ativo', ...data } } });
        events.push({ asset_id, event_type: 'importado', summary: `Cadastrado pela importação de "${fileName}"`, actor, reference_type: 'import', changes: null });
        return;
      }

      const changes = {};
      UPDATABLE.forEach(field => {
        const before = current[field] instanceof Date ? current[field].toISOString().slice(0, 10) : (current[field] ?? '');
        const after = data[field] instanceof Date ? data[field].toISOString().slice(0, 10) : (data[field] ?? '');
        if (String(before) !== String(after)) changes[field] = { from: current[field] ?? null, to: data[field] ?? null };
      });
      if (!Object.keys(changes).length) { unchanged += 1; return; }

      updated += 1;
      ops.push({ updateOne: { filter: { asset_id: current.asset_id }, update: { $set: data } } });
      events.push({ asset_id: current.asset_id, event_type: 'atualizado_importacao', summary: `Atualizado pela importação de "${fileName}"`, actor, reference_type: 'import', changes });
    });

    const report = {
      ...base,
      dryRun,
      created,
      updated,
      unchanged,
      errors,
      warnings,
      createdUnits,
      sample: valid.slice(0, 8).map(v => ({
        line: v.line,
        code: v.code,
        description: v.description,
        category: v.category,
        unitId: v.unit_id,
        location: v.location,
        room: v.room,
        responsibleName: v.responsible_name,
        conservationStatus: v.conservation_status,
        isNew: !existingMap.has(v.code_normalized),
      })),
    };

    if (dryRun) return report;

    await this.assetRepository.bulkWrite(ops);
    await this.assetEventService.recordMany(events);

    const locationsByUnit = valid.reduce((acc, v) => {
      if (v.location) (acc[v.unit_id] = acc[v.unit_id] || []).push(v.location);
      return acc;
    }, {});
    await Promise.all(Object.entries(locationsByUnit).map(([unit_id, locs]) => this.unitRepository.addLocations(unit_id, locs)));

    await this.auditService.log({
      actor_id: actor.user_id,
      action: 'asset.import',
      resource_type: 'asset',
      metadata: { fileName, created, updated, unchanged, errors: errors.length },
    });
    logger.info('import: concluída', { fileName, created, updated, unchanged, errors: errors.length });
    return report;
  }
}

module.exports = ImportAssetsOperation;
