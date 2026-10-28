const logger = require('../../../lib/logger');

// newEmail/newEmail-like campos ficam de fora de propósito — não são credencial, e
// saber qual e-mail foi submetido é exatamente o tipo de coisa que ajuda a debugar
// o fluxo de troca de e-mail só pelo log, sem precisar perguntar pro usuário.
const SENSITIVE_FIELDS = ['password', 'currentPassword', 'newPassword', 'token', 'refreshToken'];

function sanitizeBody(body) {
  if (!body || typeof body !== 'object') return body;
  const clean = { ...body };
  SENSITIVE_FIELDS.forEach(field => {
    if (clean[field] !== undefined) clean[field] = '[REDACTED]';
  });
  return clean;
}

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  const route = `${req.method} ${req.originalUrl}`;
  const stackMeta = { stack: err.stack };
  // Body/query sanitizados — sem isso, um erro só mostra a rota e a stack trace,
  // nunca o que de fato foi enviado (útil pra reproduzir o bug sem precisar perguntar
  // pro usuário "o que você digitou"). Some (undefined) automaticamente na formatação
  // do logger quando o body é vazio (GET, DELETE etc).
  const requestMeta = {
    body: Object.keys(req.body || {}).length ? sanitizeBody(req.body) : undefined,
    query: Object.keys(req.query || {}).length ? sanitizeBody(req.query) : undefined,
  };

  if (err.isJoi || err.name === 'ValidationError') {
    const details = err.details?.map(d => d.message) ?? [err.message];
    logger.warn(`Validation error — ${route}`, { details: details.join('; '), ...requestMeta });
    return res.status(400).json({ error: 'Validation Error', details, requestId: req.id });
  }

  if (err.name === 'MulterError') {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'Arquivo maior que o limite de 15 MB' : 'Envio de arquivo inválido';
    logger.warn(`Upload error (${err.code}) — ${route}`);
    return res.status(status).json({ error: 'Bad Request', message, requestId: req.id });
  }

  if (err.name === 'UnauthorizedError') {
    logger.warn(`Unauthorized — ${route}`, requestMeta);
    return res.status(401).json({ error: 'Unauthorized', message: err.message, requestId: req.id });
  }

  if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
    logger.warn(`${err.message} — ${route}`, requestMeta);
    return res.status(err.statusCode).json({ error: 'Bad Request', message: err.message, requestId: req.id });
  }

  if (err.status && err.status >= 400 && err.status < 500) {
    logger.warn(`${err.message} — ${route}`, requestMeta);
    return res.status(err.status).json({ error: 'Bad Request', message: err.message, requestId: req.id });
  }

  // 500: o caso em que mais importa conseguir reconstruir o que aconteceu só pelo log —
  // stack trace completa + exatamente o que foi enviado na requisição.
  logger.error(`Internal Server Error — ${route}`, { ...stackMeta, ...requestMeta });
  return res.status(500).json({ error: 'Internal Server Error', requestId: req.id });
};

module.exports = errorHandler;
