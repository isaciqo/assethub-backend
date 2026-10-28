const sendFile = require('../shared/sendFile');

class MetaController {
  constructor({ getMetaOperation, getDashboardOperation, getEvidenceOperation }) {
    this.getMetaOperation = getMetaOperation;
    this.getDashboardOperation = getDashboardOperation;
    this.getEvidenceOperation = getEvidenceOperation;
  }

  async meta(req, res) {
    res.status(200).json(this.getMetaOperation.execute());
  }

  async dashboard(req, res) {
    res.status(200).json(await this.getDashboardOperation.execute());
  }

  async evidence(req, res) {
    const file = await this.getEvidenceOperation.execute(req.params.evidence_id);
    sendFile(res, file, { inline: true });
  }
}

module.exports = MetaController;
