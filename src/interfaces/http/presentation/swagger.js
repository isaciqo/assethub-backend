const swaggerUi = require('swagger-ui-express');
const { ALL_ROUTES, API_PREFIX } = require('./RouterRegister');

const buildSwaggerSpec = () => {
  const paths = {};

  ALL_ROUTES.forEach(route => {
    const swaggerPath = `${API_PREFIX}${route.path}`.replace(/:(\w+)/g, '{$1}');
    if (!paths[swaggerPath]) paths[swaggerPath] = {};

    const params = [...route.path.matchAll(/:(\w+)/g)].map(([, name]) => ({
      in: 'path', name, required: true, schema: { type: 'string' },
    }));

    paths[swaggerPath][route.method] = {
      ...(route.swagger || {
        tags: [route.path.split('/')[1]],
        summary: `${route.method.toUpperCase()} ${route.path}`,
        responses: { 200: { description: 'Success' } },
      }),
      ...(params.length ? { parameters: params } : {}),
    };
  });

  return {
    openapi: '3.0.0',
    info: {
      title: 'Patrimônio Ágil API',
      version: '1.0.0',
      description: 'Inventário patrimonial digital — Hackathon TJPA, Desafio 2. Todos os dados são sintéticos.',
    },
    components: {
      securitySchemes: {
        BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
    paths,
  };
};

const setupSwagger = (app) => {
  const spec = buildSwaggerSpec();
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(spec));
  app.get('/api-docs.json', (req, res) => res.json(spec));
};

module.exports = setupSwagger;
