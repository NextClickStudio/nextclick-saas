const express = require('express');
const router  = express.Router();
const prisma  = require('../utils/prisma');
const { verifyShopifySession } = require('../middleware/auth');

router.get('/overview', verifyShopifySession, async (req, res) => {
  try {
    const shopId = req.shop.id;
    const days   = parseInt(req.query.days) || 30;
    const since  = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [totalGenerations, recentGenerations, totalClicks, avgDuration] = await Promise.all([
      prisma.generation.count({ where: { shopId } }),
      prisma.generation.count({ where: { shopId, createdAt: { gte: since }, error: false } }),
      prisma.productClick.count({ where: { generation: { shopId } } }),
      prisma.generation.aggregate({
        where: { shopId, error: false, createdAt: { gte: since } },
        _avg: { durationMs: true },
      }),
    ]);

    const topProducts = await prisma.productClick.groupBy({
      by: ['productTitle'],
      where: { generation: { shopId, createdAt: { gte: since } } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });

    // Use JS aggregation instead of $queryRaw to avoid snake_case issues
    const recentGens = await prisma.generation.findMany({
      where: { shopId, createdAt: { gte: since }, error: false },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    // Group by date in JS
    const dailyMap = {};
    for (const g of recentGens) {
      const date = g.createdAt.toISOString().split('T')[0];
      dailyMap[date] = (dailyMap[date] || 0) + 1;
    }
    const daily = Object.entries(dailyMap).map(([date, count]) => ({ date, count }));

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
    console.error('Analytics error:', err);
    res.status(500).json({ error: err.message });
  }
});

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
