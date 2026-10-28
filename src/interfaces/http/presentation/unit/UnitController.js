class UnitController {
  constructor({ listUnitsOperation, createUnitOperation, setUnitLocationOperation }) {
    this.listUnitsOperation = listUnitsOperation;
    this.createUnitOperation = createUnitOperation;
    this.setUnitLocationOperation = setUnitLocationOperation;
  }

  async list(req, res) {
    res.status(200).json(await this.listUnitsOperation.execute());
  }

  async setLocation(req, res) {
    res.status(200).json(await this.setUnitLocationOperation.execute({ actor: req.user, unit_id: req.params.unit_id, geo: req.body }));
  }

  async create(req, res) {
    res.status(201).json(await this.createUnitOperation.execute({ actor: req.user, ...req.body }));
  }
}

module.exports = UnitController;
