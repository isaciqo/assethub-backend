const { v4: uuidv4 } = require('uuid');
const logger = require('../../lib/logger');

class AuditService {
  constructor({ auditRepository }) {
    this.auditRepository = auditRepository;
  }

  async log({ actor_id, action, resource_type, resource_id = null, ip_address = null, metadata = null }) {
    try {
      await this.auditRepository.create({
        audit_id: uuidv4(),
        actor_id,
        action,
        resource_type,
        resource_id,
        ip_address,
        metadata,
      });
    } catch (err) {
      // Falha na auditoria nunca deve interromper a operação principal
      logger.error('Falha ao registrar auditoria', { action, actor_id, error: err.message });
    }
  }
}

module.exports = AuditService;
