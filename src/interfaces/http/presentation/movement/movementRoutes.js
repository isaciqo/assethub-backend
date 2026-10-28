const Joi = require('joi');
const authMiddleware = require('../../middlewares/authMiddleware');
const doc = require('../shared/doc');
const { MOVEMENT_TYPES, MOVEMENT_STATUS, CONSERVATION_STATUS } = require('../../../../lib/constants');

const byId = Joi.object({ movement_id: Joi.string().required() });
const dataUrl = Joi.string().max(7 * 1024 * 1024);

const handover = {
  conditions: Joi.array().items(Joi.object({
    asset_id: Joi.string().required(),
    condition: Joi.string().valid(...CONSERVATION_STATUS).required(),
  })).min(1).required(),
  notes: Joi.string().allow('').max(1000).optional(),
  signature: dataUrl.required(),
  signer_name: Joi.string().allow('').max(120).optional(),
  photos: Joi.array().items(dataUrl).max(6).optional(),
};

const carrier = Joi.object({
  company: Joi.string().allow('').max(120).optional(),
  driver_name: Joi.string().allow('').max(120).optional(),
  driver_document: Joi.string().allow('').max(40).optional(),
  vehicle_plate: Joi.string().allow('').max(12).optional(),
});

module.exports = [
  {
    method: 'get',
    path: '/movements',
    handler: 'movementController.list',
    middlewares: [authMiddleware],
    validation: {
      query: Joi.object({
        status: Joi.string().valid(...MOVEMENT_STATUS).optional(),
        scope: Joi.string().valid('all', 'mine', 'waiting_me').optional(),
      }),
    },
    swagger: doc('Movements', 'Lista movimentações (todas, minhas ou aguardando minha ação)'),
  },
  {
    method: 'post',
    path: '/movements',
    handler: 'movementController.create',
    middlewares: [authMiddleware],
    validation: {
      body: Joi.object({
        type: Joi.string().valid(...Object.keys(MOVEMENT_TYPES)).required(),
        reason: Joi.string().min(3).max(500).required(),
        asset_ids: Joi.array().items(Joi.string()).min(1).max(200).required(),
        destination: Joi.object({
          unit_id: Joi.string().required(),
          location: Joi.string().allow('').max(120).optional(),
          responsible_name: Joi.string().allow('').max(120).optional(),
        }).required(),
        approver_ids: Joi.array().items(Joi.string()).max(5).optional(),
        deliverer_id: Joi.string().required(),
        receiver_id: Joi.string().required(),
        carrier: carrier.optional(),
        expected_date: Joi.date().allow(null).optional(),
        source_discrepancy_id: Joi.string().allow(null, '').optional(),
      }),
    },
    swagger: doc('Movements', 'Abre movimentação'),
  },
  { method: 'get', path: '/movements/:movement_id', handler: 'movementController.detail', middlewares: [authMiddleware], servidor: true, validation: { params: byId }, swagger: doc('Movements', 'Detalhe com histórico encadeado, evidências e ações disponíveis') },
  { method: 'get', path: '/movements/:movement_id/term.pdf', handler: 'movementController.term', middlewares: [authMiddleware], validation: { params: byId }, swagger: doc('Movements', 'Termo de envio e recebimento em PDF') },
  {
    method: 'post',
    path: '/movements/:movement_id/approval',
    handler: 'movementController.decide',
    middlewares: [authMiddleware],
    validation: { params: byId, body: Joi.object({ decision: Joi.string().valid('aprovada', 'rejeitada').required(), note: Joi.string().allow('').max(500).optional() }) },
    swagger: doc('Movements', 'Aprova ou rejeita'),
  },
  {
    method: 'post',
    path: '/movements/:movement_id/delivery',
    handler: 'movementController.deliver',
    middlewares: [authMiddleware],
    servidor: true,
    validation: { params: byId, body: Joi.object({ ...handover, carrier: carrier.optional() }) },
    swagger: doc('Movements', 'Confirma envio (estado, assinatura, fotos)'),
  },
  {
    method: 'post',
    path: '/movements/:movement_id/receipt',
    handler: 'movementController.receive',
    middlewares: [authMiddleware],
    servidor: true,
    validation: {
      params: byId,
      body: Joi.object({ ...handover, has_issue: Joi.boolean().optional(), issue_description: Joi.string().allow('').max(1000).optional() }),
    },
    swagger: doc('Movements', 'Confirma recebimento (com ou sem ocorrência)'),
  },
  {
    method: 'post',
    path: '/movements/:movement_id/resolve-issue',
    handler: 'movementController.resolveIssue',
    middlewares: [authMiddleware],
    validation: { params: byId, body: Joi.object({ outcome: Joi.string().valid('concluir', 'desfazer').required(), note: Joi.string().min(3).max(500).required() }) },
    swagger: doc('Movements', 'Trata ocorrência do recebimento'),
  },
  {
    method: 'post',
    path: '/movements/:movement_id/cancel',
    handler: 'movementController.cancel',
    middlewares: [authMiddleware],
    validation: { params: byId, body: Joi.object({ note: Joi.string().min(3).max(500).required() }) },
    swagger: doc('Movements', 'Cancela antes do envio'),
  },
  {
    method: 'get',
    path: '/public/movements/:movement_id/verify',
    handler: 'movementController.verify',
    validation: { params: byId, query: Joi.object({ h: Joi.string().hex().max(64).optional() }) },
    swagger: doc('Public', 'Verificação pública do termo (QR Code)', { auth: false }),
  },
];
