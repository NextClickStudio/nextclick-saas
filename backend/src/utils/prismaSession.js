const { Session } = require('@shopify/shopify-api');

class PrismaSessionStorage {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async storeSession(session) {
    try {
      // toObject() returns a plain object - store it directly as JSON
      const payload = {
        id:          session.id,
        shop:        session.shop,
        state:       session.state,
        isOnline:    session.isOnline,
        accessToken: session.accessToken,
        scope:       session.scope,
        expires:     session.expires ? session.expires.toISOString() : null,
      };

      await this.prisma.shopSession.upsert({
        where:  { id: session.id },
        update: { payload, shopDomain: session.shop, updatedAt: new Date() },
        create: { id: session.id, shopDomain: session.shop, payload },
      });
      console.log('Session stored for shop:', session.shop, 'token:', session.accessToken ? 'present' : 'MISSING');
      return true;
    } catch (err) {
      console.error('Session store error:', err.message);
      return false;
    }
  }

  async loadSession(id) {
    try {
      const record = await this.prisma.shopSession.findUnique({ where: { id } });
      if (!record) {
        console.warn('Session not found for id:', id);
        return undefined;
      }

      const p = record.payload;

      // Reconstruct session from stored plain object
      const session = new Session({
        id:          p.id,
        shop:        p.shop,
        state:       p.state || '',
        isOnline:    p.isOnline || false,
      });
      session.accessToken = p.accessToken;
      session.scope       = p.scope;
      if (p.expires) session.expires = new Date(p.expires);

      console.log('Session loaded for shop:', p.shop, 'token:', session.accessToken ? 'present' : 'MISSING');
      return session;
    } catch (err) {
      console.error('Session load error:', err.message);
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
      const records = await this.prisma.shopSession.findMany({ where: { shopDomain: shop } });
      return records.map(r => {
        const p = r.payload;
        const s = new Session({ id: p.id, shop: p.shop, state: p.state || '', isOnline: p.isOnline || false });
        s.accessToken = p.accessToken;
        s.scope       = p.scope;
        if (p.expires) s.expires = new Date(p.expires);
        return s;
      });
    } catch { return []; }
  }
}

module.exports = { PrismaSessionStorage };
