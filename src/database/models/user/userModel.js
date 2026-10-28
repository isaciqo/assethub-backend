const mongoose = require('mongoose');
const { ROLES } = require('../../../lib/constants');

const userSchema = new mongoose.Schema({
  user_id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  // Matrícula funcional — vai impressa no termo de entrega/recebimento.
  registration: { type: String, default: '' },
  role: { type: String, enum: ROLES, default: 'conferente' },
  // Unidade de lotação: define o inventário sugerido e o filtro padrão do painel.
  unit_id: { type: String, default: null },
  active: { type: Boolean, default: true },
  // Mesmo mecanismo do MEDagenda: incrementar invalida todos os tokens emitidos.
  tokenVersion: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
