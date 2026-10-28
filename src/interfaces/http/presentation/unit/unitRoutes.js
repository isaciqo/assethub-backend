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
];
