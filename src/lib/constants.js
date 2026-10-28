// Enums de domínio centralizados — os schemas Joi, os models e o frontend
// (src/lib/labels.ts) precisam concordar com esses valores.

// servidor: pessoa que não é da área de patrimônio — só vê os próprios bens e
// as tarefas que o gerente gera para ela (enviar, receber, validar).
const ROLES = ['admin', 'gestor', 'conferente', 'servidor'];

const CONSERVATION_STATUS = ['novo', 'bom', 'regular', 'ruim', 'inservivel'];

const ASSET_STATUS = ['ativo', 'em_movimentacao', 'nao_localizado', 'baixado'];

const INVENTORY_STATUS = ['em_andamento', 'concluido', 'cancelado'];

// ok:            bem previsto, encontrado sem nenhuma divergência
// divergente:    bem previsto, encontrado com localização/estado/responsável diferente
// outra_unidade: bem cadastrado, mas registrado em outra unidade
// nao_cadastrado: código lido não existe na base
// duplicada:     mesmo bem já tinha conferência válida neste inventário
const CHECK_STATUS = ['ok', 'divergente', 'outra_unidade', 'nao_cadastrado', 'duplicada'];

const CHECK_METHODS = ['qr', 'barcode', 'ocr', 'manual', 'busca'];

const DISCREPANCY_TYPES = {
  NAO_LOCALIZADO: 'nao_localizado',
  LOCALIZACAO_DIVERGENTE: 'localizacao_divergente',
  OUTRA_UNIDADE: 'outra_unidade',
  NAO_CADASTRADO: 'nao_cadastrado',
  CONFERENCIA_DUPLICADA: 'conferencia_duplicada',
  ESTADO_ALTERADO: 'estado_alterado',
  RESPONSAVEL_DIVERGENTE: 'responsavel_divergente',
};

// Quais decisões fazem sentido para cada tipo de pendência. A pessoa revisora
// escolhe; o sistema nunca aplica nenhuma delas sozinho nos registros centrais.
const DISCREPANCY_ACTIONS = {
  nao_localizado: ['marcar_nao_localizado', 'localizado_depois', 'descartar'],
  localizacao_divergente: ['atualizar_cadastro', 'manter_cadastro', 'abrir_movimentacao'],
  outra_unidade: ['atualizar_cadastro', 'manter_cadastro', 'abrir_movimentacao'],
  nao_cadastrado: ['cadastrar_bem', 'descartar'],
  conferencia_duplicada: ['manter_primeira', 'usar_esta'],
  estado_alterado: ['atualizar_cadastro', 'manter_cadastro'],
  responsavel_divergente: ['atualizar_cadastro', 'manter_cadastro'],
};

const ALL_DISCREPANCY_ACTIONS = [...new Set(Object.values(DISCREPANCY_ACTIONS).flat())];

// Regras de movimentação. A quantidade de aprovações NÃO é regra oficial do
// TJPA — é um padrão configurável aqui, para validar com o setor de patrimônio.
const MOVEMENT_TYPES = {
  transferencia_interna: { label: 'Transferência interna (entre salas)', minApprovals: 0, requiresCarrier: false },
  transferencia_unidade: { label: 'Transferência entre unidades', minApprovals: 1, requiresCarrier: false },
  mudanca_responsavel: { label: 'Mudança de responsável', minApprovals: 1, requiresCarrier: false },
  devolucao: { label: 'Devolução ao setor de patrimônio', minApprovals: 1, requiresCarrier: false },
  transporte_terceirizado: { label: 'Transporte por empresa terceirizada', minApprovals: 2, requiresCarrier: true },
};

const MOVEMENT_STATUS = [
  'aguardando_aprovacao',
  'aprovada',
  'em_transito',
  'com_pendencia',
  'concluida',
  'rejeitada',
  'cancelada',
];

const EVIDENCE_KINDS = ['foto', 'assinatura', 'documento'];

module.exports = {
  ROLES,
  CONSERVATION_STATUS,
  ASSET_STATUS,
  INVENTORY_STATUS,
  CHECK_STATUS,
  CHECK_METHODS,
  DISCREPANCY_TYPES,
  DISCREPANCY_ACTIONS,
  ALL_DISCREPANCY_ACTIONS,
  MOVEMENT_TYPES,
  MOVEMENT_STATUS,
  EVIDENCE_KINDS,
};
