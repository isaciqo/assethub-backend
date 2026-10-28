const {
  ROLES, CONSERVATION_STATUS, ASSET_STATUS, MOVEMENT_TYPES, DISCREPANCY_ACTIONS, CHECK_METHODS,
} = require('../../../lib/constants');

// Regras configuráveis expostas ao front — assim a tela de nova movimentação
// sabe quantos aprovadores exigir sem duplicar a regra no frontend.
class GetMetaOperation {
  execute() {
    return {
      roles: ROLES,
      conservationStatus: CONSERVATION_STATUS,
      assetStatus: ASSET_STATUS,
      checkMethods: CHECK_METHODS,
      movementTypes: Object.entries(MOVEMENT_TYPES).map(([id, r]) => ({ id, ...r })),
      discrepancyActions: DISCREPANCY_ACTIONS,
    };
  }
}

module.exports = GetMetaOperation;
