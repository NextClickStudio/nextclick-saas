const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const { verifyShopifySession } = require('../middleware/auth');

// GET /api/analytics/overview
router.get('/overview', verifyShopifySession, async (req, res) => {
  try {
    const shopId = req.shop.id;
    const days = parseInt(req.query.days) || 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [totalGenerations, recentGenerations, totalClicks, topProducts] = await Promise.all([
      prisma.generation.count({ where: { shopId } }),
      prisma.generation.count({ where: { shopId, createdAt: { gte: since }, error: false } }),
      prisma.productClick.count({ where: { generation: { shopId } } }),
      prisma.productClick.groupBy({
        by: ['productTitle', 'shopifyId'],
        where: { generation: { shopId, createdAt: { gte: since } } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
    ]);

    // Daily breakdown
    const daily = await prisma.$queryRaw`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM generations
      WHERE shop_id = ${shopId}
        AND created_at >= ${since}
        AND error = false
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    // Avg duration
    const avgDuration = await prisma.generation.aggregate({
      where: { shopId, error: false, createdAt: { gte: since } },
      _avg: { durationMs: true },
    });

    res.json({
      totalGenerations,
      recentGenerations,
      totalClicks,
      clickRate: recentGenerations > 0 ? ((totalClicks / recentGenerations) * 100).toFixed(1) : 0,
      avgDurationMs: Math.round(avgDuration._avg.durationMs || 0),
      topProducts: topProducts.map(p => ({ title: p.productTitle, clicks: p._count.id })),
      daily,
      generationsUsed: req.shop.generationsUsed,
      generationsLimit: req.shop.generationsLimit,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/generations — paginated list
router.get('/generations', verifyShopifySession, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [items, total] = await Promise.all([
      prisma.generation.findMany({
        where: { shopId: req.shop.id },
        include: { clicks: { select: { productTitle: true, price: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.generation.count({ where: { shopId: req.shop.id } }),
    ]);

    res.json({ items, total, pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
