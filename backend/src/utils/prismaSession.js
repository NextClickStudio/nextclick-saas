const { Session } = require('@shopify/shopify-api');

/**
 * PrismaSessionStorage — stores Shopify offline sessions in PostgreSQL.
 *
 * Key design decisions:
 * - We store fields explicitly (not via toObject/fromPropertyArray) to avoid
 *   version incompatibilities between @shopify/shopify-api versions.
 * - accessToken is always logged (present/missing) to help debug token issues.
 * - shopDomain is stored flat (no FK to Shop) to avoid race conditions during OAuth.
 */
class PrismaSessionStorage {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async storeSession(session) {
    try {
      if (!session.accessToken) {
        console.error('storeSession called with MISSING accessToken for:', session.shop);
      }

      const payload = {
        id:          session.id,
        shop:        session.shop,
        state:       session.state  || '',
        isOnline:    session.isOnline || false,
        accessToken: session.accessToken || null,
        scope:       session.scope  || null,
        expires:     session.expires ? session.expires.toISOString() : null,
      };

      await this.prisma.shopSession.upsert({
        where:  { id: session.id },
        update: { payload, shopDomain: session.shop, updatedAt: new Date() },
        create: { id: session.id,  shopDomain: session.shop, payload },
      });

      console.log(`[session] stored  shop=${session.shop} token=${session.accessToken ? 'OK' : 'MISSING'}`);
      return true;
    } catch (err) {
      console.error('[session] storeSession error:', err.message);
      return false;
    }
  }

  async loadSession(sessionId) {
    try {
      const record = await this.prisma.shopSession.findUnique({ where: { id: sessionId } });

      if (!record) {
        console.warn(`[session] not found  id=${sessionId}`);
        return undefined;
      }

      const p = record.payload;
      const s = new Session({
        id:       p.id,
        shop:     p.shop,
        state:    p.state    || '',
        isOnline: p.isOnline || false,
      });

      s.accessToken = p.accessToken;
      s.scope       = p.scope;
      if (p.expires) s.expires = new Date(p.expires);

      console.log(`[session] loaded  shop=${p.shop} token=${s.accessToken ? 'OK' : 'MISSING'}`);
      return s;
    } catch (err) {
      console.error('[session] loadSession error:', err.message);
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
