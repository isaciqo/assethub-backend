const mongoose = require('mongoose');

const discrepancySchema = new mongoose.Schema({
  discrepancy_id: { type: String, required: true, unique: true },
  inventory_id: { type: String, required: true },
  unit_id: { type: String, required: true },
  asset_id: { type: String, default: null },
  asset_code: { type: String, required: true },
  check_id: { type: String, default: null },
  type: { type: String, required: true },
  // O que o cadastro diz × o que foi visto em campo.
  expected: { type: mongoose.Schema.Types.Mixed, default: null },
  observed: { type: mongoose.Schema.Types.Mixed, default: null },
  status: { type: String, enum: ['aberta', 'resolvida'], default: 'aberta' },
  resolution: {
    action: { type: String, default: null },
    note: { type: String, default: '' },
    resolved_by: { type: String, default: null },
    resolved_by_name: { type: String, default: '' },
    resolved_at: { type: Date, default: null },
    movement_id: { type: String, default: null },
  },
}, { timestamps: true });

discrepancySchema.index({ inventory_id: 1, status: 1 });
discrepancySchema.index({ unit_id: 1, status: 1 });

module.exports = mongoose.model('Discrepancy', discrepancySchema);
