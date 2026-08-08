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
      `SELECT oi.quantity, oi.price, p.name, p.slug, p.images
       FROM order_items oi JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = $1`,
      [order.id]
    );

    const addressResult = await pool.query('SELECT * FROM addresses WHERE id = $1', [order.address_id]);

    res.json({ order, items: itemsResult.rows, address: addressResult.rows[0] || null });
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

module.exports = router;