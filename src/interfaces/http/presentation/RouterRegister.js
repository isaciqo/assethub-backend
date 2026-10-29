const authRoutes = require('./auth/authRoutes');
const userRoutes = require('./user/userRoutes');
const unitRoutes = require('./unit/unitRoutes');
const assetRoutes = require('./asset/assetRoutes');
const inventoryRoutes = require('./inventory/inventoryRoutes');
const discrepancyRoutes = require('./discrepancy/discrepancyRoutes');
const movementRoutes = require('./movement/movementRoutes');
const metaRoutes = require('./meta/metaRoutes');
const possessionRoutes = require('./possession/possessionRoutes');
const requestRoutes = require('./request/requestRoutes');
const validationMiddleware = require('../middlewares/validationMiddleware');

const API_PREFIX = '/api/v1';

const ALL_ROUTES = [
  ...authRoutes,
  ...userRoutes,
  ...unitRoutes,
  ...assetRoutes,
  ...inventoryRoutes,
  ...discrepancyRoutes,
  ...movementRoutes,
  ...metaRoutes,
  ...possessionRoutes,
  ...requestRoutes,
];

// O perfil servidor só alcança as rotas marcadas com `servidor: true` — o
// resto do sistema (inventários, pendências, cadastro…) fica fechado para ele.
const servidorGuard = route => (req, res, next) => {
  if (req.user?.role === 'servidor' && !route.servidor) {
    return res.status(403).json({ error: 'Forbidden', message: 'Seu perfil não tem acesso a esta área' });
  }
  return next();
};

const registerRoutes = (app, routes, container) => {
  routes.forEach(route => {
    const [controllerName, methodName] = route.handler.split('.');
    const controller = container.resolve(controllerName);

    const middlewares = route.middlewares || [];
    const validate = validationMiddleware(route.validation);
    const fullPath = `${API_PREFIX}${route.path}`;

    app[route.method](fullPath, ...middlewares, servidorGuard(route), validate, (req, res, next) => {
      Promise.resolve(controller[methodName](req, res, next)).catch(next);
    });
  });
};

const routerRegister = (app, container) => registerRoutes(app, ALL_ROUTES, container);

routerRegister.ALL_ROUTES = ALL_ROUTES;
routerRegister.API_PREFIX = API_PREFIX;

module.exports = routerRegister;
