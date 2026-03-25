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

module.exports = router;
