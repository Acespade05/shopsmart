const express = require('express');
const pool = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// POST /api/bot-activity — bots report what they're doing.
// No auth needed: internal traffic only, low-risk, write-only for bots.
router.post('/', async (req, res) => {
  try {
    const { botId, action, detail } = req.body;
    if (!botId || !action) {
      return res.status(400).json({ error: 'botId and action are required' });
    }
    await pool.query(
      `INSERT INTO bot_activity (bot_id, action, detail) VALUES ($1, $2, $3)`,
      [botId, action, detail || null]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('Bot activity log error', err);
    res.status(500).json({ error: 'Failed to log activity' });
  }
});

// GET /api/bot-activity/recent — live feed, admins only
router.get('/recent', authenticate, requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
    const result = await pool.query(
      `SELECT bot_id, action, detail, created_at
       FROM bot_activity
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );

    const activeBotsResult = await pool.query(
      `SELECT COUNT(DISTINCT bot_id) FROM bot_activity WHERE created_at > now() - INTERVAL '60 seconds'`
    );

    res.json({
      activity: result.rows,
      activeBots: parseInt(activeBotsResult.rows[0].count, 10),
    });
  } catch (err) {
    console.error('Bot activity fetch error', err);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

module.exports = router;