// Mesmo contrato que o errorHandler já entende (err.statusCode 4xx vira resposta
// com a mensagem), só sem repetir as três linhas em toda operation.
function httpError(statusCode, message, extra = {}) {
  const error = new Error(message);
  error.statusCode = statusCode;
  Object.assign(error, extra);
  return error;
}

module.exports = httpError;
