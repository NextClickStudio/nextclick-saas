const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const { verifyShopifySession } = require('../middleware/auth');

const PLANS = {
  starter: {
    name: 'Starter',
    price: 49.00,
    trialDays: 7,
    generationsLimit: 1000,
    features: ['1.000 generazioni/mese', 'Solo prodotti consigliati', 'Widget embeddabile', 'Analytics base'],
  },
  pro: {
    name: 'Pro',
    price: 199.00,
    trialDays: 7,
    generationsLimit: 10000,
    features: ['10.000 generazioni/mese', 'Routine completa + prodotti', 'AI Persona personalizzata', 'Analytics avanzate', 'PDF download', 'AI auto-tagging prodotti'],
  },
  scale: {
    name: 'Scale',
    price: 499.00,
    trialDays: 7,
    generationsLimit: 100000,
    features: ['100.000 generazioni/mese', 'Tutto il piano Pro', 'Supporto prioritario', 'Custom domain widget', 'Export dati CSV'],
  },
};

// GET /api/billing/plans — list available plans
router.get('/plans', async (req, res) => {
  res.json({ plans: PLANS });
});

// POST /api/billing/subscribe — create subscription
router.post('/subscribe', verifyShopifySession, async (req, res) => {
  try {
    const { planName } = req.body;
    const plan = PLANS[planName];
    if (!plan) return res.status(400).json({ error: 'Invalid plan' });

    const shopify = req.shopify;
    const session = req.session_data;

    const client = new shopify.clients.Graphql({ session });

    const mutation = `
      mutation AppSubscriptionCreate($name: String!, $lineItems: [AppSubscriptionLineItemInput!]!, $returnUrl: URL!, $trialDays: Int) {
        appSubscriptionCreate(
          name: $name
          returnUrl: $returnUrl
          trialDays: $trialDays
          lineItems: $lineItems
          test: ${process.env.NODE_ENV !== 'production'}
        ) {
          appSubscription { id status }
          confirmationUrl
          userErrors { field message }
        }
      }
    `;

    const response = await client.query({
      data: {
        query: mutation,
        variables: {
          name: `NextClick ${plan.name}`,
          trialDays: plan.trialDays,
          returnUrl: `${process.env.HOST}/api/billing/confirm?shop=${req.shop.shopDomain}&plan=${planName}`,
          lineItems: [{
            plan: {
              appRecurringPricingDetails: {
                price: { amount: plan.price, currencyCode: 'USD' },
                interval: 'EVERY_30_DAYS',
              },
            },
          }],
        },
      },
    });

    const result = response.body?.data?.appSubscriptionCreate;
    if (result?.userErrors?.length) {
      return res.status(400).json({ error: result.userErrors[0].message });
    }

    res.json({ confirmationUrl: result.confirmationUrl });
  } catch (err) {
    console.error('Subscribe error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/billing/confirm — Shopify redirects here after merchant confirms
router.get('/confirm', async (req, res) => {
  try {
    const { shop, plan, charge_id } = req.query;
    const planConfig = PLANS[plan];
    if (!planConfig) return res.redirect('/?error=invalid_plan');

    const shopRecord = await prisma.shop.findUnique({ where: { shopDomain: shop } });
    if (!shopRecord) return res.redirect('/?error=shop_not_found');

    await prisma.shop.update({
      where: { shopDomain: shop },
      data: {
        planName: plan,
        planStatus: 'active',
        billingId: charge_id || null,
        generationsLimit: planConfig.generationsLimit,
        generationsUsed: 0,
        billingCycleStart: new Date(),
      },
    });

    // Enable plan features in config
    await prisma.shopConfig.update({
      where: { shopId: shopRecord.id },
      data: {
        featureRoutine: plan !== 'starter',
        featureProducts: true,
        featurePdf: plan !== 'starter',
      },
    });

    res.redirect(`/?shop=${shop}&subscribed=1`);
  } catch (err) {
    console.error('Billing confirm error:', err);
    res.redirect('/?error=billing_failed');
  }
});

// GET /api/billing/status — current subscription status
router.get('/status', verifyShopifySession, async (req, res) => {
  const shop = req.shop;
  const plan = PLANS[shop.planName] || PLANS.starter;

  res.json({
    planName: shop.planName,
    planStatus: shop.planStatus,
    generationsUsed: shop.generationsUsed,
    generationsLimit: shop.generationsLimit,
    generationsRemaining: Math.max(0, shop.generationsLimit - shop.generationsUsed),
    percentUsed: Math.round((shop.generationsUsed / shop.generationsLimit) * 100),
    billingCycleStart: shop.billingCycleStart,
    nextReset: new Date(new Date(shop.billingCycleStart).setDate(new Date(shop.billingCycleStart).getDate() + 30)),
    planDetails: plan,
  });
});

// POST /api/billing/cancel — cancel subscription
router.post('/cancel', verifyShopifySession, async (req, res) => {
  try {
    await prisma.shop.update({
      where: { id: req.shop.id },
      data: { planStatus: 'cancelled' },
    });
    res.json({ cancelled: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.PLANS = PLANS;
