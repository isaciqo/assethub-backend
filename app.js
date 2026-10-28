require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDatabase = require('./src/database/connection');
const container = require('./src/interfaces/http/container');
const routerRegister = require('./src/interfaces/http/presentation/RouterRegister');
const errorHandler = require('./src/interfaces/http/middlewares/errorHandler');
const requestLogger = require('./src/interfaces/http/middlewares/requestLogger');
const requestContextMiddleware = require('./src/interfaces/http/middlewares/requestContext');
const setupSwagger = require('./src/interfaces/http/presentation/swagger');
const logger = require('./src/lib/logger');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

app.use(requestContextMiddleware);
// crossOriginResourcePolicy liberado: fotos/assinaturas (/evidences) e o termo
// em PDF são abertos pelo frontend, que roda em outra origem.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(requestLogger);

// Lotes de sincronização trazem fotos comprimidas embutidas (data URL) e as
// etapas de entrega/recebimento trazem assinatura + fotos.
app.use(express.json({ limit: '25mb' }));

const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:8080'];

app.use(cors({
  origin: (origin, callback) => {
    // Sem Origin = não é navegador cross-origin (healthcheck do Docker, nginx
    // fazendo proxy na mesma origem, curl). CORS não protege nada nesses casos.
    if (!origin) return callback(null, true);
    // CORS_ALLOW_ALL=true: demo na rede local/túnel, onde a origem muda a cada vez.
    if (process.env.CORS_ALLOW_ALL === 'true' || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origem não permitida — ${origin}`));
  },
  credentials: true,
}));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas. Aguarde 15 minutos antes de tentar novamente.' },
});

const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente em alguns instantes.' },
});

// Folgado: uma equipe inteira atrás do mesmo Wi-Fi do fórum sincroniza junta
// quando a conexão volta.
const globalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Aguarde antes de tentar novamente.' },
});

app.use('/api/v1', globalApiLimiter);
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/public/', publicLimiter);

// Sistema fechado: em produção dá para esconder a documentação da API.
if (process.env.SWAGGER_ENABLED !== 'false') setupSwagger(app);
routerRegister(app, container);
app.use(errorHandler);

connectDatabase()
  .then(async () => {
    // Primeira subida (banco vazio): popula com dados SINTÉTICOS para a demo.
    if (process.env.SEED_ON_START === 'true') {
      const { seedIfEmpty } = require('./scripts/seed');
      await seedIfEmpty();
    }
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Swagger docs: http://localhost:${PORT}/api-docs`);
    });

    // Keep-alive (mesmo esquema do MEDagenda): o Render gratuito dorme o serviço
    // depois de ~15 min sem tráfego HTTP público. Um ping pra localhost não conta —
    // precisa bater na URL pública, atravessando o proxy do Render. RENDER_EXTERNAL_URL
    // é injetada automaticamente pelo Render; SELF_PING_URL é o jeito manual em outro
    // provedor. Sem nenhuma das duas (dev local/Docker) fica desligado.
    const selfPingUrl = process.env.SELF_PING_URL || process.env.RENDER_EXTERNAL_URL;
    if (selfPingUrl) {
      let consecutiveFailures = 0;
      setInterval(() => {
        fetch(`${selfPingUrl}/health`)
          .then(() => { consecutiveFailures = 0; })
          .catch((err) => {
            consecutiveFailures += 1;
            // Só loga a partir da 2ª falha seguida — uma requisição perdida
            // (rede instável, deploy em andamento) não é problema.
            if (consecutiveFailures >= 2) {
              logger.error('Self-ping: falha ao pingar /health', { message: err.message, consecutiveFailures });
            }
          });
      }, 60_000);
      logger.info(`Self-ping ativo: ${selfPingUrl}/health a cada 60s`);
    } else {
      logger.info('Self-ping desativado — SELF_PING_URL/RENDER_EXTERNAL_URL não configurada');
    }
  })
  .catch((err) => {
    logger.error('Failed to start', { message: err.message, stack: err.stack });
    process.exit(1);
  });

module.exports = app;
