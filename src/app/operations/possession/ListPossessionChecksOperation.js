const { formatPossessionCheck } = require('../../../lib/formatters');

class ListPossessionChecksOperation {
  constructor({ possessionCheckRepository }) {
    this.possessionCheckRepository = possessionCheckRepository;
  }

  async execute() {
    const list = await this.possessionCheckRepository.find({});
    return list.map(formatPossessionCheck);
  }
}

module.exports = ListPossessionChecksOperation;
