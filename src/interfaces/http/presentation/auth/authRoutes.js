const authMiddleware = require('../../middlewares/authMiddleware');
const doc = require('../shared/doc');
const schema = require('./authSchemas')();

module.exports = [
  { method: 'post', path: '/auth/login', handler: 'authController.login', validation: { body: schema.login }, swagger: doc('Auth', 'Login com e-mail e senha', { auth: false }) },
  { method: 'post', path: '/auth/refresh', handler: 'authController.refresh', validation: { body: schema.refresh }, swagger: doc('Auth', 'Renova o accessToken', { auth: false }) },
  { method: 'get', path: '/auth/me', handler: 'authController.me', middlewares: [authMiddleware], swagger: doc('Auth', 'Perfil da pessoa logada') },
  { method: 'post', path: '/auth/logout', handler: 'authController.logout', middlewares: [authMiddleware], swagger: doc('Auth', 'Logout') },
];
