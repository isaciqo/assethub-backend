const logger = require('../../../lib/logger');
const httpError = require('../../../lib/httpError');

class RefreshTokenOperation {
  constructor({ tokenService, userRepository, loginOperation }) {
    this.tokenService = tokenService;
    this.userRepository = userRepository;
    this.loginOperation = loginOperation;
  }

  async execute(refreshToken) {
    if (!refreshToken) throw httpError(401, 'Refresh token ausente.');

    let decoded;
    try {
      decoded = this.tokenService.verifyRefreshToken(refreshToken);
    } catch {
      throw httpError(401, 'Refresh token inválido ou expirado.');
    }

    const user = await this.userRepository.findById(decoded.user_id);
    if (!user || !user.active || user.tokenVersion !== decoded.tokenVersion) {
      throw httpError(401, 'Refresh token revogado. Faça login novamente.');
    }

    const accessToken = this.tokenService.generate(this.loginOperation.buildPayload(user));
    logger.info('refresh: novo access token emitido', { user_id: user.user_id });
    return { accessToken };
  }
}

module.exports = RefreshTokenOperation;
