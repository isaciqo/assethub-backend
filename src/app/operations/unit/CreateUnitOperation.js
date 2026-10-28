const { v4: uuidv4 } = require('uuid');
const httpError = require('../../../lib/httpError');
const { formatUnit } = require('../../../lib/formatters');

class CreateUnitOperation {
  constructor({ unitRepository, auditService }) {
    this.unitRepository = unitRepository;
    this.auditService = auditService;
  }

  async execute({ actor, name, code, city, region, locations }) {
    if (await this.unitRepository.findByCodeOrName(code) || await this.unitRepository.findByCodeOrName(name)) {
      throw httpError(409, 'Já existe uma unidade com esse nome ou código');
    }
    const unit = await this.unitRepository.create({
      unit_id: uuidv4(),
      name,
      code,
      city: city || '',
      region: region || 'interior',
      locations: locations || [],
    });
    await this.auditService.log({ actor_id: actor.user_id, action: 'unit.create', resource_type: 'unit', resource_id: unit.unit_id });
    return formatUnit(unit);
  }
}

module.exports = CreateUnitOperation;
