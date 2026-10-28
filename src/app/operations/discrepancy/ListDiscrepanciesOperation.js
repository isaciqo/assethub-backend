const { formatDiscrepancy, formatAsset } = require('../../../lib/formatters');

class ListDiscrepanciesOperation {
  constructor({ discrepancyRepository, assetRepository, inventoryCheckRepository, inventoryRepository, possessionCheckRepository }) {
    this.discrepancyRepository = discrepancyRepository;
    this.assetRepository = assetRepository;
    this.inventoryCheckRepository = inventoryCheckRepository;
    this.inventoryRepository = inventoryRepository;
    this.possessionCheckRepository = possessionCheckRepository;
  }

  async execute({ inventory_id, unit_id, status, type } = {}) {
    const filter = {};
    if (inventory_id) filter.inventory_id = inventory_id;
    if (unit_id) filter.unit_id = unit_id;
    if (status) filter.status = status;
    if (type) filter.type = type;

    const list = await this.discrepancyRepository.find(filter);
    const assetIds = [...new Set(list.map(d => d.asset_id).filter(Boolean))];
    const invIds = [...new Set(list.map(d => d.inventory_id).filter(Boolean))];
    const [assets, inventories, possession] = await Promise.all([
      this.assetRepository.findByIds(assetIds),
      Promise.all(invIds.map(id => this.inventoryRepository.findById(id))),
      this.possessionCheckRepository.findByIds([...new Set(list.map(d => d.possession_check_id).filter(Boolean))]),
    ]);
    const possessionMap = Object.fromEntries(possession.map(c => [c.check_id, c]));
    const assetMap = Object.fromEntries(assets.map(a => [a.asset_id, formatAsset(a)]));
    const invMap = Object.fromEntries(inventories.filter(Boolean).map(i => [i.inventory_id, i.number]));

    // Foto tirada na conferência aparece direto no cartão da pendência.
    const checkIds = list.map(d => d.check_id).filter(Boolean);
    const checks = await Promise.all([...new Set(checkIds)].map(id => this.inventoryCheckRepository.findById(id)));
    const checkMap = Object.fromEntries(checks.filter(Boolean).map(c => [c.check_id, c]));

    return list.map(d => {
      // Pendência vinda da validação de posse: quem respondeu faz o papel de quem conferiu.
      const pc = possessionMap[d.possession_check_id];
      return {
        ...formatDiscrepancy(d),
        asset: assetMap[d.asset_id] || null,
        inventoryNumber: pc ? pc.number : invMap[d.inventory_id] || '',
        photoEvidenceId: checkMap[d.check_id]?.photo_evidence_id || null,
        checkedByName: pc ? pc.user_name : checkMap[d.check_id]?.checked_by_name || '',
        checkNotes: pc ? d.observed?.note || '' : checkMap[d.check_id]?.notes || '',
      };
    });
  }
}

module.exports = ListDiscrepanciesOperation;
