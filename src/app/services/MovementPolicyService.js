const httpError = require('../../lib/httpError');
const { MOVEMENT_TYPES } = require('../../lib/constants');

const CONDITION_RANK = { novo: 0, bom: 1, regular: 2, ruim: 3, inservivel: 4 };

// Quem pode fazer o quê em cada etapa. Administrador pode executar qualquer
// etapa no lugar da pessoa designada — e isso fica registrado no histórico
// como "agindo como administrador", nunca disfarçado de ação da pessoa.
class MovementPolicyService {
  rule(type) {
    const rule = MOVEMENT_TYPES[type];
    if (!rule) throw httpError(400, 'Tipo de movimentação inválido');
    return rule;
  }

  isManager(actor) {
    return actor.role === 'admin' || actor.role === 'gestor';
  }

  pendingApproval(movement, actor) {
    return movement.approvals.find(a => a.status === 'pendente' && a.user_id === actor.user_id);
  }

  // Devolve o papel em que a pessoa age, ou lança 403.
  authorize(actor, movement, step) {
    const admin = actor.role === 'admin';
    const as = role => ({ actedAs: role });

    switch (step) {
      case 'approve': {
        if (movement.status !== 'aguardando_aprovacao') throw httpError(409, 'Esta movimentação não está aguardando aprovação');
        if (this.pendingApproval(movement, actor)) return as('aprovador');
        if (admin && movement.approvals.some(a => a.status === 'pendente')) return as('admin');
        throw httpError(403, 'Você não é aprovador(a) pendente desta movimentação');
      }
      case 'deliver': {
        if (movement.status !== 'aprovada') throw httpError(409, 'A entrega só pode ser registrada depois das aprovações');
        if (movement.deliverer_id === actor.user_id) return as('entregador');
        if (admin) return as('admin');
        throw httpError(403, 'Somente a pessoa designada para a entrega pode confirmá-la');
      }
      case 'receive': {
        if (movement.status !== 'em_transito') throw httpError(409, 'O recebimento só pode ser registrado depois da entrega');
        if (movement.receiver_id === actor.user_id) return as('recebedor');
        if (admin) return as('admin');
        throw httpError(403, 'Somente a pessoa designada para o recebimento pode confirmá-lo');
      }
      case 'resolve_issue': {
        if (movement.status !== 'com_pendencia') throw httpError(409, 'Esta movimentação não tem ocorrência aberta');
        if (this.isManager(actor)) return as(actor.role);
        throw httpError(403, 'Somente gestores de patrimônio tratam ocorrências');
      }
      case 'cancel': {
        if (!['aguardando_aprovacao', 'aprovada'].includes(movement.status)) throw httpError(409, 'Só é possível cancelar antes da entrega');
        if (movement.requested_by === actor.user_id) return as('solicitante');
        if (this.isManager(actor)) return as(actor.role);
        throw httpError(403, 'Somente quem solicitou ou um gestor pode cancelar');
      }
      default:
        throw httpError(400, 'Etapa inválida');
    }
  }

  // Ações disponíveis para a pessoa logada — o front só desenha os botões daqui.
  availableActions(actor, movement) {
    return ['approve', 'deliver', 'receive', 'resolve_issue', 'cancel'].filter(step => {
      try {
        this.authorize(actor, movement, step);
        return true;
      } catch {
        return false;
      }
    });
  }

  // A vez de quem? Usado na lista "aguardando você".
  waitingOn(movement) {
    switch (movement.status) {
      case 'aguardando_aprovacao': return movement.approvals.filter(a => a.status === 'pendente').map(a => a.user_id);
      case 'aprovada': return [movement.deliverer_id];
      case 'em_transito': return [movement.receiver_id];
      default: return [];
    }
  }

  worsened(before, after) {
    if (!before || !after) return false;
    return CONDITION_RANK[after] > CONDITION_RANK[before];
  }
}

module.exports = MovementPolicyService;
