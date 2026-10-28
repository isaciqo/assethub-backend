/* eslint-disable no-console */
// Popula o banco com dados SINTÉTICOS (edital, seção 7: é vedado usar dados
// reais do TJPA). Também (re)gera as planilhas de exemplo em sample-data/.
//
// Dois modos (SEED_MODE ou --demo):
//   zerado (padrão) → 1 unidade com salas e 5 usuários; nenhum bem, inventário
//                     ou movimentação — os itens são cadastrados pela pessoa.
//   demo            → 4 unidades, 5 usuários, 190 bens, inventário e movimentações.
//
//   npm run seed          → popula só se o banco estiver vazio (modo zerado)
//   npm run seed:reset    → apaga o banco e popula de novo (modo zerado)
//   npm run seed:demo     → apaga o banco e popula com a massa de demonstração
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const container = require('../src/interfaces/http/container');
const { assertOwnDatabase } = require('../src/database/connection');
const logger = require('../src/lib/logger');
const signaturePng = require('./lib/signaturePng');
const { UNITS, DEMO_IMPORT_UNIT, SCENARIO_ROWS, NEW_ARRIVAL_ROWS, SCENARIO_CODES, buildRows, toCsv, rng } = require('./lib/syntheticData');

const PASSWORD = 'Patrimonio@2026';
const SAMPLE_DIR = path.resolve(__dirname, '../sample-data');

const USERS = [
  { key: 'admin', name: 'Ana Beatriz Moraes', email: 'admin@tjpa.demo', role: 'admin', unit: 'SEDE', registration: '100231' },
  { key: 'gestor', name: 'Carlos Henrique Pinheiro', email: 'gestor@tjpa.demo', role: 'gestor', unit: 'FCB', registration: '104582' },
  { key: 'conferente', name: 'Juliana Tavares', email: 'conferente@tjpa.demo', role: 'conferente', unit: 'FCB', registration: '118930' },
  { key: 'santarem', name: 'Raimundo Nonato Sousa', email: 'santarem@tjpa.demo', role: 'gestor', unit: 'STM', registration: '121447' },
  { key: 'maraba', name: 'Patrícia Lobato', email: 'maraba@tjpa.demo', role: 'conferente', unit: 'MAB', registration: '125016' },
];

// Modo zerado: só o que o sistema precisa para funcionar (local e pessoas).
const BLANK_UNIT = {
  name: 'Prédio-Sede do TJPA',
  code: 'SEDE',
  city: 'Belém',
  region: 'capital',
  rooms: [
    'Almoxarifado Central',
    'Coordenadoria de Patrimônio',
    'Secretaria de Administração',
    'Secretaria de Informática',
    'Secretaria de Gestão de Pessoas',
    'Gabinete da Presidência',
    'Sala de Reuniões',
    'Auditório',
  ],
};

const BLANK_USERS = [
  { name: 'Márcia Andrade', email: 'admin@tjpa.demo', role: 'admin', registration: '200101' },
  { name: 'Roberto Farias', email: 'gerente@tjpa.demo', role: 'gestor', registration: '200102' },
  { name: 'Lucas Ferreira', email: 'estagiario@tjpa.demo', role: 'conferente', registration: '200103' },
  { name: 'Paula Menezes', email: 'servidora@tjpa.demo', role: 'servidor', registration: '200104' },
  { name: 'Diego Santos', email: 'servidor@tjpa.demo', role: 'servidor', registration: '200105' },
];

async function seedBlank() {
  const c = name => container.resolve(name);
  const u = BLANK_UNIT;
  const unit = await c('unitRepository').create({ unit_id: uuidv4(), name: u.name, code: u.code, city: u.city, region: u.region, locations: u.rooms });
  console.log(`• Unidade ${u.name} com ${u.rooms.length} salas`);

  const pwd = await c('hashPasswordService').hash(PASSWORD);
  for (const p of BLANK_USERS) {
    await c('userRepository').create({ user_id: uuidv4(), name: p.name, email: p.email, password: pwd, role: p.role, registration: p.registration, unit_id: unit.unit_id });
  }
  console.log(`• ${BLANK_USERS.length} usuários (senha: ${PASSWORD}) · nenhum bem cadastrado`);
}

function writeSampleFiles() {
  fs.mkdirSync(SAMPLE_DIR, { recursive: true });
  const all = [...UNITS.flatMap((u, i) => buildRows(u, 1000 + i)), ...SCENARIO_ROWS];
  fs.writeFileSync(path.join(SAMPLE_DIR, 'bens_tjpa_sinteticos.csv'), toCsv(all));
  fs.writeFileSync(path.join(SAMPLE_DIR, 'demo_importacao_comarca_soure.csv'), toCsv(buildRows(DEMO_IMPORT_UNIT, 77)));
  fs.writeFileSync(path.join(SAMPLE_DIR, 'demo_chegada_novos_itens.csv'), toCsv(NEW_ARRIVAL_ROWS));
  return all;
}

