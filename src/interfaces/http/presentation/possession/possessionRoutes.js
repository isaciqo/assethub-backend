const Joi = require('joi');
const authMiddleware = require('../../middlewares/authMiddleware');
const requireRole = require('../../middlewares/roleMiddleware');
const doc = require('../shared/doc');

const managers = requireRole('admin', 'gestor');

module.exports = [
  { method: 'get', path: '/me/area', handler: 'possessionController.myArea', middlewares: [authMiddleware], servidor: true, swagger: doc('Me', 'Meus bens e minhas tarefas (enviar, receber, validar)') },
  {
    method: 'post',
    path: '/me/possession-checks/:check_id/answer',
    handler: 'possessionController.answer',
    middlewares: [authMiddleware],
    servidor: true,
    validation: {
      params: Joi.object({ check_id: Joi.string().required() }),
      body: Joi.object({
        answers: Joi.array().items(Joi.object({
          asset_id: Joi.string().required(),
          has_it: Joi.boolean().required(),
          note: Joi.string().allow('').max(500).optional(),
        })).min(1).required(),
      }),
    },
    swagger: doc('Me', 'Responde a validação: o bem está ou não comigo'),
  },
  { method: 'get', path: '/possession-checks', handler: 'possessionController.list', middlewares: [authMiddleware, managers], swagger: doc('Possession', 'Validações de bens pedidas') },
  {
    method: 'post',
    path: '/possession-checks',
    handler: 'possessionController.create',
    middlewares: [authMiddleware, managers],
    validation: { body: Joi.object({ user_ids: Joi.array().items(Joi.string()).min(1).max(200).required() }) },
    swagger: doc('Possession', 'Pede a pessoas que validem os bens no nome delas'),
  },
];
