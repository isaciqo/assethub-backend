const Joi = require('joi');
const authMiddleware = require('../../middlewares/authMiddleware');
const requireRole = require('../../middlewares/roleMiddleware');
const doc = require('../shared/doc');
const { ALL_DISCREPANCY_ACTIONS, DISCREPANCY_TYPES, CONSERVATION_STATUS } = require('../../../../lib/constants');

const managers = requireRole('admin', 'gestor');

module.exports = [
  {
    method: 'get',
    path: '/discrepancies',
    handler: 'discrepancyController.list',
    middlewares: [authMiddleware],
    validation: {
      query: Joi.object({
        inventory_id: Joi.string().optional(),
        unit_id: Joi.string().optional(),
        status: Joi.string().valid('aberta', 'resolvida').optional(),
        type: Joi.string().valid(...Object.values(DISCREPANCY_TYPES)).optional(),
      }),
    },
    swagger: doc('Discrepancies', 'Fila de pendências do inventário'),
  },
  {
    method: 'post',
    path: '/discrepancies/bulk-resolve',
    handler: 'discrepancyController.bulkResolve',
    middlewares: [authMiddleware, managers],
    validation: {
      body: Joi.object({
        ids: Joi.array().items(Joi.string()).min(1).max(500).required(),
        action: Joi.string().valid(...ALL_DISCREPANCY_ACTIONS).required(),
        note: Joi.string().allow('').max(500).optional(),
      }),
    },
    swagger: doc('Discrepancies', 'Resolve várias pendências com a mesma decisão'),
  },
  {
    method: 'post',
    path: '/discrepancies/:discrepancy_id/resolve',
    handler: 'discrepancyController.resolve',
    middlewares: [authMiddleware, managers],
    validation: {
      params: Joi.object({ discrepancy_id: Joi.string().required() }),
      body: Joi.object({
        action: Joi.string().valid(...ALL_DISCREPANCY_ACTIONS).required(),
        note: Joi.string().allow('').max(500).optional(),
        data: Joi.object({
          description: Joi.string().allow('').optional(),
          category: Joi.string().allow('').optional(),
          location: Joi.string().allow('').optional(),
          responsible_name: Joi.string().allow('').optional(),
          conservation_status: Joi.string().valid(...CONSERVATION_STATUS).optional(),
        }).optional(),
      }),
    },
    swagger: doc('Discrepancies', 'Decide uma pendência (nada muda no cadastro sem esta decisão)'),
  },
];
