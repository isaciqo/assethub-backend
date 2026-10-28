const crypto = require('crypto');
const requestContext = require('../../../lib/requestContext');

// Precisa ser o primeiro middleware da cadeia — abre o contexto assíncrono que
// todo o resto da requisição (incluindo o webhook do Stripe, registrado antes do
// express.json()) vai herdar. Um request_id curto o suficiente pra grep manual no log.
function requestContextMiddleware(req, res, next) {
  const requestId = crypto.randomBytes(6).toString('hex');
  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);

  requestContext.run({ requestId, ip: req.ip }, next);
}

module.exports = requestContextMiddleware;
