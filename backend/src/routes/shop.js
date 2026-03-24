const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const { verifyShopifySession } = require('../middleware/auth');

router.get('/', verifyShopifySession, async (req, res) => {
  const shop = await prisma.shop.findUnique({
    where: { id: req.shop.id },
    include: { config: true },
  });
  res.json({ shop });
});

module.exports = router;
