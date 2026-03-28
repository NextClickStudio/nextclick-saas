const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const { verifyShopifySession } = require('../middleware/auth');

// GET /api/config — load full config for this shop
router.get('/', verifyShopifySession, async (req, res) => {
  try {
    const config = await prisma.shopConfig.findUnique({
      where: { shopId: req.shop.id },
    });
    res.json({ config });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/config — update any config fields
router.patch('/', verifyShopifySession, async (req, res) => {
  try {
    const allowed = [
      'category',
      'logoUrl', 'primaryColor', 'secondaryColor', 'bgColor',
      'textColor', 'subtitleColor', 'buttonColor', 'buttonTextColor', 'fontFamily', 'borderRadius',
      'brandName', 'heroTitle', 'heroSubtitle', 'ctaText', 'loadingText',
      'questionFlow',
      'aiPersona', 'aiTone', 'aiLanguage',
      'widgetPosition', 'widgetTrigger',
    ];

    const updates = {};
    for (const key of allowed) {
      if (key in req.body) updates[key] = req.body[key];
    }

    const config = await prisma.shopConfig.update({
      where: { shopId: req.shop.id },
      data: { ...updates, updatedAt: new Date() },
    });

    res.json({ config });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/config/reset — reset to defaults
router.post('/reset', verifyShopifySession, async (req, res) => {
  try {
    const config = await prisma.shopConfig.update({
      where: { shopId: req.shop.id },
      data: {
        primaryColor: '#0A0A0A',
        secondaryColor: '#00E676',
        bgColor: '#F5F5F5',
        textColor: '#0A0A0A',
        buttonColor: '#0A0A0A',
        buttonTextColor: '#FFFFFF',
        fontFamily: 'Inter',
        borderRadius: '4px',
        heroTitle: 'Find your perfect routine',
        heroSubtitle: 'Personalizzata per te dall\'intelligenza artificiale',
        ctaText: 'Start now',
        questionFlow: [],
        aiPersona: 'You are an expert consultant. Provide personalized and professional advice.',
      },
    });
    res.json({ config });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/config/preview-token — genera token per anteprima widget
router.get('/preview-token', verifyShopifySession, async (req, res) => {
  const jwt = require('jsonwebtoken');
  const token = jwt.sign(
    { shopId: req.shop.id, shopDomain: req.shop.shopDomain, preview: true },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  res.json({ token, widgetUrl: `${process.env.HOST}/widget?shop=${req.shop.shopDomain}&preview=1` });
});

module.exports = router;
