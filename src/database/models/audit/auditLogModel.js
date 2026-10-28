const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  audit_id: { type: String, required: true, unique: true },
  actor_id: { type: String, required: true },
  action: { type: String, required: true },
  resource_type: { type: String, required: true },
  resource_id: { type: String, default: null },
  ip_address: { type: String, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: true });

// Auto-delete após 1 ano
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
