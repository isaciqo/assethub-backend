const { formatInventory, formatAssetEvent } = require('../../../lib/formatters');
const { sectorKind } = require('../../../lib/sectors');

// Painel do gestor: situação do acervo, inventários em curso, pendências,
// movimentações e as métricas de produtividade que sustentam o pitch
// (tempo médio por bem, conferências offline, equidade capital × interior).
class GetDashboardOperation {
  constructor({
    assetRepository, unitRepository, inventoryRepository, inventoryCheckRepository, discrepancyRepository,
    movementRepository, assetEventRepository, inventorySummaryService, assetRequestRepository,
  }) {
    this.assetRequestRepository = assetRequestRepository;
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
    const [recentRows, sectorRows, openRequests] = await Promise.all([
      this.assetRepository.countCheckedSinceByUnit(since),
      this.assetRepository.coverageBySector(since),
      this.assetRequestRepository.countBy('urgency', { status: { $in: ['aberta', 'em_analise'] } }),
    ]);
    const requestMap = toMap(openRequests);
    const recentMap = toMap(recentRows);
    const pct = (checked, assets) => (assets ? Math.round((checked / assets) * 100) : 0);

    // Dentro de cada comarca, a mesma cobertura por setor (vara, gabinete…), do
    // menos conferido para o mais — é onde o gestor precisa agir primeiro.
    const sectorsByUnit = sectorRows.reduce((acc, r) => {
      (acc[r._id.unit_id] = acc[r._id.unit_id] || []).push({
        name: r._id.location || '',
        kind: r._id.location ? sectorKind(r._id.location) : 'outro',
        assets: r.assets,
        checked: r.checked,
        pct: pct(r.checked, r.assets),
      });
      return acc;
    }, {});

    // Setor cadastrado e ainda sem bens também aparece (com 0) — senão uma vara
    // inteira some do painel justamente quando ninguém lançou o patrimônio dela.
    const withEmptySectors = (unit, rows) => [
      ...rows,
      ...(unit.locations || [])
        .filter(name => !rows.some(r => r.name === name))
        .map(name => ({ name, kind: sectorKind(name), assets: 0, checked: 0, pct: 0 })),
    ];

    const coverage = units.map(u => ({
      unitId: u.unit_id,
      name: u.name,
      code: u.code,
      kind: u.kind || (u.code === 'SEDE' ? 'sede' : 'comarca'),
      region: u.region,
      assets: unitAssets[u.unit_id] || 0,
      checked: recentMap[u.unit_id] || 0,
      pct: pct(recentMap[u.unit_id] || 0, unitAssets[u.unit_id] || 0),
      sectors: withEmptySectors(u, sectorsByUnit[u.unit_id] || [])
        .sort((a, b) => a.pct - b.pct || b.assets - a.assets || a.name.localeCompare(b.name, 'pt-BR')),
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
        openRequests: (requestMap.normal || 0) + (requestMap.urgente || 0),
        urgentRequests: requestMap.urgente || 0,
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
