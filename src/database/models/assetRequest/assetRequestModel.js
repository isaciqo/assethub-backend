const mongoose = require('mongoose');
const { REQUEST_STATUS } = require('../../../lib/constants');

const historySchema = new mongoose.Schema({
  at: { type: Date, default: Date.now },
  by: { type: String, required: true },
  by_name: { type: String, default: '' },
  action: { type: String, required: true },
  note: { type: String, default: '' },
}, { _id: false });

// Solicitação de bem: o setor pede, o responsável pelo patrimônio decide —
// atender com um bem que já existe (vira movimentação), encaminhar para compra
// (gera ofício, fora do sistema) ou recusar.
const assetRequestSchema = new mongoose.Schema({
  request_id: { type: String, required: true, unique: true },
  // SOL-2026-0001
  number: { type: String, required: true, unique: true },
  requested_by: { type: String, required: true },
  requested_by_name: { type: String, default: '' },
  // Destino: por padrão, o setor de quem pede.
  unit_id: { type: String, required: true },
  sector: { type: String, default: '' },
  room: { type: String, default: '' },
  item: { type: String, required: true },
  category: { type: String, default: '' },
  quantity: { type: Number, default: 1 },
  justification: { type: String, required: true },
  urgency: { type: String, enum: ['normal', 'urgente'], default: 'normal' },
  attachment_evidence_id: { type: String, default: null },
  status: { type: String, enum: REQUEST_STATUS, default: 'aberta' },
  handled_by: { type: String, default: null },
  handled_by_name: { type: String, default: '' },
  decision_note: { type: String, default: '' },
  movement_ids: { type: [String], default: [] },
  purchase_justification: { type: String, default: '' },
  history: { type: [historySchema], default: [] },
}, { timestamps: true });

assetRequestSchema.index({ status: 1, createdAt: -1 });
assetRequestSchema.index({ requested_by: 1, createdAt: -1 });
assetRequestSchema.index({ movement_ids: 1 });

module.exports = mongoose.model('AssetRequest', assetRequestSchema);
