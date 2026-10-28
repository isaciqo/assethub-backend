const logger = require('../../../lib/logger');
const httpError = require('../../../lib/httpError');

class LoginOperation {
  constructor({ userRepository, hashPasswordService, tokenService, auditService }) {
    this.userRepository = userRepository;
    this.hashPasswordService = hashPasswordService;
    this.tokenService = tokenService;
    this.auditService = auditService;
  }

  async execute({ email, password, ip }) {
    logger.info('login: tentativa', { email });
    const user = await this.userRepository.findByEmail(email);
    // Mesma mensagem para e-mail inexistente e senha errada — não revela quem tem conta.
    const valid = user && user.active && await this.hashPasswordService.compare(password, user.password);
    if (!valid) {
      logger.warn('login: falhou', { email });
      throw httpError(401, 'E-mail ou senha inválidos');
    }

    const payload = this.buildPayload(user);
    const accessToken = this.tokenService.generate(payload);
    const refreshToken = this.tokenService.generateRefreshToken(payload);

    await this.auditService.log({ actor_id: user.user_id, action: 'auth.login', resource_type: 'user', resource_id: user.user_id, ip_address: ip });
    logger.info('login: sucesso', { email, user_id: user.user_id });
    return { accessToken, refreshToken };
  }

  buildPayload(user) {
    return {
      user_id: user.user_id,
      email: user.email,
      name: user.name,
      role: user.role,
      unit_id: user.unit_id || null,
      tokenVersion: user.tokenVersion ?? 0,
    };
  }
}

module.exports = LoginOperation;
