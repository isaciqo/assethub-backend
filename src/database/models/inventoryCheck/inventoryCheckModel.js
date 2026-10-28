const mongoose = require('mongoose');
const { CHECK_STATUS, CHECK_METHODS, CONSERVATION_STATUS } = require('../../../lib/constants');

const geoSchema = new mongoose.Schema({
  lat: Number,
  lng: Number,
  accuracy: { type: Number, default: null },
  distance_m: { type: Number, default: null },
  outside_unit: { type: Boolean, default: false },
}, { _id: false });

const inventoryCheckSchema = new mongoose.Schema({
  check_id: { type: String, required: true, unique: true },
  // UUID gerado NO DISPOSITIVO. É a chave de idempotência da sincronização:
  // reenviar a mesma operação nunca cria uma segunda conferência.
  operation_id: { type: String, required: true, unique: true },
  inventory_id: { type: String, required: true },
  asset_id: { type: String, default: null },
  asset_code: { type: String, required: true },
  observed_location: { type: String, default: '' },
  observed_condition: { type: String, enum: CONSERVATION_STATUS, default: 'bom' },
  observed_responsible: { type: String, default: '' },
  observed_description: { type: String, default: '' },
  notes: { type: String, default: '' },
  photo_evidence_id: { type: String, default: null },
  check_status: { type: String, enum: CHECK_STATUS, required: true },
  // Só uma conferência primária por bem em cada inventário (índice parcial
  // abaixo). As demais ficam registradas como duplicadas, para revisão.
  is_primary: { type: Boolean, default: true },
  method: { type: String, enum: CHECK_METHODS, default: 'manual' },
  // Tempo gasto pelo conferente neste bem (medido no aparelho) — base da
  // métrica "tempo médio por bem" mostrada no painel.
  elapsed_ms: { type: Number, default: null },
  device_id: { type: String, default: '' },
  checked_by: { type: String, required: true },
  checked_by_name: { type: String, default: '' },
  checked_at: { type: Date, required: true },
  synced_at: { type: Date, default: Date.now },
  was_offline: { type: Boolean, default: false },
  // Onde o aparelho estava no momento da leitura (null se a pessoa negou o GPS).
  geo: { type: geoSchema, default: null },
}, { timestamps: true });

inventoryCheckSchema.index(
  { inventory_id: 1, asset_id: 1 },
  { unique: true, partialFilterExpression: { is_primary: true, asset_id: { $type: 'string' } } },
);
inventoryCheckSchema.index({ inventory_id: 1, checked_at: -1 });

module.exports = mongoose.model('InventoryCheck', inventoryCheckSchema);
