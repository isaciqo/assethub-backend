const { v4: uuidv4 } = require('uuid');
const httpError = require('../../../lib/httpError');
const logger = require('../../../lib/logger');
const { formatUser } = require('../../../lib/formatters');

class CreateUserOperation {
  constructor({ userRepository, hashPasswordService, auditService }) {
    this.userRepository = userRepository;
    this.hashPasswordService = hashPasswordService;
    this.auditService = auditService;
  }

  async execute({ actor, name, email, password, role, registration, unit_id }) {
    if (await this.userRepository.findByEmail(email)) throw httpError(409, 'Já existe um usuário com esse e-mail');

    const user = await this.userRepository.create({
      user_id: uuidv4(),
      name,
      email,
      password: await this.hashPasswordService.hash(password),
      role,
      registration: registration || '',
      unit_id: unit_id || null,
    });

    await this.auditService.log({ actor_id: actor.user_id, action: 'user.create', resource_type: 'user', resource_id: user.user_id, metadata: { role } });
    logger.info('user.create: usuário criado', { user_id: user.user_id, role });
    return formatUser(user);
  }
}

module.exports = CreateUserOperation;
