const { sectorKind } = require('../../../lib/sectors');

// Para quem vai pedir: comarcas e setores, com o responsável de cada setor
// (quem vai responder). Aberto ao servidor, que não vê a lista de comarcas.
class ListRequestSourcesOperation {
  constructor({ unitRepository }) {
    this.unitRepository = unitRepository;
  }

  async execute() {
    const units = await this.unitRepository.findAll();
    return units.map(u => ({
      unitId: u.unit_id,
      unitName: u.name,
      sectors: [...(u.locations || [])]
        .sort((a, b) => a.localeCompare(b, 'pt-BR'))
        .map(name => {
          const owner = (u.sector_owners || []).find(o => o.location === name);
          return { name, kind: sectorKind(name), ownerId: owner?.user_id || null, ownerName: owner?.user_name || '' };
        }),
    }));
  }
}

module.exports = ListRequestSourcesOperation;
