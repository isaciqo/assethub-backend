const { formatAsset, formatPossessionCheck } = require('../../../lib/formatters');

// Tudo o que a pessoa precisa ver na tela dela: os bens no seu nome e as
// tarefas que o gerente gerou (enviar, confirmar recebimento, validar).
class GetMyAreaOperation {
  constructor({ assetRepository, movementRepository, userRepository, possessionCheckRepository }) {
    this.assetRepository = assetRepository;
    this.movementRepository = movementRepository;
    this.userRepository = userRepository;
    this.possessionCheckRepository = possessionCheckRepository;
  }

  async execute({ actor }) {
    const [assets, movements, checks] = await Promise.all([
      this.assetRepository.findByResponsible(actor.name),
      this.movementRepository.find({
        $or: [
          { status: 'aprovada', deliverer_id: actor.user_id },
          { status: 'em_transito', receiver_id: actor.user_id },
        ],
      }),
      this.possessionCheckRepository.find({ user_id: actor.user_id, status: 'pendente' }),
    ]);

    const [movAssets, people] = await Promise.all([
      this.assetRepository.findByIds([...new Set(movements.flatMap(m => m.asset_ids))]),
      this.userRepository.findByIds([...new Set(movements.flatMap(m => [m.deliverer_id, m.receiver_id]))]),
    ]);
    const assetMap = Object.fromEntries(movAssets.map(a => [a.asset_id, { code: a.code, description: a.description }]));
    const nameOf = Object.fromEntries(people.map(u => [u.user_id, u.name]));

    const task = m => ({
      movementId: m.movement_id,
      number: m.number,
      kind: m.status === 'aprovada' ? 'enviar' : 'receber',
      reason: m.reason,
      assets: m.asset_ids.map(id => assetMap[id]).filter(Boolean),
      from: nameOf[m.deliverer_id] || '',
      to: nameOf[m.receiver_id] || '',
      destinationLocation: m.destination.location || '',
      createdAt: m.createdAt,
    });

    return {
      assets: assets.map(formatAsset),
      tasks: [
        ...movements.map(task),
        ...checks.map(c => ({ kind: 'validar', check: formatPossessionCheck(c), createdAt: c.createdAt })),
      ].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
    };
  }
}

module.exports = GetMyAreaOperation;
