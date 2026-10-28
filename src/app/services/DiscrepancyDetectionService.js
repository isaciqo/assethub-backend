const { DISCREPANCY_TYPES: T } = require('../../lib/constants');
const { sameText } = require('../../lib/text');

// Regra pura (sem banco): dado o cadastro e o que foi visto em campo, diz qual o
// status da conferência e quais pendências ela gera. Isolada para ser testável e
// para que o front e o backend falem exatamente a mesma língua sobre "divergência".
class DiscrepancyDetectionService {
  detect({ asset, inventory, observed }) {
    if (!asset) {
      return {
        check_status: 'nao_cadastrado',
        discrepancies: [{
          type: T.NAO_CADASTRADO,
          expected: null,
          observed: {
            location: observed.location || '',
            description: observed.description || '',
            condition: observed.condition || null,
          },
        }],
      };
    }

    const discrepancies = [];

    if (asset.unit_id !== inventory.unit_id) {
      discrepancies.push({
        type: T.OUTRA_UNIDADE,
        expected: { unit_id: asset.unit_id, location: asset.location },
        observed: { unit_id: inventory.unit_id, location: observed.location || '' },
      });
    } else if (observed.location && !sameText(observed.location, asset.location)) {
      discrepancies.push({
        type: T.LOCALIZACAO_DIVERGENTE,
        expected: { location: asset.location },
        observed: { location: observed.location },
      });
    }

    if (observed.condition && observed.condition !== asset.conservation_status) {
      discrepancies.push({
        type: T.ESTADO_ALTERADO,
        expected: { condition: asset.conservation_status },
        observed: { condition: observed.condition },
      });
    }

    // Responsável só é comparado quando o conferente informou um — campo em
    // branco significa "não verifiquei", não "não tem responsável".
    if (observed.responsible && !sameText(observed.responsible, asset.responsible_name)) {
      discrepancies.push({
        type: T.RESPONSAVEL_DIVERGENTE,
        expected: { responsible_name: asset.responsible_name },
        observed: { responsible_name: observed.responsible },
      });
    }

    let check_status = 'ok';
    if (discrepancies.some(d => d.type === T.OUTRA_UNIDADE)) check_status = 'outra_unidade';
    else if (discrepancies.length) check_status = 'divergente';

    return { check_status, discrepancies };
  }
}

module.exports = DiscrepancyDetectionService;
