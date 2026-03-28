const { PrismaClient } = require('@prisma/client');

// Connection pooling per scalare a 10k+ shop
// connection_limit: max connessioni simultanee per istanza Node
// pool_timeout: timeout attesa connessione disponibile (secondi)
// connect_timeout: timeout connessione iniziale (secondi)
const getDatabaseUrl = () => {
  const url = process.env.DATABASE_URL || '';
  if (!url) return url;
  // Aggiunge parametri pooling se non già presenti
  if (url.includes('connection_limit')) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}connection_limit=10&pool_timeout=20&connect_timeout=10`;
};

const prisma = global.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
  datasources: {
    db: { url: getDatabaseUrl() },
  },
});

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

// Graceful shutdown — chiude il pool quando il processo termina
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

module.exports = prisma;
