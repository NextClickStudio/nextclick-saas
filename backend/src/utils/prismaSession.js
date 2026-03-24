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
        update: { payload: data, updatedAt: new Date() },
        create: { id: session.id, shopId: session.shop, payload: data, updatedAt: new Date() },
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
      const entries = Object.entries(record.payload);
      return Session.fromPropertyArray(entries);
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
    await this.prisma.shopSession.deleteMany({ where: { id: { in: ids } } });
    return true;
  }

  async findSessionsByShop(shop) {
    const records = await this.prisma.shopSession.findMany({ where: { shopId: shop } });
    return records.map(r => Session.fromPropertyArray(Object.entries(r.payload)));
  }
}

module.exports = { PrismaSessionStorage };
