const Joi = require('joi');
const { CONSERVATION_STATUS, ASSET_STATUS } = require('../../../../lib/constants');

// Um filtro para cada coluna da planilha. location = setor; checked agrupa a
// última conferência em "em dia" (até 12 meses), "atrasada" e "nunca".
const filters = {
  unit_id: Joi.string().optional(),
  location: Joi.string().allow('').optional(),
  room: Joi.string().allow('').optional(),
  status: Joi.string().valid(...ASSET_STATUS).optional(),
  category: Joi.string().allow('').optional(),
  brand: Joi.string().allow('').optional(),
  responsible_name: Joi.string().allow('').optional(),
  conservation_status: Joi.string().valid(...CONSERVATION_STATUS).optional(),
  checked: Joi.string().valid('em_dia', 'atrasada', 'nunca').optional(),
  search: Joi.string().allow('').max(120).optional(),
};

module.exports = () => ({
  list: Joi.object({
    ...filters,
    page: Joi.number().integer().min(1).optional(),
    pageSize: Joi.number().integer().min(1).max(500).optional(),
  }),
  facets: Joi.object({ unit_id: Joi.string().optional(), location: Joi.string().allow('').optional() }),
  exportQuery: Joi.object({ ...filters, format: Joi.string().valid('csv', 'xlsx').default('xlsx') }),
  byId: Joi.object({ asset_id: Joi.string().required() }),
  byCode: Joi.object({ code: Joi.string().min(1).max(60).required() }),
  create: Joi.object({
    code: Joi.string().min(1).max(60).required(),
    description: Joi.string().min(2).required(),
    category: Joi.string().allow('').optional(),
    brand: Joi.string().allow('').optional(),
    serial_number: Joi.string().allow('').optional(),
    unit_id: Joi.string().required(),
    location: Joi.string().allow('').optional(),
    room: Joi.string().allow('').optional(),
    responsible_name: Joi.string().allow('').optional(),
    conservation_status: Joi.string().valid(...CONSERVATION_STATUS).optional(),
    acquisition_date: Joi.date().allow(null).optional(),
    value: Joi.number().min(0).allow(null).optional(),
    notes: Joi.string().allow('').optional(),
  }),
  update: Joi.object({
    description: Joi.string().min(2).optional(),
    category: Joi.string().allow('').optional(),
    brand: Joi.string().allow('').optional(),
    serial_number: Joi.string().allow('').optional(),
    location: Joi.string().allow('').optional(),
    room: Joi.string().allow('').optional(),
    responsible_name: Joi.string().allow('').optional(),
    conservation_status: Joi.string().valid(...CONSERVATION_STATUS).optional(),
    status: Joi.string().valid('ativo', 'nao_localizado', 'baixado').optional(),
    value: Joi.number().min(0).allow(null).optional(),
    notes: Joi.string().allow('').optional(),
  }),
  importBody: Joi.object({
    mapping: Joi.object().pattern(Joi.string(), Joi.string()).optional(),
    default_unit_id: Joi.string().allow('', null).optional(),
    dry_run: Joi.alternatives(Joi.boolean(), Joi.string().valid('true', 'false')).optional(),
  }),
});
