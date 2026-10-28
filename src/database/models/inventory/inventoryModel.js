const mongoose = require('mongoose');
const { INVENTORY_STATUS } = require('../../../lib/constants');

const inventorySchema = new mongoose.Schema({
  inventory_id: { type: String, required: true, unique: true },
  // Número legível (INV-2026-0001) usado na tela e nos relatórios.
  number: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  unit_id: { type: String, required: true },
  // Vazio = unidade inteira. Preenchido = só essas salas/setores.
  locations: { type: [String], default: [] },
  status: { type: String, enum: INVENTORY_STATUS, default: 'em_andamento' },
  // Lista prevista congelada na abertura: bens importados depois não mudam o
  // denominador do progresso nem viram "não localizado" por engano.
  expected_asset_ids: { type: [String], default: [] },
  started_at: { type: Date, default: Date.now },
  completed_at: { type: Date, default: null },
  created_by: { type: String, required: true },
  completed_by: { type: String, default: null },
}, { timestamps: true });

inventorySchema.index({ unit_id: 1, status: 1 });

module.exports = mongoose.model('Inventory', inventorySchema);
