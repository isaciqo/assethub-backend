const Joi = require('joi');
const authMiddleware = require('../../middlewares/authMiddleware');
const requireRole = require('../../middlewares/roleMiddleware');
const doc = require('../shared/doc');

module.exports = [
  { method: 'get', path: '/units', handler: 'unitController.list', middlewares: [authMiddleware], swagger: doc('Units', 'Lista unidades (fóruns, comarcas) com total de bens') },
  {
    method: 'post',
    path: '/units',
    handler: 'unitController.create',
    middlewares: [authMiddleware, requireRole('admin', 'gestor')],
    validation: {
      body: Joi.object({
        name: Joi.string().min(2).required(),
        code: Joi.string().min(2).max(12).required(),
        city: Joi.string().allow('').optional(),
        region: Joi.string().valid('capital', 'interior').optional(),
        locations: Joi.array().items(Joi.string()).optional(),
      }),
    },
    swagger: doc('Units', 'Cria unidade'),
  },
  {
    method: 'patch',
    path: '/units/:unit_id/location',
    handler: 'unitController.setLocation',
    middlewares: [authMiddleware, requireRole('admin', 'gestor')],
    validation: {
      params: Joi.object({ unit_id: Joi.string().required() }),
      body: Joi.object({
        lat: Joi.number().min(-90).max(90).required(),
        lng: Joi.number().min(-180).max(180).required(),
        accuracy: Joi.number().min(0).allow(null).optional(),
      }),
    },
    swagger: doc('Units', 'Fixa a posição atual como ponto de referência da unidade'),
  },
];
