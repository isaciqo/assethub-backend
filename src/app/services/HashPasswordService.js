const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;

// bcryptjs (JS puro) em vez de bcrypt nativo: a imagem Alpine do Docker sobe sem
// precisar de toolchain de compilação. Mesmo formato de hash, mesma interface.
class HashPasswordService {
  async hash(password) {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  async compare(plain, hashed) {
    return bcrypt.compare(plain, hashed);
  }
}

module.exports = HashPasswordService;
