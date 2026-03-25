const { Session } = require('@shopify/shopify-api');

class PrismaSessionStorage {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async storeSession(session) {
    try {
      const data = session.toObject();
      await this.prisma.shopSession.upsert({
        where: { id: session.id },
        update: { payload: data, shopDomain: session.shop, updatedAt: new Date() },
        create: { id: session.id, shopDomain: session.shop, payload: data },
      });
      return true;
    } catch (err) {
      console.error('Session store error:', err);
      return false;
    }
  }

  async loadSession(id) {
    try {
      const record = await this.prisma.shopSession.findUnique({ where: { id } });
      if (!record) return undefined;
      return Session.fromPropertyArray(Object.entries(record.payload));
    } catch {
      return undefined;
    }
  }

  async deleteSession(id) {
    try {
      await this.prisma.shopSession.delete({ where: { id } });
      return true;
    } catch { return false; }
  }

  async deleteSessions(ids) {
    try {
      await this.prisma.shopSession.deleteMany({ where: { id: { in: ids } } });
      return true;
    } catch { return false; }
  }

  async findSessionsByShop(shop) {
    try {
      const records = await this.prisma.shopSession.findMany({
        where: { shopDomain: shop },
      });
      return records.map(r => Session.fromPropertyArray(Object.entries(r.payload)));
    } catch { return []; }
  }
}

module.exports = { PrismaSessionStorage };
