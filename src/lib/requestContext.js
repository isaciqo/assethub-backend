const { AsyncLocalStorage } = require('async_hooks');

// Contexto por requisição (request_id, ip, e depois do authMiddleware: user_id/email/role).
// Qualquer chamada de logger.*() em qualquer profundidade da pilha assíncrona desta
// requisição (controller, operation, service) consegue ler esse contexto sem precisar
// receber request_id/user manualmente — ver logger.js.
const storage = new AsyncLocalStorage();

function run(store, callback) {
  return storage.run(store, callback);
}

function get() {
  return storage.getStore();
}

// Chamado pelo authMiddleware assim que o JWT é validado — enriquece o contexto já
// aberto pela requestContextMiddleware com a identidade do usuário.
function setUser({ user_id, email, role }) {
  const store = get();
  if (store) {
    store.userId = user_id;
    store.email = email;
    store.role = role;
  }
}

module.exports = { run, get, setUser };
