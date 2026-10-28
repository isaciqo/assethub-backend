const AuditLog = require('../../../database/models/audit/auditLogModel');

class AuditRepository {
  async create(data) {
    const log = new AuditLog(data);
    return log.save();
  }

  async findByActor(actor_id, limit = 50) {
    return AuditLog.find({ actor_id }).sort({ createdAt: -1 }).limit(limit);
  }

  async findByResource(resource_type, resource_id) {
    return AuditLog.find({ resource_type, resource_id }).sort({ createdAt: -1 });
  }
}

module.exports = AuditRepository;
