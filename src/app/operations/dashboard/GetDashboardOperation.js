const { formatInventory, formatAssetEvent } = require('../../../lib/formatters');

// Painel do gestor: situação do acervo, inventários em curso, pendências,
// movimentações e as métricas de produtividade que sustentam o pitch
// (tempo médio por bem, conferências offline, equidade capital × interior).
class GetDashboardOperation {
  constructor({
    assetRepository, unitRepository, inventoryRepository, inventoryCheckRepository, discrepancyRepository,
    movementRepository, assetEventRepository, inventorySummaryService,
  }) {
    this.assetRepository = assetRepository;
    this.unitRepository = unitRepository;
    this.inventoryRepository = inventoryRepository;
    this.inventoryCheckRepository = inventoryCheckRepository;
    this.discrepancyRepository = discrepancyRepository;
    this.movementRepository = movementRepository;
    this.assetEventRepository = assetEventRepository;
    this.inventorySummaryService = inventorySummaryService;
  }

  async execute() {
    const [units, byStatus, byCondition, byUnit, openInventories, checkStats, byMethod, discByType, movByStatus, recent, totalAssets] = await Promise.all([
      this.unitRepository.findAll(),
      this.assetRepository.countBy('status'),
      this.assetRepository.countBy('conservation_status'),
      this.assetRepository.countBy('unit_id'),
      this.inventoryRepository.find({ status: 'em_andamento' }),
      this.inventoryCheckRepository.stats(),
      this.inventoryCheckRepository.countByMethod(),
      this.discrepancyRepository.countBy('type', { status: 'aberta' }),
      this.movementRepository.countBy('status'),
      this.assetEventRepository.findRecent(12),
      this.assetRepository.count(),
    ]);

    const toMap = rows => Object.fromEntries(rows.map(r => [r._id, r.count]));
    const unitAssets = toMap(byUnit);

    const inventories = await Promise.all(openInventories.map(async inv => formatInventory(inv, {
      summary: await this.inventorySummaryService.summarize(inv),
    })));

    // Cobertura por unidade: % de bens conferidos nos últimos 12 meses. É o
    // indicador de "equidade entre capital e interior" que o desafio cobra.
    const since = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const recentMap = toMap(await this.assetRepository.countCheckedSinceByUnit(since));

    const coverage = units.map(u => ({
      unitId: u.unit_id,
      name: u.name,
      code: u.code,
      region: u.region,
      assets: unitAssets[u.unit_id] || 0,
      checked: recentMap[u.unit_id] || 0,
      pct: unitAssets[u.unit_id] ? Math.round(((recentMap[u.unit_id] || 0) / unitAssets[u.unit_id]) * 100) : 0,
    }));

    const regionPct = region => {
      const rows = coverage.filter(c => c.region === region);
      const assets = rows.reduce((s, r) => s + r.assets, 0);
      const checked = rows.reduce((s, r) => s + r.checked, 0);
      return assets ? Math.round((checked / assets) * 100) : 0;
    };

    return {
      totals: {
        assets: totalAssets,
        units: units.length,
        openInventories: openInventories.length,
        openDiscrepancies: Object.values(toMap(discByType)).reduce((s, n) => s + n, 0),
        movementsInProgress: ['aguardando_aprovacao', 'aprovada', 'em_transito', 'com_pendencia']
          .reduce((s, k) => s + (toMap(movByStatus)[k] || 0), 0),
      },
      assetsByStatus: toMap(byStatus),
      assetsByCondition: toMap(byCondition),
      discrepanciesByType: toMap(discByType),
      movementsByStatus: toMap(movByStatus),
      productivity: {
        totalChecks: checkStats.total,
        offlineChecks: checkStats.offline,
        avgSecondsPerAsset: checkStats.avg_elapsed_ms ? Number((checkStats.avg_elapsed_ms / 1000).toFixed(1)) : null,
        byMethod: toMap(byMethod),
      },
      coverage,
      equity: { capital: regionPct('capital'), interior: regionPct('interior') },
      inventories,
      recentActivity: recent.map(formatAssetEvent),
    };
  }
}

module.exports = GetDashboardOperation;
