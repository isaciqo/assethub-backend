// Valores distintos para os filtros da tela de bens (e para sugerir local e
// categoria nos formulários sem obrigar digitação livre).
class GetAssetFacetsOperation {
  constructor({ assetRepository }) {
    this.assetRepository = assetRepository;
  }

  async execute({ unit_id } = {}) {
    const [categories, locations, responsibles] = await Promise.all([
      this.assetRepository.distinct('category', { unit_id }),
      this.assetRepository.distinct('location', { unit_id }),
      this.assetRepository.distinct('responsible_name', { unit_id }),
    ]);
    const clean = list => list.filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return { categories: clean(categories), locations: clean(locations), responsibles: clean(responsibles) };
  }
}

module.exports = GetAssetFacetsOperation;
