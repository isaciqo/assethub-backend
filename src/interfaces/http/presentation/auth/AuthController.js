class AuthController {
  constructor({ loginOperation, refreshTokenOperation, getMeOperation, auditService }) {
    this.loginOperation = loginOperation;
    this.refreshTokenOperation = refreshTokenOperation;
    this.getMeOperation = getMeOperation;
    this.auditService = auditService;
  }

  async login(req, res) {
    const result = await this.loginOperation.execute({ ...req.body, ip: req.ip });
    res.status(200).json(result);
  }

  async refresh(req, res) {
    const result = await this.refreshTokenOperation.execute(req.body.refreshToken);
    res.status(200).json(result);
  }

  async me(req, res) {
    const result = await this.getMeOperation.execute(req.user.user_id);
    res.status(200).json(result);
  }

  // Logout é local (o app apaga os tokens). Não incrementa tokenVersion de
  // propósito: derrubaria a sessão de um colega usando a mesma conta num
  // aparelho que está offline em campo, com conferências ainda não enviadas.
  async logout(req, res) {
    await this.auditService.log({ actor_id: req.user.user_id, action: 'auth.logout', resource_type: 'user', resource_id: req.user.user_id, ip_address: req.ip });
    res.status(204).end();
  }
}

module.exports = AuthController;
