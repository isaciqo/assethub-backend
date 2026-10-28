const httpError = require('../../../lib/httpError');
const { formatUser, formatUnit } = require('../../../lib/formatters');

class GetMeOperation {
  constructor({ userRepository, unitRepository }) {
    this.userRepository = userRepository;
    this.unitRepository = unitRepository;
  }

  async execute(user_id) {
    const user = await this.userRepository.findById(user_id);
    if (!user) throw httpError(404, 'Usuário não encontrado');
    const unit = user.unit_id ? await this.unitRepository.findById(user.unit_id) : null;
    return { ...formatUser(user), unit: formatUnit(unit) };
  }
}

module.exports = GetMeOperation;
