const logger = require('../../../lib/logger');

// /health: o self-ping bate a cada 60 s — 1.440 linhas/dia de ruído. Falhas do
// ping são logadas pelo próprio keep-alive (app.js).
const SKIP_PATHS = ['/api-docs', '/favicon.ico', '/health'];

function requestLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    if (SKIP_PATHS.some(p => req.path.startsWith(p))) return;

    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

    // user_id/email/request_id são injetados automaticamente pelo logger a partir do
    // contexto da requisição (ver requestContext.js) — não precisam ser passados aqui.
    // method/path/status já vão no texto da mensagem — não repetir nos campos estruturados.
    logger[level](`${req.method} ${req.path} ${res.statusCode}`, {
      duration_ms: duration,
      ip: req.ip,
    });
  });

  next();
}

module.exports = requestLogger;
