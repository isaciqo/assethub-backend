const authMiddleware = require('../../middlewares/authMiddleware');
const requireRole = require('../../middlewares/roleMiddleware');
const { singleFile, parseMultipartJson } = require('../../middlewares/uploadMiddleware');
const doc = require('../shared/doc');
const schema = require('./assetSchemas')();

const managers = requireRole('admin', 'gestor');

module.exports = [
  { method: 'get', path: '/assets', handler: 'assetController.list', middlewares: [authMiddleware], validation: { query: schema.list }, swagger: doc('Assets', 'Lista bens com filtros e paginação') },
  { method: 'get', path: '/assets/facets', handler: 'assetController.facets', middlewares: [authMiddleware], validation: { query: schema.facets }, swagger: doc('Assets', 'Valores distintos para filtros (categorias, locais, responsáveis)') },
  { method: 'get', path: '/assets/export', handler: 'assetController.exportFile', middlewares: [authMiddleware], validation: { query: schema.exportQuery }, swagger: doc('Assets', 'Exporta bens em CSV ou XLSX') },
  { method: 'get', path: '/assets/by-code/:code', handler: 'assetController.lookup', middlewares: [authMiddleware], validation: { params: schema.byCode }, swagger: doc('Assets', 'Busca bem pelo tombamento (QR, código de barras ou OCR)') },
  {
    method: 'post',
    path: '/assets/import',
    handler: 'assetController.importFile',
    middlewares: [authMiddleware, managers, singleFile, parseMultipartJson(['mapping'])],
    validation: { body: schema.importBody },
    swagger: doc('Assets', 'Importa CSV/XLSX (dry_run=true para prévia sem gravar)'),
  },
  { method: 'post', path: '/assets', handler: 'assetController.create', middlewares: [authMiddleware, managers], validation: { body: schema.create }, swagger: doc('Assets', 'Cadastra bem') },
  { method: 'get', path: '/assets/:asset_id', handler: 'assetController.detail', middlewares: [authMiddleware], validation: { params: schema.byId }, swagger: doc('Assets', 'Visão 360 do bem: cadastro, histórico, conferências e movimentações') },
  { method: 'patch', path: '/assets/:asset_id', handler: 'assetController.update', middlewares: [authMiddleware, managers], validation: { params: schema.byId, body: schema.update }, swagger: doc('Assets', 'Edita cadastro do bem (gera evento no histórico)') },
];
