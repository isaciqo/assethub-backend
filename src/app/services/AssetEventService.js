const { v4: uuidv4 } = require('uuid');
const logger = require('../../lib/logger');

class AssetEventService {
  constructor({ assetEventRepository }) {
    this.assetEventRepository = assetEventRepository;
  }

  build({ asset_id, event_type, summary, actor, reference_type = null, reference_id = null, changes = null, occurred_at }) {
    return {
      event_id: uuidv4(),
      asset_id,
      event_type,
      summary,
      performed_by: actor?.user_id || null,
      performed_by_name: actor?.name || '',
      reference_type,
      reference_id,
      changes,
      occurred_at: occurred_at || new Date(),
    };
  }

  async record(params) {
    try {
      return await this.assetEventRepository.create(this.build(params));
    } catch (err) {
      // Histórico é importante, mas nunca pode derrubar a operação principal
      // (mesmo raciocínio do AuditService do MEDagenda).
      logger.error('assetEvent: falha ao registrar', { asset_id: params.asset_id, error: err.message });
      return null;
    }
  }

  async recordMany(list) {
    try {
      return await this.assetEventRepository.createMany(list.map(p => this.build(p)));
    } catch (err) {
      logger.error('assetEvent: falha ao registrar lote', { count: list.length, error: err.message });
      return [];
    }
  }
}

module.exports = AssetEventService;
