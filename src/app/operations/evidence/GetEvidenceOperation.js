const httpError = require('../../../lib/httpError');

class GetEvidenceOperation {
  constructor({ evidenceRepository }) {
    this.evidenceRepository = evidenceRepository;
  }

  async execute(evidence_id) {
    const evidence = await this.evidenceRepository.findById(evidence_id);
    if (!evidence) throw httpError(404, 'Evidência não encontrada');
    return { buffer: evidence.data, mime: evidence.mime, fileName: evidence.file_name || `${evidence.kind}-${evidence_id}` };
  }
}

module.exports = GetEvidenceOperation;
