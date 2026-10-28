const Evidence = require('../../../database/models/evidence/evidenceModel');

class EvidenceRepository {
  async create(data) {
    return new Evidence(data).save();
  }

  async findById(evidence_id) {
    return Evidence.findOne({ evidence_id });
  }

  // Metadados sem o binário — listagens nunca precisam carregar as imagens.
  async findMetaByOwner(owner_type, owner_id) {
    return Evidence.find({ owner_type, owner_id }).select('-data').sort({ createdAt: 1 });
  }

  async findMetaByIds(ids) {
    if (!ids.length) return [];
    return Evidence.find({ evidence_id: { $in: ids } }).select('-data');
  }
}

module.exports = EvidenceRepository;