const actorOf = u => ({ user_id: u.user_id, name: u.name, role: u.role });

async function seed() {
  const c = name => container.resolve(name);
  const unitRepository = c('unitRepository');
  const userRepository = c('userRepository');
  const hash = c('hashPasswordService');

  writeSampleFiles();
  console.log('• Planilhas sintéticas geradas em sample-data/');

  const units = {};
  for (const u of UNITS) {
    units[u.code] = await unitRepository.create({ unit_id: uuidv4(), name: u.name, code: u.code, city: u.city, region: u.region, locations: u.rooms });
  }
  console.log(`• ${UNITS.length} unidades`);

  const users = {};
  const pwd = await hash.hash(PASSWORD);
  for (const u of USERS) {
    users[u.key] = await userRepository.create({ user_id: uuidv4(), name: u.name, email: u.email, password: pwd, role: u.role, registration: u.registration, unit_id: units[u.unit].unit_id });
  }
  console.log(`• ${USERS.length} usuários (senha: ${PASSWORD})`);

  const admin = actorOf(users.admin);
  const csv = fs.readFileSync(path.join(SAMPLE_DIR, 'bens_tjpa_sinteticos.csv'));
  const report = await c('importAssetsOperation').execute({ buffer: csv, fileName: 'bens_tjpa_sinteticos.csv', actor: admin });
  console.log(`• ${report.created} bens importados (${report.errors.length} erros)`);

  await simulateSantaremInventory(c, units.STM, users.santarem);
  await simulateMovements(c, units, users);
}

// Inventário já encerrado em Santarém: dá histórico ao painel (tempo médio por
// bem, conferências offline, pendências resolvidas e abertas).
async function simulateSantaremInventory(c, unit, user) {
  const actor = actorOf(user);
  const r = rng(42);
  const inv = await c('createInventoryOperation').execute({ actor, unit_id: unit.unit_id, name: 'Inventário anual 2026 — Comarca de Santarém' });
  const started = new Date(Date.now() - 18 * 24 * 3600 * 1000);
  await c('inventoryRepository').update(inv.id, { started_at: started });

  const assets = await c('assetRepository').findAll({ unit_id: unit.unit_id });
  const ops = [];
  let clock = started.getTime() + 9 * 3600 * 1000;
  assets.slice(0, 40).forEach((a, i) => {
    const elapsed = Math.round(3000 + r() * 6000);
    clock += elapsed;
    let location = a.location;
    let condition = a.conservation_status;
    if (i % 13 === 5) location = 'Central de Mandados';
    if (i === 17) condition = 'ruim';
    ops.push({
      operation_id: crypto.randomUUID(),
      inventory_id: inv.id,
      asset_code: a.code,
      observed_location: location,
      observed_condition: condition,
      method: i % 9 === 0 ? 'manual' : i % 11 === 0 ? 'ocr' : 'qr',
      elapsed_ms: elapsed,
      checked_at: new Date(clock).toISOString(),
      device_id: 'seed-tablet-01',
      was_offline: i >= 12 && i < 30,
    });
  });
  ops.push({
    operation_id: crypto.randomUUID(),
    inventory_id: inv.id,
    asset_code: '0999001',
    observed_location: 'Atendimento ao Público',
    observed_condition: 'bom',
    observed_description: 'Impressora térmica de senhas (sem plaqueta legível)',
    method: 'manual',
    elapsed_ms: 21000,
    checked_at: new Date(clock + 30000).toISOString(),
    device_id: 'seed-tablet-01',
    was_offline: false,
  });
  // Reenvio da primeira operação: demonstra que a sincronização é idempotente.
  ops.push({ ...ops[0] });

  const sync = c('syncChecksOperation');
  for (let i = 0; i < ops.length; i += 25) await sync.execute({ actor, operations: ops.slice(i, i + 25) });

  await c('completeInventoryOperation').execute({ actor, inventory_id: inv.id });
  await c('inventoryRepository').update(inv.id, { completed_at: new Date(started.getTime() + 2 * 24 * 3600 * 1000) });

  // Algumas pendências já decididas, outras ficam abertas para a demo.
  const open = await c('discrepancyRepository').find({ inventory_id: inv.id, status: 'aberta' });
  const resolve = c('resolveDiscrepancyOperation');
  const loc = open.filter(d => d.type === 'localizacao_divergente');
  if (loc[0]) await resolve.execute({ actor, discrepancy_id: loc[0].discrepancy_id, action: 'atualizar_cadastro', note: 'Mudança de sala confirmada com a chefia' });
  const nf = open.filter(d => d.type === 'nao_localizado');
  if (nf[0]) await resolve.execute({ actor, discrepancy_id: nf[0].discrepancy_id, action: 'localizado_depois', note: 'Estava em manutenção externa, retornou no dia seguinte' });
  console.log(`• Inventário ${inv.number} (Santarém) concluído com ${ops.length - 1} conferências`);
}

