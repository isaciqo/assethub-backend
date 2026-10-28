const mongoose = require('mongoose');

// Validação de posse: o gerente pede e a pessoa responde, bem a bem, se ele
// ainda está com ela. "Não está" vira pendência para o gerente decidir.
const itemSchema = new mongoose.Schema({
  asset_id: { type: String, required: true },
  code: { type: String, required: true },
  description: { type: String, default: '' },
  location: { type: String, default: '' },
  has_it: { type: Boolean, default: null },
  note: { type: String, default: '' },
}, { _id: false });

const possessionCheckSchema = new mongoose.Schema({
  check_id: { type: String, required: true, unique: true },
  number: { type: String, required: true, unique: true },
  user_id: { type: String, required: true },
  user_name: { type: String, required: true },
  requested_by: { type: String, required: true },
  requested_by_name: { type: String, default: '' },
  status: { type: String, enum: ['pendente', 'respondida'], default: 'pendente' },
  items: { type: [itemSchema], default: [] },
  answered_at: { type: Date, default: null },
}, { timestamps: true });

possessionCheckSchema.index({ user_id: 1, status: 1 });

module.exports = mongoose.model('PossessionCheck', possessionCheckSchema);
