const mongoose = require('mongoose');
const { CONSERVATION_STATUS, ASSET_STATUS } = require('../../../lib/constants');

const assetSchema = new mongoose.Schema({
  asset_id: { type: String, required: true, unique: true },
  // Número de tombamento/plaqueta exatamente como veio da planilha.
  code: { type: String, required: true },
  // Versão comparável do código (sem pontuação nem zeros à esquerda) — é por ela
  // que a leitura do QR/código de barras/OCR encontra o bem.
  code_normalized: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  category: { type: String, default: 'Outros' },
  brand: { type: String, default: '' },
  serial_number: { type: String, default: '' },
  unit_id: { type: String, required: true },
  location: { type: String, default: '' },
  responsible_name: { type: String, default: '' },
  conservation_status: { type: String, enum: CONSERVATION_STATUS, default: 'bom' },
  status: { type: String, enum: ASSET_STATUS, default: 'ativo' },
  acquisition_date: { type: Date, default: null },
  value: { type: Number, default: null },
  notes: { type: String, default: '' },
  last_checked_at: { type: Date, default: null },
  last_inventory_id: { type: String, default: null },
  // Movimentação em curso que "trava" o bem (não pode entrar em outra ao mesmo tempo).
  active_movement_id: { type: String, default: null },
}, { timestamps: true });

assetSchema.index({ unit_id: 1, location: 1 });
assetSchema.index({ unit_id: 1, status: 1 });

module.exports = mongoose.model('Asset', assetSchema);
