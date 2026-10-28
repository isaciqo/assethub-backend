const Joi = require('joi');
const authMiddleware = require('../../middlewares/authMiddleware');
const requireRole = require('../../middlewares/roleMiddleware');
const doc = require('../shared/doc');
const { ROLES } = require('../../../../lib/constants');

module.exports = [
  {
    method: 'get',
    path: '/users',
    handler: 'userController.list',
    middlewares: [authMiddleware],
    validation: { query: Joi.object({ role: Joi.string().valid(...ROLES).optional(), unit_id: Joi.string().optional() }) },
    swagger: doc('Users', 'Lista pessoas (para escolher aprovadores, quem envia e quem recebe)'),
  },
  {
    method: 'post',
    path: '/users',
    handler: 'userController.create',
    middlewares: [authMiddleware, requireRole('admin')],
    validation: {
      body: Joi.object({
        name: Joi.string().min(2).required(),
        email: Joi.string().email({ tlds: { allow: false } }).required(),
        password: Joi.string().min(8).required(),
        role: Joi.string().valid(...ROLES).required(),
        registration: Joi.string().allow('').optional(),
        unit_id: Joi.string().allow(null, '').optional(),
      }),
    },
    swagger: doc('Users', 'Cria usuário (admin)'),
  },
];
