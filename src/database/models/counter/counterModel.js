const mongoose = require('mongoose');

// Sequência atômica para números legíveis (INV-2026-0001, MOV-2026-0001).
const counterSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: Number, default: 0 },
});

module.exports = mongoose.model('Counter', counterSchema);
