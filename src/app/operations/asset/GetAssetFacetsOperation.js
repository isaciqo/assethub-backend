// Valores distintos para os filtros da tela de bens (e para sugerir setor, sala
// e categoria nos formulários sem obrigar digitação livre). Com setor escolhido,
// as salas vêm só daquele setor.
class GetAssetFacetsOperation {
  constructor({ assetRepository }) {
    this.assetRepository = assetRepository;
  }

  async execute({ unit_id, location } = {}) {
    const [categories, locations, rooms, brands, responsibles] = await Promise.all([
      this.assetRepository.distinct('category', { unit_id }),
      this.assetRepository.distinct('location', { unit_id }),
      this.assetRepository.distinct('room', { unit_id, location }),
      this.assetRepository.distinct('brand', { unit_id }),
      this.assetRepository.distinct('responsible_name', { unit_id }),
    ]);
    const clean = list => list.filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return {
      categories: clean(categories),
      locations: clean(locations),
      rooms: clean(rooms),
      brands: clean(brands),
      responsibles: clean(responsibles),
    };
  }
}

module.exports = GetAssetFacetsOperation;
