const express = require('express');
const { getSaleState } = require('../services/pricing');

const router = express.Router();

// GET /api/sales/active — PUBLIC. The sale running now (or null) and the next
// scheduled one. The storefront banner reads this; so do the traffic bots.
router.get('/active', async (req, res) => {
  try {
    const { live, next } = await getSaleState();
    res.json({ sale: live, next, serverTime: new Date().toISOString() });
  } catch (err) {
    console.error('Active sale error', err);
    res.status(500).json({ error: 'Failed to fetch sale' });
  }
});

module.exports = router;
