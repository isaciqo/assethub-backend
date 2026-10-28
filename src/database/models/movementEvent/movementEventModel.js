const mongoose = require('mongoose');

// Histórico encadeado: cada evento guarda o hash do anterior. Alterar ou apagar
// um evento antigo quebra a cadeia — a verificação pública do termo detecta.
const movementEventSchema = new mongoose.Schema({
  event_id: { type: String, required: true, unique: true },
  movement_id: { type: String, required: true },
  seq: { type: Number, required: true },
  event_type: { type: String, required: true },
  summary: { type: String, required: true },
  performed_by: { type: String, required: true },
  performed_by_name: { type: String, default: '' },
  // Papel em que a pessoa agiu (aprovador, entregador...). "admin" quando um
  // administrador executa a etapa no lugar da pessoa designada.
  acted_as: { type: String, default: '' },
  details: { type: mongoose.Schema.Types.Mixed, default: null },
  occurred_at: { type: Date, required: true },
  prev_hash: { type: String, default: null },
  hash: { type: String, required: true },
}, { timestamps: true });

movementEventSchema.index({ movement_id: 1, seq: 1 }, { unique: true });

module.exports = mongoose.model('MovementEvent', movementEventSchema);
