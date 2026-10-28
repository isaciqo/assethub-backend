// Atalho para o bloco `swagger` das rotas: tag, resumo e se exige Bearer.
module.exports = (tag, summary, { auth = true, extra = {} } = {}) => ({
  tags: [tag],
  summary,
  ...(auth ? { security: [{ BearerAuth: [] }] } : {}),
  responses: { 200: { description: 'Success' } },
  ...extra,
});
