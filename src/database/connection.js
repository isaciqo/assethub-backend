const mongoose = require('mongoose');
const logger = require('../lib/logger');

const connectDatabase = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/assethub';
  try {
    await mongoose.connect(uri);
    // Garante os índices únicos (operation_id, conferência primária por inventário)
    // antes de aceitar a primeira sincronização — a idempotência depende deles.
    await Promise.all(Object.values(mongoose.models).map(model => model.syncIndexes()));
    logger.info('Connected to MongoDB', { db: mongoose.connection.name });
  } catch (error) {
    logger.error('MongoDB connection error', { message: error.message });
    process.exit(1);
  }
};

module.exports = connectDatabase;
