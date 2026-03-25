const express = require('express');
const router  = express.Router();
const prisma  = require('../utils/prisma');
const { verifyShopifySession } = require('../middleware/auth');

const PLANS = {
  starter: { name: 'Starter', price: 49.00,  trialDays: 7, generationsLimit: 1000   },
  pro:     { name: 'Pro',     price: 199.00, trialDays: 7, generationsLimit: 10000  },
  scale:   { name: 'Scale',   price: 499.00, trialDays: 7, generationsLimit: 100000 },
};

router.get('/plans', (_req, res) => res.json({ plans: PLANS }));

// POST /api/billing/subscribe
// For custom/development apps, Shopify Billing API is not available.
// We activate the plan directly in the DB and skip the Shopify charge.
router.post('/subscribe', verifyShopifySession, async (req, res) => {
  try {
    const { planName } = req.body;
    const plan = PLANS[planName];
    if (!plan) return res.status(400).json({ error: 'Invalid plan' });

    const isProduction = process.env.NODE_ENV === 'production'
      && process.env.SHOPIFY_APP_TYPE !== 'custom';

    if (isProduction) {
      // Real public app — use Shopify Billing API
      try {
        const shopify = req.shopify;
        const session = req.session_data;
        const client  = new shopify.clients.Graphql({ session });

        const mutation = `
          mutation AppSubscriptionCreate($name: String!, $lineItems: [AppSubscriptionLineItemInput!]!, $returnUrl: URL!, $trialDays: Int, $test: Boolean) {
            appSubscriptionCreate(name: $name returnUrl: $returnUrl trialDays: $trialDays lineItems: $lineItems test: $test) {
              appSubscription { id status }
              confirmationUrl
              userErrors { field message }
            }
          }
        `;
        const response = await client.request(mutation, {
          variables: {
            name: `NextClick ${plan.name}`,
            trialDays: plan.trialDays,
            test: false,
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
        });

        const result = response.data?.appSubscriptionCreate;
        if (result?.userErrors?.length) {
          return res.status(400).json({ error: result.userErrors[0].message });
        }
        return res.json({ confirmationUrl: result.confirmationUrl });
      } catch (billingErr) {
        console.warn('Billing API failed, falling back to direct activation:', billingErr.message);
      }
    }

    // Custom app or fallback: activate plan directly without Shopify charge
    await prisma.shop.update({
      where: { id: req.shop.id },
      data: {
        planName,
        planStatus: 'active',
        generationsLimit: plan.generationsLimit,
        generationsUsed: 0,
        billingCycleStart: new Date(),
      },
    });

    await prisma.shopConfig.update({
      where: { shopId: req.shop.id },
      data: {
        featureRoutine: planName !== 'starter',
        featureProducts: true,
        featurePdf: planName !== 'starter',
      },
    });

    // Return a redirect URL that goes back to the app (no Shopify billing page)
    res.json({ confirmationUrl: `/?shop=${req.shop.shopDomain}&subscribed=1` });

  } catch (err) {
    console.error('Subscribe error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/billing/confirm — called after Shopify billing redirect (public apps only)
router.get('/confirm', async (req, res) => {
  try {
    const { shop, plan } = req.query;
    const planConfig = PLANS[plan];
    if (!planConfig) return res.redirect('/?error=invalid_plan');

    const shopRecord = await prisma.shop.findUnique({ where: { shopDomain: shop } });
    if (!shopRecord) return res.redirect('/?error=shop_not_found');

    await prisma.shop.update({
      where: { shopDomain: shop },
      data: {
        planName: plan,
        planStatus: 'active',
        generationsLimit: planConfig.generationsLimit,
        generationsUsed: 0,
        billingCycleStart: new Date(),
      },
    });

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

router.get('/status', verifyShopifySession, async (req, res) => {
  const shop = req.shop;
  res.json({
    planName: shop.planName,
    planStatus: shop.planStatus,
    generationsUsed: shop.generationsUsed,
    generationsLimit: shop.generationsLimit,
    generationsRemaining: Math.max(0, shop.generationsLimit - shop.generationsUsed),
    percentUsed: Math.round((shop.generationsUsed / shop.generationsLimit) * 100),
    billingCycleStart: shop.billingCycleStart,
  });
});

router.post('/cancel', verifyShopifySession, async (req, res) => {
  try {
    await prisma.shop.update({ where: { id: req.shop.id }, data: { planStatus: 'cancelled' } });
    res.json({ cancelled: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.PLANS = PLANS;
