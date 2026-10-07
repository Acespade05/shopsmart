// Admin: sales calendar and revenue over time. Mounted under /api/admin.
// Admin-only. /api/metrics (what AI-SRE reads) is not touched by any of this.
const express = require('express');
const pool = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { invalidateSales } = require('../services/pricing');

const router = express.Router();
router.use(authenticate, requireAdmin);

// Sale ids are numbers; anything else is simply "not found"
router.param('id', (req, res, next, id) => {
  if (!/^\d+$/.test(id)) return res.status(404).json({ error: 'Sale not found' });
  next();
});

const SYNTHETIC = "u.email LIKE '%@shopsmart-synthetic.internal'";
const IST = "interval '5 hours 30 minutes'";
const IST_OFFSET_S = 19800;

// ------------------------------------------------------------------ sales
const SALE_FIELDS = `
  s.id, s.name, s.discount_percent, s.category_slugs, s.starts_at, s.ends_at,
  CASE WHEN s.starts_at > now() THEN 'scheduled' WHEN s.ends_at > now() THEN 'live' ELSE 'ended' END AS status`;

function saleJson(r) {
  return {
    id: r.id,
    name: r.name,
    discountPercent: r.discount_percent,
    categories: r.category_slugs,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    status: r.status,
    orders: r.orders === undefined ? undefined : r.orders,
    revenue: r.revenue === undefined ? undefined : parseFloat(r.revenue || 0),
  };
}

// Checks a sale's fields; returns an error message or null.
async function validate({ name, discountPercent, categories, startsAt, endsAt }, ignoreId = 0) {
  if (!name || !String(name).trim()) return 'Give the sale a name';
  if (String(name).length > 80) return 'Name is too long (80 characters max)';
  const pct = Number(discountPercent);
  if (!Number.isInteger(pct) || pct < 5 || pct > 80) return 'Discount must be a whole number from 5 to 80 (%)';
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'Start and end times are required';
  if (end <= start) return 'The sale must end after it starts';
  if (end <= new Date()) return 'The end time is already in the past';
  if (categories !== null && categories !== undefined) {
    if (!Array.isArray(categories) || categories.length === 0) return 'Pick at least one category, or the whole store';
    categories = [...new Set(categories)];
    const known = await pool.query('SELECT slug FROM categories WHERE slug = ANY($1::text[])', [categories]);
    if (known.rows.length !== categories.length) return 'Unknown category in the list';
  }
  // One sale at a time keeps prices unambiguous
  const overlap = await pool.query(
    `SELECT name FROM sales
     WHERE id <> $1 AND starts_at < ($3::timestamptz AT TIME ZONE 'UTC') AND ends_at > ($2::timestamptz AT TIME ZONE 'UTC')
     LIMIT 1`,
    [ignoreId, start.toISOString(), end.toISOString()]
  );
  if (overlap.rows.length) return `Overlaps with "${overlap.rows[0].name}" — only one sale can run at a time`;
  return null;
}

