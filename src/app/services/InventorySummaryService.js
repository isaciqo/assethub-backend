// Números de um inventário, calculados sempre a partir das conferências
// gravadas — nunca de contadores mantidos à parte que poderiam desencontrar.
class InventorySummaryService {
  constructor({ inventoryCheckRepository, discrepancyRepository, assetRepository }) {
    this.inventoryCheckRepository = inventoryCheckRepository;
    this.discrepancyRepository = discrepancyRepository;
    this.assetRepository = assetRepository;
  }

  async summarize(inventory, { detailed = false } = {}) {
    const expectedIds = inventory.expected_asset_ids || [];
    const expectedSet = new Set(expectedIds);

    const [checkedIds, byStatus, stats, openDisc, notFoundDisc] = await Promise.all([
      this.inventoryCheckRepository.findPrimaryAssetIds(inventory.inventory_id),
      this.inventoryCheckRepository.countByStatus(inventory.inventory_id),
      this.inventoryCheckRepository.stats({ inventory_id: inventory.inventory_id }),
      this.discrepancyRepository.count({ inventory_id: inventory.inventory_id, status: 'aberta' }),
      this.discrepancyRepository.count({ inventory_id: inventory.inventory_id, type: 'nao_localizado' }),
    ]);

    const checkedExpected = checkedIds.filter(id => expectedSet.has(id));
    const statusCount = Object.fromEntries(byStatus.map(s => [s._id, s.count]));
    const expected = expectedIds.length;
    const checked = checkedExpected.length;

    const summary = {
      expected,
      checked,
      remaining: Math.max(expected - checked, 0),
      progress: expected ? Math.round((checked / expected) * 100) : 0,
      ok: statusCount.ok || 0,
      divergent: statusCount.divergente || 0,
      otherUnit: statusCount.outra_unidade || 0,
      notRegistered: statusCount.nao_cadastrado || 0,
      duplicates: statusCount.duplicada || 0,
      notFound: notFoundDisc,
      openDiscrepancies: openDisc,
      totalChecks: stats.total,
      offline: stats.offline,
      avgSeconds: stats.avg_elapsed_ms ? stats.avg_elapsed_ms / 1000 : null,
      firstCheckAt: stats.first_at,
      lastCheckAt: stats.last_at,
    };

    if (!detailed) return summary;

    // Progresso por sala, pela localização CADASTRADA — é assim que a equipe
    // divide o trabalho em campo ("falta a sala 204").
    const assets = await this.assetRepository.findByIds(expectedIds);
    const checkedSet = new Set(checkedExpected);
    const map = new Map();
    assets.forEach(a => {
      const key = a.location || 'Sem localização';
      const row = map.get(key) || { location: key, expected: 0, checked: 0 };
      row.expected += 1;
      if (checkedSet.has(a.asset_id)) row.checked += 1;
      map.set(key, row);
    });
    summary.byLocation = [...map.values()].sort((a, b) => a.location.localeCompare(b.location, 'pt-BR'));

    const methods = await this.inventoryCheckRepository.countByMethod({ inventory_id: inventory.inventory_id });
    summary.byMethod = Object.fromEntries(methods.map(m => [m._id, m.count]));
    return summary;
  }
}

module.exports = InventorySummaryService;
