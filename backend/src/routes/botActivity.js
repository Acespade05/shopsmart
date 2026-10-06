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

    const recentResult = await pool.query(
      `SELECT COUNT(DISTINCT bot_id) FILTER (WHERE created_at > now() - INTERVAL '60 seconds') AS active_bots,
              COUNT(*) AS visits_5m
       FROM bot_activity WHERE created_at > now() - INTERVAL '5 minutes'`
    );

    res.json({
      activity: result.rows,
      activeBots: parseInt(recentResult.rows[0].active_bots, 10), // kept for older clients
      visitsLast5Min: parseInt(recentResult.rows[0].visits_5m, 10),
    });
  } catch (err) {
    console.error('Bot activity fetch error', err);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

// GET /api/bot-activity/summary?minutes=60 — visit outcomes for the admin panel
router.get('/summary', authenticate, requireAdmin, async (req, res) => {
  try {
    const minutes = Math.min(Math.max(parseInt(req.query.minutes, 10) || 60, 5), 1440);
    const result = await pool.query(
      `SELECT action, COUNT(*)::int AS count FROM bot_activity
       WHERE created_at > now() - make_interval(mins => $1)
       GROUP BY action`,
      [minutes]
    );
    res.json({ minutes, outcomes: Object.fromEntries(result.rows.map((r) => [r.action, r.count])) });
  } catch (err) {
    console.error('Bot activity summary error', err);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

module.exports = router;