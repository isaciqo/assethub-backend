// Lazy require — requestContext.js não depende de logger.js, mas evita qualquer
// risco de ciclo se isso mudar no futuro.
const requestContext = require('./requestContext');

function write(level, message, meta = {}) {
  const color = { error: '\x1b[31m', warn: '\x1b[33m', info: '\x1b[36m' }[level] || '';
  const reset = '\x1b[0m';
  const method = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);

  // Injeta request_id/user_id/email automaticamente em TODO log emitido durante esta
  // requisição — inclusive dentro de operations que nunca receberam esses dados como
  // parâmetro. `meta` explícito tem prioridade (ex: inventory_id continua aparecendo como
  // está hoje); isso só preenche o que a chamada não informou.
  const store = requestContext.get();
  const autoContext = store
    ? {
        request_id: store.requestId,
        user_id: store.userId,
        email: store.email,
      }
    : {};
  meta = { ...autoContext, ...meta };

  const skip = new Set(['stack', 'details']);
  const parts = Object.entries(meta)
    .filter(([k]) => !skip.has(k))
    .map(([k, v]) => {
      if (v === null || v === undefined) return null;
      const str = typeof v === 'object' ? JSON.stringify(v) : String(v);
      return `${k}=${str}`;
    })
    .filter(Boolean);

  const metaStr = parts.length ? ' | ' + parts.join(' ') : '';

  console[method](`${color}[${level.toUpperCase()}]${reset} ${ts} ${message}${metaStr}`);

  if (level === 'error' && meta.stack) {
    console.error(meta.stack);
  }
}

const logger = {
  info: (message, meta = {}) => write('info', message, meta),
  warn: (message, meta = {}) => write('warn', message, meta),
  error: (message, meta = {}) => write('error', message, meta),
};

module.exports = logger;
