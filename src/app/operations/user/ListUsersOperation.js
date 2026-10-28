const { formatUser } = require('../../../lib/formatters');

class ListUsersOperation {
  constructor({ userRepository }) {
    this.userRepository = userRepository;
  }

  async execute({ role, unit_id } = {}) {
    const filter = {};
    if (role) filter.role = role;
    if (unit_id) filter.unit_id = unit_id;
    const users = await this.userRepository.findAll(filter);
    return users.map(formatUser);
  }
}

module.exports = ListUsersOperation;
