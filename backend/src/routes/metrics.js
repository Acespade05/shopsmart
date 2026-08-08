const express = require('express');
const pool = require('../config/database');

const router = express.Router();

// GET /api/metrics/active-sessions — sessions active in last 5 minutes
router.get('/active-sessions', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) FROM sessions WHERE last_active > now() - INTERVAL '5 minutes'`
    );
    res.json({ activeSessions: parseInt(result.rows[0].count, 10) });
  } catch (err) {
    console.error('Active sessions error', err);
    res.status(500).json({ error: 'Failed to fetch active sessions' });
  }
});

// GET /api/metrics/active-checkouts — carts in checkout status, updated recently
router.get('/active-checkouts', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) FROM carts WHERE status = 'checkout' AND updated_at > now() - INTERVAL '10 minutes'`
    );
    res.json({ activeCheckouts: parseInt(result.rows[0].count, 10) });
  } catch (err) {
    console.error('Active checkouts error', err);
    res.status(500).json({ error: 'Failed to fetch active checkouts' });
  }
});

// GET /api/metrics/aov — average order value, last 7 days
router.get('/aov', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT COALESCE(AVG(total), 0) AS aov FROM orders
       WHERE created_at > now() - INTERVAL '7 days' AND payment_status = 'paid'`
    );
    res.json({ averageOrderValue: parseFloat(result.rows[0].aov).toFixed(2) });
  } catch (err) {
    console.error('AOV error', err);
    res.status(500).json({ error: 'Failed to fetch AOV' });
  }
});

// GET /api/metrics/conversion-rate — orders / sessions ratio, last 7 days
router.get('/conversion-rate', async (req, res) => {
  try {
    const ordersResult = await pool.query(
      `SELECT COUNT(*) FROM orders WHERE created_at > now() - INTERVAL '7 days' AND payment_status = 'paid'`
    );
    const sessionsResult = await pool.query(
      `SELECT COUNT(DISTINCT id) FROM sessions WHERE created_at > now() - INTERVAL '7 days'`
    );

    const orders = parseInt(ordersResult.rows[0].count, 10);
    const sessions = parseInt(sessionsResult.rows[0].count, 10);
    const rate = sessions > 0 ? (orders / sessions) * 100 : 0;

    res.json({
      conversionRate: parseFloat(rate.toFixed(2)),
      orders,
      sessions,
    });
  } catch (err) {
    console.error('Conversion rate error', err);
    res.status(500).json({ error: 'Failed to fetch conversion rate' });
  }
});

// GET /api/metrics/revenue-today
router.get('/revenue-today', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT COALESCE(SUM(total), 0) AS revenue, COUNT(*) AS order_count
       FROM orders
       WHERE created_at::date = CURRENT_DATE AND payment_status = 'paid'`
    );
    res.json({
      revenue: parseFloat(result.rows[0].revenue).toFixed(2),
      orderCount: parseInt(result.rows[0].order_count, 10),
    });
  } catch (err) {
    console.error('Revenue today error', err);
    res.status(500).json({ error: 'Failed to fetch revenue' });
  }
});

// GET /api/metrics/revenue-hourly — revenue per hour, last 24h
// Used by the AI Narrator to detect peak-hour incidents (per AI-SRE doc Section 4.2)
router.get('/revenue-hourly', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT date_trunc('hour', created_at) AS hour, COALESCE(SUM(total), 0) AS revenue
       FROM orders
       WHERE created_at > now() - INTERVAL '24 hours' AND payment_status = 'paid'
       GROUP BY hour
       ORDER BY hour`
    );
    res.json({
      hourly: result.rows.map((r) => ({
        hour: r.hour,
        revenue: parseFloat(r.revenue).toFixed(2),
      })),
    });
  } catch (err) {
    console.error('Revenue hourly error', err);
    res.status(500).json({ error: 'Failed to fetch hourly revenue' });
  }
});

module.exports = router;