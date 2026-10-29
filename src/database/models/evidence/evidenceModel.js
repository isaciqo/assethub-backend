const mongoose = require('mongoose');
const { EVIDENCE_KINDS } = require('../../../lib/constants');

// No MVP o binário fica no próprio Mongo (fotos já chegam comprimidas pelo app,
// ~100 KB). Em produção, trocar `data` por uma referência a storage S3-compatível
// — o resto do sistema só conhece evidence_id.
const evidenceSchema = new mongoose.Schema({
  evidence_id: { type: String, required: true, unique: true },
  owner_type: { type: String, enum: ['movement', 'check', 'asset', 'request'], required: true },
  owner_id: { type: String, required: true },
  stage: { type: String, default: '' },
  kind: { type: String, enum: EVIDENCE_KINDS, required: true },
  mime: { type: String, required: true },
  file_name: { type: String, default: '' },
  size: { type: Number, required: true },
  sha256: { type: String, required: true },
  data: { type: Buffer, required: true },
  description: { type: String, default: '' },
  created_by: { type: String, required: true },
  created_by_name: { type: String, default: '' },
}, { timestamps: true });

evidenceSchema.index({ owner_type: 1, owner_id: 1 });

module.exports = mongoose.model('Evidence', evidenceSchema);
