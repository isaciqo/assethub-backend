const Joi = require('joi');
const authMiddleware = require('../../middlewares/authMiddleware');
const doc = require('../shared/doc');

module.exports = [
  { method: 'get', path: '/meta', handler: 'metaController.meta', middlewares: [authMiddleware], servidor: true, swagger: doc('Meta', 'Enums e regras configuráveis (tipos de movimentação, ações de pendência)') },
  { method: 'get', path: '/dashboard', handler: 'metaController.dashboard', middlewares: [authMiddleware], swagger: doc('Dashboard', 'Painel do gestor') },
  {
    method: 'get',
    path: '/evidences/:evidence_id',
    handler: 'metaController.evidence',
    middlewares: [authMiddleware],
    validation: { params: Joi.object({ evidence_id: Joi.string().required() }) },
    swagger: doc('Evidences', 'Arquivo de evidência (foto, assinatura, documento)'),
  },
];
