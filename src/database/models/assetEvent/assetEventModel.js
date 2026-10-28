const mongoose = require('mongoose');

// Linha do tempo do bem: importação, conferências, pendências resolvidas,
// movimentações. Nunca é editada — mudança relevante gera um evento novo.
const assetEventSchema = new mongoose.Schema({
  event_id: { type: String, required: true, unique: true },
  asset_id: { type: String, required: true },
  event_type: { type: String, required: true },
  summary: { type: String, required: true },
  performed_by: { type: String, default: null },
  performed_by_name: { type: String, default: '' },
  reference_type: { type: String, default: null },
  reference_id: { type: String, default: null },
  changes: { type: mongoose.Schema.Types.Mixed, default: null },
  occurred_at: { type: Date, default: Date.now },
}, { timestamps: true });

assetEventSchema.index({ asset_id: 1, occurred_at: -1 });

module.exports = mongoose.model('AssetEvent', assetEventSchema);
