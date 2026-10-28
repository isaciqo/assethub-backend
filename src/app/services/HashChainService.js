const crypto = require('crypto');

// Serialização estável: a ordem das chaves não pode mudar o hash, senão um
// documento relido do Mongo (que pode reordenar campos) "quebraria" a cadeia.
function stableStringify(value) {
  if (value === null || value === undefined) return 'null';
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

class HashChainService {
  sha256(input) {
    return crypto.createHash('sha256').update(input).digest('hex');
  }

  eventPayload(event) {
    return {
      movement_id: event.movement_id,
      seq: event.seq,
      event_type: event.event_type,
      performed_by: event.performed_by,
      acted_as: event.acted_as || '',
      occurred_at: new Date(event.occurred_at).toISOString(),
      details: event.details ?? null,
      prev_hash: event.prev_hash ?? null,
    };
  }

  hashEvent(event) {
    return this.sha256(stableStringify(this.eventPayload(event)));
  }

  // Recalcula a cadeia inteira. Qualquer evento alterado, removido ou inserido
  // fora de ordem aparece como `brokenAt` (seq do primeiro elo inválido).
  verify(events) {
    let prev = null;
    for (const event of events) {
      const plain = typeof event.toObject === 'function' ? event.toObject() : event;
      if ((plain.prev_hash ?? null) !== prev) return { valid: false, brokenAt: plain.seq, head: null };
      const expected = this.hashEvent(plain);
      if (expected !== plain.hash) return { valid: false, brokenAt: plain.seq, head: null };
      prev = plain.hash;
    }
    return { valid: true, brokenAt: null, head: prev };
  }
}

HashChainService.stableStringify = stableStringify;

module.exports = HashChainService;
