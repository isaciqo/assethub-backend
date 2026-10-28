const sendFile = require('../shared/sendFile');

class InventoryController {
  constructor({
    createInventoryOperation, listInventoriesOperation, getInventoryOperation, getInventorySnapshotOperation,
    completeInventoryOperation, exportInventoryOperation, listInventoryChecksOperation, syncChecksOperation,
  }) {
    this.createInventoryOperation = createInventoryOperation;
    this.listInventoriesOperation = listInventoriesOperation;
    this.getInventoryOperation = getInventoryOperation;
    this.getInventorySnapshotOperation = getInventorySnapshotOperation;
    this.completeInventoryOperation = completeInventoryOperation;
    this.exportInventoryOperation = exportInventoryOperation;
    this.listInventoryChecksOperation = listInventoryChecksOperation;
    this.syncChecksOperation = syncChecksOperation;
  }

  async create(req, res) {
    res.status(201).json(await this.createInventoryOperation.execute({ actor: req.user, ...req.body }));
  }

  async list(req, res) {
    res.status(200).json(await this.listInventoriesOperation.execute(req.query));
  }

  async detail(req, res) {
    res.status(200).json(await this.getInventoryOperation.execute(req.params.inventory_id));
  }

  async snapshot(req, res) {
    res.status(200).json(await this.getInventorySnapshotOperation.execute(req.params.inventory_id));
  }

  async checks(req, res) {
    res.status(200).json(await this.listInventoryChecksOperation.execute(req.params.inventory_id));
  }

  async complete(req, res) {
    res.status(200).json(await this.completeInventoryOperation.execute({ actor: req.user, inventory_id: req.params.inventory_id }));
  }

  async exportFile(req, res) {
    const file = await this.exportInventoryOperation.execute({ inventory_id: req.params.inventory_id, format: req.query.format });
    sendFile(res, file, { inline: req.query.format === 'pdf' });
  }

  async sync(req, res) {
    res.status(200).json(await this.syncChecksOperation.execute({ actor: req.user, operations: req.body.operations }));
  }
}

module.exports = InventoryController;