async function simulateMovements(c, units, users) {
  const admin = actorOf(users.admin);
  const gestor = actorOf(users.gestor);
  const santarem = actorOf(users.santarem);
  // Os bens dos roteiros do guia ficam de fora — eles precisam começar intactos.
  const fcbAssets = (await c('assetRepository').findAll({ unit_id: units.FCB.unit_id })).filter(a => !SCENARIO_CODES.includes(a.code));
  const notebook = fcbAssets.find(a => a.description.startsWith('Notebook')) || fcbAssets[0];
  const monitor = fcbAssets.find(a => a.description.startsWith('Monitor') && a.asset_id !== notebook.asset_id) || fcbAssets[1];

  // 1) Concluída de ponta a ponta: Belém → Santarém, com assinaturas e termo.
  const m1 = await c('createMovementOperation').execute({
    actor: gestor,
    data: {
      type: 'transferencia_unidade',
      reason: 'Reforço de equipamentos para a Central de Mandados de Santarém',
      asset_ids: [notebook.asset_id, monitor.asset_id],
      destination: { unit_id: units.STM.unit_id, location: 'Central de Mandados', responsible_name: 'Raimundo Nonato Sousa' },
      approver_ids: [users.admin.user_id],
      deliverer_id: users.gestor.user_id,
      receiver_id: users.santarem.user_id,
    },
  });
  await c('decideApprovalOperation').execute({ actor: admin, movement_id: m1.id, decision: 'aprovada', note: 'De acordo.' });
  const conditions = [notebook, monitor].map(a => ({ asset_id: a.asset_id, condition: a.conservation_status }));
  await c('confirmDeliveryOperation').execute({ actor: gestor, movement_id: m1.id, input: { conditions, signature: signaturePng(1), signer_name: gestor.name, notes: 'Embalados em caixa lacrada nº 0142.' } });
  await c('confirmReceiptOperation').execute({ actor: santarem, movement_id: m1.id, input: { conditions, signature: signaturePng(3), signer_name: santarem.name, notes: 'Recebidos em perfeito estado.' } });

  // 2) Aguardando aprovação — para demonstrar o fluxo ao vivo.
  const chair = fcbAssets.find(a => a.description.startsWith('Cadeira') && ![notebook.asset_id, monitor.asset_id].includes(a.asset_id));
  if (chair) {
    await c('createMovementOperation').execute({
      actor: actorOf(users.conferente),
      data: {
        type: 'transferencia_interna',
        reason: 'Remanejamento de mobiliário para a nova sala de audiências',
        asset_ids: [chair.asset_id],
        destination: { unit_id: units.FCB.unit_id, location: 'Sala de Audiências 02', responsible_name: chair.responsible_name },
        approver_ids: [users.gestor.user_id],
        deliverer_id: users.conferente.user_id,
        receiver_id: users.gestor.user_id,
      },
    });
  }
  console.log('• 2 movimentações (1 concluída com termo, 1 aguardando aprovação)');
}

async function seedIfEmpty(mode = process.env.SEED_MODE || 'zerado') {
  const count = await container.resolve('userRepository').count();
  if (count > 0) {
    writeSampleFiles();
    return false;
  }
  logger.info(`seed: banco vazio — populando (modo ${mode})`);
  if (mode === 'demo') await seed();
  else {
    writeSampleFiles();
    await seedBlank();
  }
  logger.info('seed: concluído');
  return true;
}

if (require.main === module) {
  (async () => {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/assethub';
    await mongoose.connect(uri);
    // Antes de apagar qualquer coisa: o banco é mesmo do Patrimônio Ágil?
    await assertOwnDatabase();
    if (process.argv.includes('--reset')) {
      await mongoose.connection.dropDatabase();
      console.log(`• Banco "${mongoose.connection.name}" apagado`);
    }
    await Promise.all(Object.values(mongoose.models).map(m => m.createIndexes()));
    const done = await seedIfEmpty(process.argv.includes('--demo') ? 'demo' : undefined);
    if (!done) console.log('Banco já tem dados — use "npm run seed:reset" para recriar.');
    await mongoose.disconnect();
  })().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { seedIfEmpty };
