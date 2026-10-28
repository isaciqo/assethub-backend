class UserController {
  constructor({ listUsersOperation, createUserOperation }) {
    this.listUsersOperation = listUsersOperation;
    this.createUserOperation = createUserOperation;
  }

  async list(req, res) {
    res.status(200).json(await this.listUsersOperation.execute(req.query));
  }

  async create(req, res) {
    res.status(201).json(await this.createUserOperation.execute({ actor: req.user, ...req.body }));
  }
}

module.exports = UserController;
