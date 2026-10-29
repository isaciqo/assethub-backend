const PdfService = require('../../services/PdfService');

const COLUMNS = [
  { key: 'code', header: 'Tombamento', width: 14 },
  { key: 'description', header: 'Descrição', width: 40 },
  { key: 'category', header: 'Categoria', width: 18 },
  { key: 'brand', header: 'Marca/Modelo', width: 18 },
  { key: 'serial_number', header: 'Nº de série', width: 16 },
  { key: 'unit', header: 'Comarca', width: 28 },
  { key: 'location', header: 'Setor', width: 28 },
  { key: 'room', header: 'Sala', width: 18 },
  { key: 'responsible_name', header: 'Responsável', width: 24 },
  { key: 'conservation', header: 'Estado de conservação', width: 18 },
  { key: 'status', header: 'Situação', width: 16 },
  { key: 'last_checked_at', header: 'Última conferência', width: 20 },
];

const STATUS_LABEL = { ativo: 'Ativo', em_movimentacao: 'Em movimentação', nao_localizado: 'Não localizado', baixado: 'Baixado' };

class ExportAssetsOperation {
  constructor({ assetRepository, unitRepository, exportService }) {
    this.assetRepository = assetRepository;
    this.unitRepository = unitRepository;
    this.exportService = exportService;
  }

  async execute({ format = 'xlsx', ...filters }) {
    const [assets, units] = await Promise.all([this.assetRepository.findAll(filters), this.unitRepository.findAll()]);
    const unitName = Object.fromEntries(units.map(u => [u.unit_id, u.name]));
    const rows = assets.map(a => ({
      code: a.code,
      description: a.description,
      category: a.category,
      brand: a.brand,
      serial_number: a.serial_number,
      unit: unitName[a.unit_id] || a.unit_id,
      location: a.location,
      room: a.room,
      responsible_name: a.responsible_name,
      conservation: PdfService.LABELS.conservation[a.conservation_status],
      status: STATUS_LABEL[a.status],
      last_checked_at: a.last_checked_at ? a.last_checked_at.toLocaleString('pt-BR', { timeZone: 'America/Belem' }) : '',
    }));

    const stamp = new Date().toISOString().slice(0, 10);
    if (format === 'csv') {
      return { buffer: this.exportService.toCsv(COLUMNS, rows), mime: 'text/csv; charset=utf-8', fileName: `bens-${stamp}.csv` };
    }
    const buffer = await this.exportService.toXlsx([{ name: 'Bens', columns: COLUMNS, rows }]);
    return { buffer, mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', fileName: `bens-${stamp}.xlsx` };
  }
}

ExportAssetsOperation.COLUMNS = COLUMNS;

module.exports = ExportAssetsOperation;
