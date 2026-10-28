class DiscrepancyController {
  constructor({ listDiscrepanciesOperation, resolveDiscrepancyOperation, bulkResolveDiscrepanciesOperation }) {
    this.listDiscrepanciesOperation = listDiscrepanciesOperation;
    this.resolveDiscrepancyOperation = resolveDiscrepancyOperation;
    this.bulkResolveDiscrepanciesOperation = bulkResolveDiscrepanciesOperation;
  }

  async list(req, res) {
    res.status(200).json(await this.listDiscrepanciesOperation.execute(req.query));
  }

  async resolve(req, res) {
    res.status(200).json(await this.resolveDiscrepancyOperation.execute({ actor: req.user, discrepancy_id: req.params.discrepancy_id, ...req.body }));
  }

  async bulkResolve(req, res) {
    res.status(200).json(await this.bulkResolveDiscrepanciesOperation.execute({ actor: req.user, ...req.body }));
  }
}

module.exports = DiscrepancyController;
