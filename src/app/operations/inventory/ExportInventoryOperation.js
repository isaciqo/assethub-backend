const httpError = require('../../../lib/httpError');
const PdfService = require('../../services/PdfService');

const fmt = d => (d ? new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Belem' }) : '');
const C = PdfService.LABELS.conservation;

const CHECK_STATUS_LABEL = {
  ok: 'Conferido sem divergência',
  divergente: 'Conferido com divergência',
  outra_unidade: 'Bem de outra unidade',
  nao_cadastrado: 'Bem não cadastrado',
  duplicada: 'Conferência duplicada',
};

const DISCREPANCY_LABEL = {
  nao_localizado: 'Não localizado',
  localizacao_divergente: 'Localização divergente',
  outra_unidade: 'Bem de outra unidade',
  nao_cadastrado: 'Bem não cadastrado',
  conferencia_duplicada: 'Conferência duplicada',
  estado_alterado: 'Estado de conservação alterado',
  responsavel_divergente: 'Responsável divergente',
};

const METHOD_LABEL = { qr: 'QR Code', barcode: 'Código de barras', ocr: 'Leitura da plaqueta (OCR)', manual: 'Digitação', busca: 'Busca' };

function describeDiff(d) {
  const e = d.expected || {};
  const o = d.observed || {};
  switch (d.type) {
    case 'localizacao_divergente': return `${e.location || '—'} → ${o.location || '—'}`;
    case 'estado_alterado': return `${C[e.condition] || '—'} → ${C[o.condition] || '—'}`;
    case 'responsavel_divergente': return `${e.responsible_name || '—'} → ${o.responsible_name || '—'}`;
    case 'outra_unidade': return `Cadastrado em outra unidade (${e.location || '—'}); encontrado em ${o.location || '—'}`;
    case 'nao_cadastrado': return `Encontrado em ${o.location || '—'}${o.description ? `: ${o.description}` : ''}`;
    case 'nao_localizado': return `Previsto em ${e.location || '—'}`;
    case 'conferencia_duplicada': return `1ª por ${e.checked_by_name || '—'}; repetida por ${o.checked_by_name || '—'}`;
    default: return '';
  }
}

class ExportInventoryOperation {
  constructor({ inventoryRepository, inventoryCheckRepository, discrepancyRepository, assetRepository, unitRepository, inventorySummaryService, exportService, pdfService }) {
    this.inventoryRepository = inventoryRepository;
    this.inventoryCheckRepository = inventoryCheckRepository;
    this.discrepancyRepository = discrepancyRepository;
    this.assetRepository = assetRepository;
    this.unitRepository = unitRepository;
    this.inventorySummaryService = inventorySummaryService;
    this.exportService = exportService;
    this.pdfService = pdfService;
  }

  async execute({ inventory_id, format = 'xlsx' }) {
    const inventory = await this.inventoryRepository.findById(inventory_id);
    if (!inventory) throw httpError(404, 'Inventário não encontrado');

    const [unit, checks, discrepancies, expectedAssets, summary] = await Promise.all([
      this.unitRepository.findById(inventory.unit_id),
      this.inventoryCheckRepository.findByInventory(inventory_id, { limit: 50000 }),
      this.discrepancyRepository.find({ inventory_id }),
      this.assetRepository.findByIds(inventory.expected_asset_ids),
      this.inventorySummaryService.summarize(inventory, { detailed: true }),
    ]);
    const assetMap = Object.fromEntries(expectedAssets.map(a => [a.asset_id, a]));
    const base = `${inventory.number}-${new Date().toISOString().slice(0, 10)}`;

    const discRows = discrepancies.map(d => ({
      code: d.asset_code,
      description: assetMap[d.asset_id]?.description || d.observed?.description || '',
      type: DISCREPANCY_LABEL[d.type] || d.type,
      detail: describeDiff(d),
      status: d.status === 'aberta' ? 'Aberta' : `Resolvida (${d.resolution?.action || ''})`,
      resolved_by: d.resolution?.resolved_by_name || '',
      note: d.resolution?.note || '',
    }));

    if (format === 'pdf') {
      const buffer = await this.pdfService.inventoryReport({ inventory, unit, summary, discrepancies: discRows, byLocation: summary.byLocation || [] });
      return { buffer, mime: 'application/pdf', fileName: `relatorio-${base}.pdf` };
    }

    const checkColumns = [
      { key: 'code', header: 'Tombamento', width: 14 },
      { key: 'description', header: 'Descrição', width: 38 },
      { key: 'status', header: 'Resultado', width: 26 },
      { key: 'expected_location', header: 'Local cadastrado', width: 20 },
      { key: 'observed_location', header: 'Local encontrado', width: 20 },
      { key: 'condition', header: 'Estado encontrado', width: 16 },
      { key: 'responsible', header: 'Responsável informado', width: 22 },
      { key: 'method', header: 'Identificação', width: 20 },
      { key: 'seconds', header: 'Tempo (s)', width: 10 },
      { key: 'checked_by', header: 'Conferido por', width: 22 },
      { key: 'checked_at', header: 'Data/hora', width: 20 },
      { key: 'offline', header: 'Offline', width: 9 },
      { key: 'notes', header: 'Observações', width: 30 },
    ];
    const checkRows = checks.map(c => ({
      code: c.asset_code,
      description: assetMap[c.asset_id]?.description || c.observed_description || '',
      status: CHECK_STATUS_LABEL[c.check_status],
      expected_location: assetMap[c.asset_id]?.location || '',
      observed_location: c.observed_location,
      condition: C[c.observed_condition],
      responsible: c.observed_responsible,
      method: METHOD_LABEL[c.method] || c.method,
      seconds: c.elapsed_ms ? Math.round(c.elapsed_ms / 100) / 10 : '',
      checked_by: c.checked_by_name,
      checked_at: fmt(c.checked_at),
      offline: c.was_offline ? 'Sim' : 'Não',
      notes: c.notes,
    }));

    if (format === 'csv') {
      return { buffer: this.exportService.toCsv(checkColumns, checkRows), mime: 'text/csv; charset=utf-8', fileName: `conferencias-${base}.csv` };
    }

    const checked = new Set(checks.filter(c => c.is_primary).map(c => c.asset_id));
    const pendingRows = expectedAssets.filter(a => !checked.has(a.asset_id)).map(a => ({
      code: a.code, description: a.description, location: a.location, responsible: a.responsible_name,
    }));

    const summaryRows = [
      ['Inventário', `${inventory.number} — ${inventory.name}`],
      ['Unidade', unit?.name || ''],
      ['Situação', inventory.status === 'concluido' ? 'Concluído' : 'Em andamento'],
      ['Início', fmt(inventory.started_at)],
      ['Encerramento', fmt(inventory.completed_at)],
      ['Bens previstos', summary.expected],
      ['Bens conferidos', summary.checked],
      ['Progresso (%)', summary.progress],
      ['Sem divergência', summary.ok],
      ['Com divergência', summary.divergent],
      ['Bens de outra unidade', summary.otherUnit],
      ['Bens não cadastrados', summary.notRegistered],
      ['Conferências duplicadas', summary.duplicates],
      ['Não localizados', summary.notFound],
      ['Pendências abertas', summary.openDiscrepancies],
      ['Tempo médio por bem (s)', summary.avgSeconds ? Number(summary.avgSeconds.toFixed(1)) : ''],
      ['Conferências offline', summary.offline],
    ].map(([k, v]) => ({ k, v }));

    const buffer = await this.exportService.toXlsx([
      { name: 'Resumo', columns: [{ key: 'k', header: 'Indicador', width: 30 }, { key: 'v', header: 'Valor', width: 40 }], rows: summaryRows },
      { name: 'Conferências', columns: checkColumns, rows: checkRows },
      {
        name: 'Pendências',
        columns: [
          { key: 'code', header: 'Tombamento', width: 14 },
          { key: 'description', header: 'Descrição', width: 36 },
          { key: 'type', header: 'Tipo', width: 26 },
          { key: 'detail', header: 'Cadastro × campo', width: 44 },
          { key: 'status', header: 'Situação', width: 26 },
          { key: 'resolved_by', header: 'Resolvida por', width: 22 },
          { key: 'note', header: 'Justificativa', width: 34 },
        ],
        rows: discRows,
      },
      {
        name: inventory.status === 'concluido' ? 'Não localizados' : 'Ainda não conferidos',
        columns: [
          { key: 'code', header: 'Tombamento', width: 14 },
          { key: 'description', header: 'Descrição', width: 40 },
          { key: 'location', header: 'Local cadastrado', width: 22 },
          { key: 'responsible', header: 'Responsável', width: 24 },
        ],
        rows: pendingRows,
      },
    ]);
    return { buffer, mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', fileName: `inventario-${base}.xlsx` };
  }
}

ExportInventoryOperation.DISCREPANCY_LABEL = DISCREPANCY_LABEL;

module.exports = ExportInventoryOperation;
