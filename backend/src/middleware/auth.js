const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Middleware per validare la sessione Shopify.
 * Gestisce sia i token salvati nel DB che un eventuale token di emergenza in Railway.
 */
const authMiddleware = async (req, res, next) => {
  // Recupera lo shop dai parametri della query o dal corpo della richiesta
  const shop = req.query.shop || req.body.shop;

  if (!shop) {
    console.error('[auth-middleware] Errore: parametro shop mancante');
    return res.status(400).json({ error: 'Shop parameter is missing' });
  }

  try {
    // 1. Cerca lo shop nel database usando i nomi colonne corretti di Prisma (CamelCase)
    const shopData = await prisma.shops.findUnique({
      where: { shopDomain: shop },
    });

    // 2. Se abbiamo un accessToken nel database, lo usiamo
    if (shopData && shopData.accessToken) {
      console.log(`[session] caricata da DB per shop=${shop} (token OK)`);
      req.session_data = {
        shop: shop,
        accessToken: shopData.accessToken,
      };
      return next();
    }

    // 3. FALLBACK: Se il DB è vuoto, proviamo a usare il token shpss_ configurato su Railway
    // Questo permette di far funzionare il sync anche se l'OAuth non è stato completato
    if (process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN) {
      console.log(`[session] fallback su variabile ENV per shop=${shop}`);
      req.session_data = {
        shop: shop,
        accessToken: process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN,
      };
      return next();
    }

    // 4. Se non troviamo nulla, chiediamo di rifare l'autenticazione
    console.warn(`[session] Nessun token trovato per lo shop=${shop}. Richiesto re-auth.`);
    return res.status(401).json({ 
      error: 'Session not found', 
      reauth_url: `/auth?shop=${shop}` 
    });
    
  } catch (error) {
    console.error('[auth-middleware] Errore critico:', error);
    res.status(500).json({ error: 'Errore interno del server durante l\'autenticazione' });
  }
};

module.exports = authMiddleware;
