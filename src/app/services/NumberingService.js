class NumberingService {
  constructor({ counterRepository }) {
    this.counterRepository = counterRepository;
  }

  // INV-2026-0001 / MOV-2026-0001 — reinicia a contagem a cada ano.
  async next(prefix) {
    const year = new Date().getFullYear();
    const value = await this.counterRepository.next(`${prefix}-${year}`);
    return `${prefix}-${year}-${String(value).padStart(4, '0')}`;
  }
}

module.exports = NumberingService;
