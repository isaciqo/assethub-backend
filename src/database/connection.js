const mongoose = require('mongoose');
const logger = require('../lib/logger');

// Nada de criar coleção/índice sozinho ao conectar: isso rodaria antes da
// trava abaixo. Os índices são criados de forma explícita depois dela.
mongoose.set('autoCreate', false);
mongoose.set('autoIndex', false);

// O nome do banco vem daqui, não do link: dá para reaproveitar o link de um
// cluster que já serve outro sistema (ex.: o do MEDagenda) sem misturar dados.
const DB_NAME = process.env.MONGODB_DB_NAME || 'assethub';

// Trava contra MONGODB_URI apontando para o banco de outro sistema: usuários
// do Erekoara sempre têm user_id. Se houver usuário sem ele, não toca
// em nada e para.
async function assertOwnDatabase() {
  const foreign = await mongoose.connection.db.collection('users').findOne({ user_id: { $exists: false } }, { projection: { _id: 1 } });
  if (foreign) {
    throw new Error(`O banco "${mongoose.connection.name}" tem usuários de outro sistema. Confira MONGODB_DB_NAME. Nada foi alterado.`);
  }
}

const connectDatabase = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/assethub';
  try {
    await mongoose.connect(uri, { dbName: DB_NAME });
    await assertOwnDatabase();
    // Garante os índices únicos (operation_id, conferência primária por inventário)
    // antes de aceitar a primeira sincronização — a idempotência depende deles.
    // createIndexes só cria o que falta: nunca apaga índice existente (syncIndexes
    // apagaria, o que destrói um banco de outro sistema se a URI estiver errada).
    await Promise.all(Object.values(mongoose.models).map(model => model.createIndexes()));
    logger.info('Connected to MongoDB', { db: mongoose.connection.name });
  } catch (error) {
    logger.error('MongoDB connection error', { message: error.message });
    process.exit(1);
  }
};

module.exports = connectDatabase;
module.exports.assertOwnDatabase = assertOwnDatabase;
module.exports.DB_NAME = DB_NAME;
