// "Aceitar as 12 novas localizações de uma vez": cada item continua passando
// pela mesma validação e gera o mesmo histórico de uma resolução individual.
class BulkResolveDiscrepanciesOperation {
  constructor({ resolveDiscrepancyOperation }) {
    this.resolveDiscrepancyOperation = resolveDiscrepancyOperation;
  }

  async execute({ actor, ids, action, note }) {
    const results = [];
    for (const discrepancy_id of ids) {
      try {
        await this.resolveDiscrepancyOperation.execute({ actor, discrepancy_id, action, note });
        results.push({ id: discrepancy_id, ok: true });
      } catch (err) {
        results.push({ id: discrepancy_id, ok: false, message: err.message });
      }
    }
    return { resolved: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok), results };
  }
}

module.exports = BulkResolveDiscrepanciesOperation;
