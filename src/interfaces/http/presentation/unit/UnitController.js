class UnitController {
  constructor({ listUnitsOperation, createUnitOperation }) {
    this.listUnitsOperation = listUnitsOperation;
    this.createUnitOperation = createUnitOperation;
  }

  async list(req, res) {
    res.status(200).json(await this.listUnitsOperation.execute());
  }

  async create(req, res) {
    res.status(201).json(await this.createUnitOperation.execute({ actor: req.user, ...req.body }));
  }
}

module.exports = UnitController;
