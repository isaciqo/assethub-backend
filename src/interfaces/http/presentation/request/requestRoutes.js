const Joi = require('joi');
const authMiddleware = require('../../middlewares/authMiddleware');
const requireRole = require('../../middlewares/roleMiddleware');
const doc = require('../shared/doc');
const { REQUEST_STATUS } = require('../../../../lib/constants');

const managers = requireRole('admin', 'gestor');
const byId = Joi.object({ request_id: Joi.string().required() });

// Pedir, acompanhar e cancelar: qualquer perfil (servidor incluído). Decidir:
// só o responsável pelo patrimônio (admin/gestor).
module.exports = [
  { method: 'get', path: '/requests/catalog', handler: 'assetRequestController.catalog', middlewares: [authMiddleware], servidor: true, swagger: doc('Requests', 'Itens padrão para pedir com um toque') },
  {
    method: 'get',
    path: '/requests',
    handler: 'assetRequestController.list',
    middlewares: [authMiddleware],
    servidor: true,
    validation: {
      query: Joi.object({
        status: Joi.string().valid('abertas', ...REQUEST_STATUS).optional(),
        unit_id: Joi.string().optional(),
        sector: Joi.string().allow('').optional(),
        urgency: Joi.string().valid('normal', 'urgente').optional(),
        mine: Joi.boolean().optional(),
        from: Joi.date().iso().optional(),
        to: Joi.date().iso().optional(),
      }),
    },
    swagger: doc('Requests', 'Lista solicitações (gestor: todas; demais: as próprias)'),
  },
  {
    method: 'post',
    path: '/requests',
    handler: 'assetRequestController.create',
    middlewares: [authMiddleware],
    servidor: true,
    validation: {
      body: Joi.object({
        item: Joi.string().min(2).max(120).required(),
        category: Joi.string().allow('').max(60).optional(),
        quantity: Joi.number().integer().min(1).max(50).default(1),
        justification: Joi.string().min(3).max(500).required(),
        urgency: Joi.string().valid('normal', 'urgente').default('normal'),
        unit_id: Joi.string().optional(),
        sector: Joi.string().allow('').max(120).optional(),
        room: Joi.string().allow('').max(120).optional(),
        attachment: Joi.string().allow('', null).optional(),
        attachment_name: Joi.string().allow('').max(160).optional(),
      }),
    },
    swagger: doc('Requests', 'Pede um bem (o "ofício" do setor)'),
  },
  { method: 'get', path: '/requests/:request_id', handler: 'assetRequestController.detail', middlewares: [authMiddleware], servidor: true, validation: { params: byId }, swagger: doc('Requests', 'Detalhe com histórico e movimentações geradas') },
  { method: 'post', path: '/requests/:request_id/cancel', handler: 'assetRequestController.cancel', middlewares: [authMiddleware], servidor: true, validation: { params: byId }, swagger: doc('Requests', 'Quem pediu desiste (antes da decisão)') },
  { method: 'get', path: '/requests/:request_id/suggestions', handler: 'assetRequestController.suggestions', middlewares: [authMiddleware, managers], validation: { params: byId }, swagger: doc('Requests', 'Bens disponíveis que podem atender o pedido') },
  {
    method: 'post',
    path: '/requests/:request_id/fulfill',
    handler: 'assetRequestController.fulfill',
    middlewares: [authMiddleware, managers],
    validation: {
      params: byId,
      body: Joi.object({
        asset_ids: Joi.array().items(Joi.string()).min(1).max(50).required(),
        deliverer_id: Joi.string().optional(),
        note: Joi.string().allow('').max(500).optional(),
      }),
    },
    swagger: doc('Requests', 'Atende com bem existente (gera movimentação)'),
  },
  {
    method: 'post',
    path: '/requests/:request_id/purchase',
    handler: 'assetRequestController.purchase',
    middlewares: [authMiddleware, managers],
    validation: { params: byId, body: Joi.object({ purchase_justification: Joi.string().allow('').max(500).optional() }) },
    swagger: doc('Requests', 'Encaminha para compra (fora do sistema)'),
  },
  {
    method: 'post',
    path: '/requests/:request_id/reject',
    handler: 'assetRequestController.reject',
    middlewares: [authMiddleware, managers],
    validation: { params: byId, body: Joi.object({ reason: Joi.string().min(3).max(500).required() }) },
    swagger: doc('Requests', 'Recusa com motivo'),
  },
  { method: 'get', path: '/requests/:request_id/letter.pdf', handler: 'assetRequestController.letter', middlewares: [authMiddleware, managers], validation: { params: byId }, swagger: doc('Requests', 'Ofício de encaminhamento para aquisição (PDF)') },
];
