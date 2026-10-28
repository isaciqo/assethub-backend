const { v4: uuidv4 } = require('uuid');

// Anexa um evento ao histórico encadeado da movimentação e atualiza a ponta da
// cadeia no próprio documento da movimentação.
class MovementEventService {
  constructor({ movementEventRepository, movementRepository, hashChainService }) {
    this.movementEventRepository = movementEventRepository;
    this.movementRepository = movementRepository;
    this.hashChainService = hashChainService;
  }

  async append({ movement_id, event_type, summary, actor, acted_as = '', details = null }) {
    const last = await this.movementEventRepository.findLast(movement_id);
    const event = {
      event_id: uuidv4(),
      movement_id,
      seq: last ? last.seq + 1 : 1,
      event_type,
      summary,
      performed_by: actor.user_id,
      performed_by_name: actor.name || '',
      acted_as,
      // Ida e volta por JSON: some com `undefined` e vira Date em string ANTES do
      // hash — senão o documento relido do Mongo (sem essas chaves) não bateria.
      details: details == null ? null : JSON.parse(JSON.stringify(details)),
      // Milissegundos zerados: o Mongo guarda Date com precisão de ms, mas não
      // custa garantir que o ISO relido seja idêntico ao que entrou no hash.
      occurred_at: new Date(Math.floor(Date.now() / 1000) * 1000),
      prev_hash: last ? last.hash : null,
    };
    event.hash = this.hashChainService.hashEvent(event);

    const saved = await this.movementEventRepository.create(event);
    await this.movementRepository.update(movement_id, { chain_head: event.hash });
    return saved;
  }
}

module.exports = MovementEventService;
