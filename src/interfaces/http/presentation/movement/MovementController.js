const sendFile = require('../shared/sendFile');

class MovementController {
  constructor({
    createMovementOperation, listMovementsOperation, getMovementOperation, decideApprovalOperation,
    confirmDeliveryOperation, confirmReceiptOperation, resolveMovementIssueOperation,
    cancelMovementOperation, generateMovementTermOperation, verifyMovementOperation,
  }) {
    this.createMovementOperation = createMovementOperation;
    this.listMovementsOperation = listMovementsOperation;
    this.getMovementOperation = getMovementOperation;
    this.decideApprovalOperation = decideApprovalOperation;
    this.confirmDeliveryOperation = confirmDeliveryOperation;
    this.confirmReceiptOperation = confirmReceiptOperation;
    this.resolveMovementIssueOperation = resolveMovementIssueOperation;
    this.cancelMovementOperation = cancelMovementOperation;
    this.generateMovementTermOperation = generateMovementTermOperation;
    this.verifyMovementOperation = verifyMovementOperation;
  }

  async create(req, res) {
    res.status(201).json(await this.createMovementOperation.execute({ actor: req.user, data: req.body }));
  }

  async list(req, res) {
    res.status(200).json(await this.listMovementsOperation.execute({ actor: req.user, ...req.query }));
  }

  async detail(req, res) {
    res.status(200).json(await this.getMovementOperation.execute({ actor: req.user, movement_id: req.params.movement_id }));
  }

  async decide(req, res) {
    res.status(200).json(await this.decideApprovalOperation.execute({ actor: req.user, movement_id: req.params.movement_id, ...req.body }));
  }

  async deliver(req, res) {
    res.status(200).json(await this.confirmDeliveryOperation.execute({ actor: req.user, movement_id: req.params.movement_id, input: req.body }));
  }

  async receive(req, res) {
    res.status(200).json(await this.confirmReceiptOperation.execute({ actor: req.user, movement_id: req.params.movement_id, input: req.body }));
  }

  async resolveIssue(req, res) {
    res.status(200).json(await this.resolveMovementIssueOperation.execute({ actor: req.user, movement_id: req.params.movement_id, ...req.body }));
  }

  async cancel(req, res) {
    res.status(200).json(await this.cancelMovementOperation.execute({ actor: req.user, movement_id: req.params.movement_id, ...req.body }));
  }

  async term(req, res) {
    sendFile(res, await this.generateMovementTermOperation.execute(req.params.movement_id), { inline: true });
  }

  async verify(req, res) {
    res.status(200).json(await this.verifyMovementOperation.execute({ movement_id: req.params.movement_id, h: req.query.h }));
  }
}

module.exports = MovementController;
