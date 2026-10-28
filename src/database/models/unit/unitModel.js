const mongoose = require('mongoose');

const unitSchema = new mongoose.Schema({
  unit_id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  city: { type: String, default: '' },
  // capital | interior — usado no painel de equidade entre capital e interior.
  region: { type: String, enum: ['capital', 'interior'], default: 'interior' },
  // Salas/setores conhecidos. Cresce sozinho na importação e nas conferências.
  locations: { type: [String], default: [] },
  // Ponto de referência (fixado pelo gerente no local) para saber se uma
  // conferência ou envio foi feito na unidade.
  geo: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
  },
}, { timestamps: true });

module.exports = mongoose.model('Unit', unitSchema);
