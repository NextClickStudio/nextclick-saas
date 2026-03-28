const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const crypto = require('crypto');

function verifyWebhook(req, res, next) {
  const hmac = req.headers['x-shopify-hmac-sha256'];
  const body = req.body;
  const hash = crypto
    .createHmac('sha256', process.env.SHOPIFY_API_SECRET)
    .update(body, 'utf8')
    .digest('base64');

  if (hash !== hmac) {
    return res.status(401).send('Webhook verification failed');
  }
  req.webhookBody = JSON.parse(body.toString());
  next();
}

// App uninstalled
router.post('/uninstall', verifyWebhook, async (req, res) => {
  try {
    const shopDomain = req.headers['x-shopify-shop-domain'];
    await prisma.shop.update({
      where: { shopDomain },
      data: { isActive: false, planStatus: 'cancelled' },
    });
    console.log(`Shop uninstalled: ${shopDomain}`);
    res.status(200).send('ok');
  } catch (err) {
    console.error('Uninstall webhook error:', err);
    res.status(500).send('error');
  }
});

// Shop update
router.post('/shop-update', verifyWebhook, async (req, res) => {
  try {
    const shopDomain = req.headers['x-shopify-shop-domain'];
    const { email, name } = req.webhookBody;
    await prisma.shop.update({
      where: { shopDomain },
      data: { email, ownerName: name },
    });
    res.status(200).send('ok');
  } catch (err) {
    res.status(500).send('error');
  }
});

// Billing subscription updated (auto-reset generations monthly)
router.post('/billing-update', verifyWebhook, async (req, res) => {
  try {
    const shopDomain = req.headers['x-shopify-shop-domain'];
    const { app_subscription } = req.webhookBody;

    if (app_subscription?.status === 'ACTIVE') {
      await prisma.shop.update({
        where: { shopDomain },
        data: {
          planStatus: 'active',
          generationsUsed: 0, // reset on new billing cycle
          billingCycleStart: new Date(),
        },
      });
    } else if (['CANCELLED', 'DECLINED', 'EXPIRED'].includes(app_subscription?.status)) {
      await prisma.shop.update({
        where: { shopDomain },
        data: { planStatus: 'cancelled' },
      });
    }

    res.status(200).send('ok');
  } catch (err) {
    res.status(500).send('error');
  }
});


// ─── GDPR Webhooks (obbligatori per Shopify App Store review) ────────────────
// Shopify richiede questi 3 endpoint. Devono rispondere 200 entro 5 secondi.

// 1. Customers data request — un cliente chiede i propri dati
router.post('/customers/data_request', verifyWebhook, async (req, res) => {
  const { shop_domain, customer } = req.webhookBody || {};
  console.log('[GDPR] customers/data_request', shop_domain, customer?.id);
  // Non salviamo dati personali identificabili — rispondiamo subito
  res.status(200).send('ok');
});

// 2. Customers redact — cancella i dati di un cliente
router.post('/customers/redact', verifyWebhook, async (req, res) => {
  const { shop_domain, customer } = req.webhookBody || {};
  console.log('[GDPR] customers/redact', shop_domain, customer?.id);
  // Non salviamo PII dei clienti finali — rispondiamo subito
  res.status(200).send('ok');
});

// 3. Shop redact — cancella tutti i dati di uno shop (dopo 48h dalla disinstallazione)
router.post('/shop/redact', verifyWebhook, async (req, res) => {
  try {
    const shopDomain = req.headers['x-shopify-shop-domain'] || req.webhookBody?.shop_domain;
    console.log('[GDPR] shop/redact', shopDomain);
    if (shopDomain) {
      const shop = await prisma.shop.findUnique({ where: { shopDomain } });
      if (shop) {
        // Cancella tutti i dati associati allo shop
        await prisma.productClick.deleteMany({ where: { generation: { shopId: shop.id } } });
        await prisma.generation.deleteMany({ where: { shopId: shop.id } });
        await prisma.product.deleteMany({ where: { shopId: shop.id } });
        await prisma.shopConfig.deleteMany({ where: { shopId: shop.id } });
        await prisma.shopSession.deleteMany({ where: { shopId: shopDomain } });
        await prisma.shop.delete({ where: { shopDomain } });
        console.log('[GDPR] shop/redact completed for', shopDomain);
      }
    }
    res.status(200).send('ok');
  } catch (err) {
    console.error('[GDPR] shop/redact error:', err.message);
    res.status(200).send('ok'); // Shopify richiede 200 anche in caso di errore
  }
});

module.exports = router;
