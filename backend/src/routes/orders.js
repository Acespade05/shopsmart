const express = require('express');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/orders — order history
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, total, subtotal, discount, status, payment_status, created_at
       FROM orders WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json({ orders: result.rows });
  } catch (err) {
    console.error('List orders error', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// GET /api/orders/:id — detail
router.get('/:id', async (req, res) => {
  try {
    const orderResult = await pool.query('SELECT * FROM orders WHERE id = $1 AND user_id = $2', [
      req.params.id,
      req.user.id,
    ]);
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    const order = orderResult.rows[0];

    const itemsResult = await pool.query(
      `SELECT oi.quantity, oi.price, oi.size, p.name, p.slug, p.images
       FROM order_items oi JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = $1`,
      [order.id]
    );

    const addressResult = await pool.query('SELECT * FROM addresses WHERE id = $1', [order.address_id]);
    const historyResult = await pool.query(
      'SELECT status, changed_at FROM order_status_history WHERE order_id = $1 ORDER BY changed_at ASC',
      [order.id]
    );
    const returnResult = await pool.query(
      'SELECT id, reason, details, status, created_at, updated_at FROM return_requests WHERE order_id = $1',
      [order.id]
    );

    res.json({
      order,
      items: itemsResult.rows,
      address: addressResult.rows[0] || null,
      history: historyResult.rows,
      returnRequest: returnResult.rows[0] || null,
    });
  } catch (err) {
    console.error('Get order error', err);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// PUT /api/orders/:id/cancel
router.put('/:id/cancel', async (req, res) => {
  try {
    const orderResult = await pool.query('SELECT * FROM orders WHERE id = $1 AND user_id = $2', [
      req.params.id,
      req.user.id,
    ]);
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    const order = orderResult.rows[0];

    if (['shipped', 'delivered', 'cancelled'].includes(order.status)) {
      return res.status(400).json({ error: `Cannot cancel an order that is ${order.status}` });
    }

    await pool.query(`UPDATE orders SET status = 'cancelled' WHERE id = $1`, [order.id]);
    await pool.query(`INSERT INTO order_status_history (order_id, status) VALUES ($1, 'cancelled')`, [order.id]);

    // restock items
    const items = await pool.query('SELECT product_id, quantity FROM order_items WHERE order_id = $1', [order.id]);
    for (const item of items.rows) {
      await pool.query('UPDATE products SET stock = stock + $1 WHERE id = $2', [item.quantity, item.product_id]);
      await pool.query(
        `INSERT INTO inventory_log (product_id, change, reason) VALUES ($1, $2, 'adjustment')`,
        [item.product_id, item.quantity]
      );
    }

    res.json({ message: 'Order cancelled' });
  } catch (err) {
    console.error('Cancel order error', err);
    res.status(500).json({ error: 'Failed to cancel order' });
  }
});

const RETURN_REASONS = [
  'Damaged or defective',
  'Wrong item received',
  'Size or fit issue',
  'Not as described',
  'No longer needed',
];
const RETURN_WINDOW_DAYS = 10;

// POST /api/orders/:id/return — request a return for a delivered order
router.post('/:id/return', async (req, res) => {
  try {
    const { reason, details } = req.body;
    if (!RETURN_REASONS.includes(reason)) {
      return res.status(400).json({ error: `reason must be one of: ${RETURN_REASONS.join(', ')}` });
    }
    const orderResult = await pool.query('SELECT * FROM orders WHERE id = $1 AND user_id = $2', [
      req.params.id,
      req.user.id,
    ]);
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    const order = orderResult.rows[0];
    if (order.status !== 'delivered') {
      return res.status(400).json({ error: 'Only delivered orders can be returned' });
    }
    const delivered = await pool.query(
      `SELECT MAX(changed_at) AS at FROM order_status_history WHERE order_id = $1 AND status = 'delivered'`,
      [order.id]
    );
    const deliveredAt = delivered.rows[0].at || order.updated_at;
    if (Date.now() - new Date(deliveredAt).getTime() > RETURN_WINDOW_DAYS * 86400000) {
      return res.status(400).json({ error: `Returns are accepted within ${RETURN_WINDOW_DAYS} days of delivery` });
    }

    const result = await pool.query(
      `INSERT INTO return_requests (order_id, user_id, reason, details)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (order_id) DO NOTHING
       RETURNING id, reason, details, status, created_at, updated_at`,
      [order.id, req.user.id, reason, (details || '').slice(0, 1000) || null]
    );
    if (result.rows.length === 0) {
      return res.status(409).json({ error: 'A return has already been requested for this order' });
    }
    res.status(201).json({ returnRequest: result.rows[0] });
  } catch (err) {
    console.error('Return request error', err);
    res.status(500).json({ error: 'Failed to request return' });
  }
});

module.exports = router;