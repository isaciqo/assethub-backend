const jwt = require('jsonwebtoken');

class TokenService {
  constructor() {
    if (!process.env.JWT_ACCESS_SECRET) throw new Error('JWT_ACCESS_SECRET não configurado');
    if (!process.env.JWT_REFRESH_SECRET) throw new Error('JWT_REFRESH_SECRET não configurado');
    this.accessSecret = process.env.JWT_ACCESS_SECRET;
    this.refreshSecret = process.env.JWT_REFRESH_SECRET;
    this.accessExpiresIn = process.env.JWT_EXPIRES_IN || '15m';
    this.refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  }

  generate(payload) {
    return jwt.sign(payload, this.accessSecret, { expiresIn: this.accessExpiresIn });
  }

  verify(token) {
    return jwt.verify(token, this.accessSecret);
  }

  generateRefreshToken(payload) {
    return jwt.sign(payload, this.refreshSecret, { expiresIn: this.refreshExpiresIn });
  }

  verifyRefreshToken(token) {
    return jwt.verify(token, this.refreshSecret);
  }

  generateTempToken(payload, expiresIn = '1h') {
    return jwt.sign(payload, this.accessSecret, { expiresIn });
  }

  // Lê o payload SEM validar assinatura/expiração. Use só quando um token
  // expirado ainda precisa ser inspecionado (ex: extrair o e-mail de um link
  // de confirmação vencido pra reenviar um novo). Nunca confie nisso pra auth.
  decode(token) {
    return jwt.decode(token);
  }
}

module.exports = TokenService;
