const httpError = require('../../../lib/httpError');
const { formatUnit } = require('../../../lib/formatters');

// O gerente, de pé no prédio, fixa a posição do celular como o ponto da
// unidade. A partir daí cada conferência/envio mostra se foi feito lá.
class SetUnitLocationOperation {
  constructor({ unitRepository, geoService, auditService }) {
    this.unitRepository = unitRepository;
    this.geoService = geoService;
    this.auditService = auditService;
  }

  async execute({ actor, unit_id, geo }) {
    const unit = await this.unitRepository.findById(unit_id);
    if (!unit) throw httpError(404, 'Unidade não encontrada');
    const clean = this.geoService.clean(geo);
    if (!clean) throw httpError(400, 'Localização inválida');

    const saved = await this.unitRepository.update(unit_id, { geo: { lat: clean.lat, lng: clean.lng } });
    await this.auditService.log({
      actor_id: actor.user_id, action: 'unit.set_location', resource_type: 'unit', resource_id: unit_id,
      metadata: { from: unit.geo?.lat != null ? { lat: unit.geo.lat, lng: unit.geo.lng } : null, to: { lat: clean.lat, lng: clean.lng }, accuracy: clean.accuracy },
    });
    return formatUnit(saved);
  }
}

module.exports = SetUnitLocationOperation;