// GET /api/admin/sales — every sale, newest first, with orders/revenue made during it
router.get('/sales', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ${SALE_FIELDS},
              (SELECT COUNT(*)::int FROM orders o WHERE o.sale_id = s.id AND o.payment_status = 'paid') AS orders,
              (SELECT COALESCE(SUM(total), 0) FROM orders o WHERE o.sale_id = s.id AND o.payment_status = 'paid') AS revenue
       FROM sales s
       ORDER BY (s.ends_at > now()) DESC, CASE WHEN s.ends_at > now() THEN s.starts_at END ASC, s.starts_at DESC`
    );
    res.json({ sales: result.rows.map(saleJson) });
  } catch (err) {
    console.error('List sales error', err);
    res.status(500).json({ error: 'Failed to fetch sales' });
  }
});

// POST /api/admin/sales — schedule a sale (startsAt in the past/now = start immediately)
router.post('/sales', async (req, res) => {
  try {
    // "Start right now" uses the server's clock, not the browser's
    const startNow = req.body.startNow === true || !req.body.startsAt;
    const body = {
      ...req.body,
      categories: Array.isArray(req.body.categories) ? [...new Set(req.body.categories)] : req.body.categories,
      startsAt: startNow ? new Date().toISOString() : req.body.startsAt,
    };
    const problem = await validate(body);
    if (problem) return res.status(400).json({ error: problem });
    const result = await pool.query(
      `INSERT INTO sales (name, discount_percent, category_slugs, starts_at, ends_at)
       VALUES ($1, $2, $3, GREATEST($4::timestamptz AT TIME ZONE 'UTC', now()), $5::timestamptz AT TIME ZONE 'UTC')
       RETURNING id`,
      [
        String(body.name).trim(),
        Number(body.discountPercent),
        body.categories || null,
        new Date(body.startsAt).toISOString(),
        new Date(body.endsAt).toISOString(),
      ]
    );
    invalidateSales();
    const sale = await pool.query(`SELECT ${SALE_FIELDS} FROM sales s WHERE id = $1`, [result.rows[0].id]);
    res.status(201).json({ sale: saleJson(sale.rows[0]) });
  } catch (err) {
    console.error('Create sale error', err);
    res.status(500).json({ error: 'Failed to create sale' });
  }
});

// PUT /api/admin/sales/:id — edit a scheduled sale (a live sale: only name and end time)
router.put('/sales/:id', async (req, res) => {
  try {
    const current = await pool.query(`SELECT ${SALE_FIELDS} FROM sales s WHERE id = $1`, [req.params.id]);
    if (!current.rows.length) return res.status(404).json({ error: 'Sale not found' });
    const s = saleJson(current.rows[0]);
    if (s.status === 'ended') return res.status(400).json({ error: 'This sale has ended and can no longer be changed' });
    const live = s.status === 'live';
    const next = {
      name: req.body.name ?? s.name,
      discountPercent: live ? s.discountPercent : req.body.discountPercent ?? s.discountPercent,
      categories: live
        ? s.categories
        : Array.isArray(req.body.categories)
          ? [...new Set(req.body.categories)]
          : req.body.categories !== undefined
            ? req.body.categories
            : s.categories,
      startsAt: live ? s.startsAt : req.body.startsAt ?? s.startsAt,
      endsAt: req.body.endsAt ?? s.endsAt,
    };
    const problem = await validate(next, s.id);
    if (problem) return res.status(400).json({ error: problem });
    await pool.query(
      `UPDATE sales SET name = $2, discount_percent = $3, category_slugs = $4,
              starts_at = CASE WHEN starts_at <= now() THEN starts_at
                               ELSE GREATEST($5::timestamptz AT TIME ZONE 'UTC', now()) END,
              ends_at = $6::timestamptz AT TIME ZONE 'UTC'
       WHERE id = $1`,
      [
        s.id,
        String(next.name).trim(),
        Number(next.discountPercent),
        next.categories || null,
        new Date(next.startsAt).toISOString(),
        new Date(next.endsAt).toISOString(),
      ]
    );
    invalidateSales();
    const updated = await pool.query(`SELECT ${SALE_FIELDS} FROM sales s WHERE id = $1`, [s.id]);
    res.json({ sale: saleJson(updated.rows[0]) });
  } catch (err) {
    console.error('Update sale error', err);
    res.status(500).json({ error: 'Failed to update sale' });
  }
});

// POST /api/admin/sales/:id/start-now — start a scheduled sale immediately
router.post('/sales/:id/start-now', async (req, res) => {
  try {
    const current = await pool.query(`SELECT ${SALE_FIELDS} FROM sales s WHERE id = $1`, [req.params.id]);
    if (!current.rows.length) return res.status(404).json({ error: 'Sale not found' });
    const s = saleJson(current.rows[0]);
    if (s.status !== 'scheduled') return res.status(400).json({ error: `This sale is already ${s.status}` });
    const problem = await validate({ ...s, startsAt: new Date().toISOString() }, s.id);
    if (problem) return res.status(400).json({ error: problem });
    await pool.query('UPDATE sales SET starts_at = now() WHERE id = $1', [s.id]);
    invalidateSales();
    res.json({ ok: true });
  } catch (err) {
    console.error('Start sale error', err);
    res.status(500).json({ error: 'Failed to start sale' });
  }
});

// POST /api/admin/sales/:id/end-now — end a live sale early
router.post('/sales/:id/end-now', async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE sales SET ends_at = now() WHERE id = $1 AND starts_at <= now() AND ends_at > now() RETURNING id',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(400).json({ error: 'Only a live sale can be ended' });
    invalidateSales();
    res.json({ ok: true });
  } catch (err) {
    console.error('End sale error', err);
    res.status(500).json({ error: 'Failed to end sale' });
  }
});

// DELETE /api/admin/sales/:id — remove a sale that hasn't started
router.delete('/sales/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM sales WHERE id = $1 AND starts_at > now() RETURNING id', [
      req.params.id,
    ]);
    if (!result.rows.length) return res.status(400).json({ error: 'Only scheduled sales can be deleted (end a live one instead)' });
    invalidateSales();
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete sale error', err);
    res.status(500).json({ error: 'Failed to delete sale' });
  }
});

// ------------------------------------------------------------------ revenue over time
// GET /api/admin/revenue-series?range=day|week|month
// Paid orders bucketed by Indian time: per hour today (with yesterday for
// comparison), or per day for the last 7 / 30 days (with the period before).
// Each point: t (bucket start, epoch ms), revenue, orders, botRevenue.
router.get('/revenue-series', async (req, res) => {
  try {
    const range = ['day', 'week', 'month'].includes(req.query.range) ? req.query.range : 'day';
    const days = range === 'day' ? 1 : range === 'week' ? 7 : 30;
    const unit = range === 'day' ? 'hour' : 'day';

    // IST midnight today, as epoch seconds
    const todayRes = await pool.query(
      `SELECT EXTRACT(EPOCH FROM date_trunc('day', now() + ${IST}))::bigint - ${IST_OFFSET_S} AS today_start`
    );
    const todayStart = Number(todayRes.rows[0].today_start) * 1000;
    const step = unit === 'hour' ? 3600e3 : 86400e3;
    const periodStart = todayStart - (days - 1) * 86400e3; // first bucket of this period
    const prevStart = periodStart - days * 86400e3; // the period before, for comparison
    const periodEnd = todayStart + 86400e3;

    const rows = await pool.query(
      `SELECT EXTRACT(EPOCH FROM date_trunc('${unit}', o.created_at + ${IST}))::bigint - ${IST_OFFSET_S} AS bucket,
              SUM(o.total) AS revenue,
              COUNT(*)::int AS orders,
              COALESCE(SUM(o.total) FILTER (WHERE ${SYNTHETIC}), 0) AS bot_revenue,
              COUNT(*) FILTER (WHERE ${SYNTHETIC})::int AS bot_orders
       FROM orders o JOIN users u ON u.id = o.user_id
       WHERE o.payment_status = 'paid'
         AND o.created_at >= to_timestamp($1 / 1000.0) AT TIME ZONE 'UTC'
         AND o.created_at <  to_timestamp($2 / 1000.0) AT TIME ZONE 'UTC'
       GROUP BY 1`,
      [prevStart, periodEnd]
    );
    const byBucket = new Map(rows.rows.map((r) => [Number(r.bucket) * 1000, r]));
    const nowMs = Date.now();
    const point = (t) => {
      const r = byBucket.get(t);
      return {
        t,
        revenue: r ? parseFloat(r.revenue) : 0,
        orders: r ? r.orders : 0,
        botRevenue: r ? parseFloat(r.bot_revenue) : 0,
        botOrders: r ? r.bot_orders : 0,
      };
    };

    const points = []; // this period, up to now
    const previous = []; // the whole previous period, bucket-aligned
    let prevSoFarRevenue = 0;
    let prevSoFarOrders = 0;
    for (let t = periodStart; t < periodEnd; t += step) {
      const prev = point(t - days * 86400e3);
      previous.push(prev);
      if (t > nowMs) continue; // future hours of today
      points.push(point(t));
      prevSoFarRevenue += prev.revenue;
      prevSoFarOrders += prev.orders;
    }
    // The full previous period (for the "vs previous" total)
    let prevRevenue = 0;
    let prevOrders = 0;
    for (const [t, r] of byBucket) {
      if (t >= prevStart && t < periodStart) {
        prevRevenue += parseFloat(r.revenue);
        prevOrders += r.orders;
      }
    }
    // Same-time-so-far comparison for "today vs yesterday"
    const sum = (arr, k) => arr.reduce((s, p) => s + p[k], 0);

    const salesRes = await pool.query(
      `SELECT ${SALE_FIELDS} FROM sales s
       WHERE s.starts_at < to_timestamp($2 / 1000.0) AT TIME ZONE 'UTC'
         AND s.ends_at > to_timestamp($1 / 1000.0) AT TIME ZONE 'UTC'
       ORDER BY s.starts_at`,
      [periodStart, periodEnd]
    );

    res.json({
      range,
      timezone: 'Asia/Kolkata',
      unit,
      periodStart,
      periodEnd,
      points,
      previous,
      totals: { revenue: sum(points, 'revenue'), orders: sum(points, 'orders'), botOrders: sum(points, 'botOrders') },
      previousSoFar: { revenue: prevSoFarRevenue, orders: prevSoFarOrders },
      previousTotals: { revenue: prevRevenue, orders: prevOrders },
      sales: salesRes.rows.map(saleJson),
    });
  } catch (err) {
    console.error('Revenue series error', err);
    res.status(500).json({ error: 'Failed to fetch revenue' });
  }
});

module.exports = router;
