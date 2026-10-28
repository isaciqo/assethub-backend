const Joi = require('joi');
const authMiddleware = require('../../middlewares/authMiddleware');
const requireRole = require('../../middlewares/roleMiddleware');
const doc = require('../shared/doc');
const { CONSERVATION_STATUS, CHECK_METHODS, INVENTORY_STATUS } = require('../../../../lib/constants');

const byId = Joi.object({ inventory_id: Joi.string().required() });
const geo = Joi.object({
  lat: Joi.number().min(-90).max(90).required(),
  lng: Joi.number().min(-180).max(180).required(),
  accuracy: Joi.number().min(0).allow(null).optional(),
});

// Uma operação de conferência como sai do aparelho. A foto vem embutida (data
// URL comprimida no próprio app) para que a fila offline seja um JSON só.
const operation = Joi.object({
  operation_id: Joi.string().guid().required(),
  inventory_id: Joi.string().required(),
  asset_id: Joi.string().allow(null, '').optional(),
  asset_code: Joi.string().min(1).max(60).required(),
  observed_location: Joi.string().allow('').max(120).optional(),
  observed_condition: Joi.string().valid(...CONSERVATION_STATUS).optional(),
  observed_responsible: Joi.string().allow('').max(120).optional(),
  observed_description: Joi.string().allow('').max(300).optional(),
  notes: Joi.string().allow('').max(1000).optional(),
  photo: Joi.string().max(7 * 1024 * 1024).allow(null, '').optional(),
  method: Joi.string().valid(...CHECK_METHODS).optional(),
  elapsed_ms: Joi.number().integer().min(0).allow(null).optional(),
  checked_at: Joi.date().iso().required(),
  device_id: Joi.string().allow('').max(80).optional(),
  was_offline: Joi.boolean().optional(),
  geo: geo.allow(null).optional(),
});

module.exports = [
  {
    method: 'get',
    path: '/inventories',
    handler: 'inventoryController.list',
    middlewares: [authMiddleware],
    validation: { query: Joi.object({ status: Joi.string().valid(...INVENTORY_STATUS).optional(), unit_id: Joi.string().optional() }) },
    swagger: doc('Inventories', 'Lista inventários com progresso'),
  },
  {
    method: 'post',
    path: '/inventories',
    handler: 'inventoryController.create',
    middlewares: [authMiddleware, requireRole('admin', 'gestor')],
    validation: {
      body: Joi.object({
        unit_id: Joi.string().required(),
        name: Joi.string().allow('').max(120).optional(),
        locations: Joi.array().items(Joi.string()).optional(),
      }),
    },
    swagger: doc('Inventories', 'Abre inventário (congela a lista de bens previstos)'),
  },
  { method: 'get', path: '/inventories/:inventory_id', handler: 'inventoryController.detail', middlewares: [authMiddleware], validation: { params: byId }, swagger: doc('Inventories', 'Detalhe com progresso por sala, equipe e últimas conferências') },
  { method: 'get', path: '/inventories/:inventory_id/snapshot', handler: 'inventoryController.snapshot', middlewares: [authMiddleware], validation: { params: byId }, swagger: doc('Inventories', 'Pacote para conferência offline') },
  { method: 'get', path: '/inventories/:inventory_id/checks', handler: 'inventoryController.checks', middlewares: [authMiddleware], validation: { params: byId }, swagger: doc('Inventories', 'Todas as conferências do inventário') },
  { method: 'post', path: '/inventories/:inventory_id/complete', handler: 'inventoryController.complete', middlewares: [authMiddleware, requireRole('admin', 'gestor')], validation: { params: byId }, swagger: doc('Inventories', 'Encerra o inventário e gera pendências de não localizados') },
  {
    method: 'get',
    path: '/inventories/:inventory_id/export',
    handler: 'inventoryController.exportFile',
    middlewares: [authMiddleware],
    validation: { params: byId, query: Joi.object({ format: Joi.string().valid('csv', 'xlsx', 'pdf').default('xlsx') }) },
    swagger: doc('Inventories', 'Relatório consolidado em XLSX, CSV ou PDF'),
  },
  {
    method: 'post',
    path: '/sync/checks',
    handler: 'inventoryController.sync',
    middlewares: [authMiddleware],
    validation: { body: Joi.object({ operations: Joi.array().items(operation).min(1).max(50).required() }) },
    swagger: doc('Sync', 'Sincronização idempotente das conferências feitas no aparelho'),
  },
];
