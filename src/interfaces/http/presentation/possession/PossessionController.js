class PossessionController {
  constructor({ getMyAreaOperation, createPossessionChecksOperation, listPossessionChecksOperation, answerPossessionCheckOperation, startInventoryValidationOperation }) {
    this.startInventoryValidationOperation = startInventoryValidationOperation;
    this.getMyAreaOperation = getMyAreaOperation;
    this.createPossessionChecksOperation = createPossessionChecksOperation;
    this.listPossessionChecksOperation = listPossessionChecksOperation;
    this.answerPossessionCheckOperation = answerPossessionCheckOperation;
  }

  async myArea(req, res) {
    res.status(200).json(await this.getMyAreaOperation.execute({ actor: req.user }));
  }

  async create(req, res) {
    res.status(201).json(await this.createPossessionChecksOperation.execute({ actor: req.user, user_ids: req.body.user_ids }));
  }

  async list(req, res) {
    res.status(200).json(await this.listPossessionChecksOperation.execute());
  }

  async startInventoryValidation(req, res) {
    res.status(201).json(await this.startInventoryValidationOperation.execute({ actor: req.user, inventory_id: req.params.inventory_id }));
  }

  async answer(req, res) {
    res.status(200).json(await this.answerPossessionCheckOperation.execute({ actor: req.user, check_id: req.params.check_id, answers: req.body.answers }));
  }
}

module.exports = PossessionController;
