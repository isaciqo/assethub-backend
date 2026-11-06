const { formatAsset, formatAssetRequest, formatPossessionCheck, iso } = require('../../../lib/formatters');

// Tudo o que a pessoa precisa ver na tela dela: os bens no seu nome e as
// tarefas que o gerente gerou (enviar, confirmar recebimento, validar) e os
// pedidos de bens: os feitos ao setor dela e os dela que o setor negou. Também
// avisa dos inventários abertos que incluem bens dela, para ela validar.
class GetMyAreaOperation {
  constructor({ assetRepository, movementRepository, userRepository, possessionCheckRepository, assetRequestRepository, inventoryRepository, unitRepository }) {
    this.inventoryRepository = inventoryRepository;
    this.unitRepository = unitRepository;
    this.assetRequestRepository = assetRequestRepository;
    this.assetRepository = assetRepository;
    this.movementRepository = movementRepository;
    this.userRepository = userRepository;
    this.possessionCheckRepository = possessionCheckRepository;
  }

  async execute({ actor }) {
    const [assets, movements, checks, requests] = await Promise.all([
      this.assetRepository.findByResponsible(actor.name),
      this.movementRepository.find({
        $or: [
          { status: 'aprovada', deliverer_id: actor.user_id },
          { status: 'em_transito', receiver_id: actor.user_id },
        ],
      }),
      this.possessionCheckRepository.find({ user_id: actor.user_id, status: 'pendente' }),
      this.assetRequestRepository.find({
        $or: [
          { source_owner_id: actor.user_id, status: 'aguardando_setor' },
          { requested_by: actor.user_id, status: 'negada_setor' },
        ],
      }),
    ]);

    const myIds = assets.map(a => a.asset_id);
    const inventories = myIds.length
      ? await this.inventoryRepository.find({ status: 'em_andamento', expected_asset_ids: { $in: myIds } })
      : [];

    const [movAssets, people, units, validations] = await Promise.all([
      this.assetRepository.findByIds([...new Set(movements.flatMap(m => m.asset_ids))]),
      this.userRepository.findByIds([...new Set([...movements.flatMap(m => [m.deliverer_id, m.receiver_id]), ...inventories.map(i => i.created_by)])]),
      inventories.length ? this.unitRepository.findAll() : [],
      inventories.length ? this.possessionCheckRepository.find({ user_id: actor.user_id, inventory_id: { $in: inventories.map(i => i.inventory_id) } }) : [],
    ]);
    const unitName = Object.fromEntries(units.map(u => [u.unit_id, u.name]));
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

    // Aviso de inventário: quantos bens dela estão nele e se ela já validou.
    const mine = new Set(myIds);
    const notices = inventories.map(inv => {
      const validation = validations.filter(v => v.inventory_id === inv.inventory_id).sort((a, b) => b.createdAt - a.createdAt)[0];
      return {
        id: inv.inventory_id,
        number: inv.number,
        name: inv.name,
        unitName: unitName[inv.unit_id] || '',
        locations: inv.locations,
        startedAt: iso(inv.started_at),
        startedByName: nameOf[inv.created_by] || '',
        myAssets: inv.expected_asset_ids.filter(id => mine.has(id)).length,
        validation: validation ? { id: validation.check_id, status: validation.status, answeredAt: iso(validation.answered_at) } : null,
      };
    });

    return {
      assets: assets.map(formatAsset),
      inventories: notices,
      tasks: [
        ...movements.map(task),
        ...checks.map(c => ({ kind: 'validar', check: formatPossessionCheck(c), createdAt: c.createdAt })),
        ...requests.map(r => ({
          kind: r.status === 'aguardando_setor' ? 'pedido_setor' : 'pedido_negado',
          request: formatAssetRequest(r),
          createdAt: r.updatedAt,
        })),
      ].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
    };
  }
}

module.exports = GetMyAreaOperation;
