const express = require('express');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { getCart, saveCart, clearCart } = require('../services/cacheService');
const { processPayment } = require('../services/paymentService');

const router = express.Router();
router.use(authenticate);

function cartOwnerId(req) {
  return `user:${req.user.id}`;
}

// POST /api/checkout/start — validate cart, mark checkout intent
router.post('/start', async (req, res) => {
  try {
    const cart = await getCart(cartOwnerId(req));
    if (!cart.items || cart.items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    const subtotal = cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    res.json({ cart, subtotal: parseFloat(subtotal.toFixed(2)) });
  } catch (err) {
    console.error('Checkout start error', err);
    res.status(500).json({ error: 'Failed to start checkout' });
  }
});

// POST /api/checkout/apply-coupon
//
// NOTE: ShopSmart spec Section 7 lists an intentional recursive-call chaos
// scenario here ("discount code applies to itself"), used later to trigger
// the `kill_loop` remediation action. That failure mode is deliberately NOT
// wired in yet — it gets toggled on in Week 6 alongside the other chaos
// scenarios, behind a scenario flag, so it can't accidentally crash the app
// during normal development. This version is a safe, working implementation.
router.post('/apply-coupon', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'code is required' });
    }

    const cart = await getCart(cartOwnerId(req));
    if (!cart.items || cart.items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }
    const subtotal = cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0);

    const result = await pool.query(
      `SELECT * FROM discount_codes
       WHERE code = $1 AND is_active = true
         AND (expires_at IS NULL OR expires_at > now())
         AND (max_uses IS NULL OR used_count < max_uses)`,
      [code.toUpperCase()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid or expired discount code' });
    }
    const discount = result.rows[0];

    if (subtotal < parseFloat(discount.min_order_value)) {
      return res.status(400).json({
        error: `Minimum order value of ${discount.min_order_value} required for this code`,
      });
    }

    const discountAmount =
      discount.type === 'percentage'
        ? subtotal * (parseFloat(discount.value) / 100)
        : parseFloat(discount.value);

    const total = Math.max(subtotal - discountAmount, 0);

    res.json({
      code: discount.code,
      subtotal: parseFloat(subtotal.toFixed(2)),
      discount: parseFloat(discountAmount.toFixed(2)),
      total: parseFloat(total.toFixed(2)),
    });
  } catch (err) {
    console.error('Apply coupon error', err);
    res.status(500).json({ error: 'Failed to apply coupon' });
  }
});

// POST /api/checkout/payment — process mock payment
router.post('/payment', async (req, res) => {
  try {
    const { amount, method } = req.body;
    if (!amount || !method) {
      return res.status(400).json({ error: 'amount and method are required' });
    }

    const result = await processPayment({ amount, method });
    if (!result.success) {
      return res.status(402).json({ error: result.message, code: result.error });
    }

    res.json({ payment: result });
  } catch (err) {
    console.error('Payment error', err);
    res.status(500).json({ error: 'Payment processing failed' });
  }
});

// POST /api/checkout/confirm — place the order
router.post('/confirm', async (req, res) => {
  const client = await pool.connect();
  try {
    const { addressId, paymentMethod, transactionId, discountCode } = req.body;
    if (!addressId || !paymentMethod || !transactionId) {
      return res.status(400).json({ error: 'addressId, paymentMethod, and transactionId are required' });
    }

    const cart = await getCart(cartOwnerId(req));
    if (!cart.items || cart.items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    await client.query('BEGIN');

    // Lock and verify stock for every item before committing the order
    for (const item of cart.items) {
      const stockResult = await client.query('SELECT stock FROM products WHERE id = $1 FOR UPDATE', [
        item.productId,
      ]);
      if (stockResult.rows.length === 0 || stockResult.rows[0].stock < item.quantity) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: `Insufficient stock for product ${item.productId}` });
      }
    }

    const subtotal = cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    let discount = 0;

    if (discountCode) {
      const dcResult = await client.query(
        `SELECT * FROM discount_codes WHERE code = $1 AND is_active = true`,
        [discountCode.toUpperCase()]
      );
      if (dcResult.rows.length > 0) {
        const dc = dcResult.rows[0];
        discount = dc.type === 'percentage' ? subtotal * (parseFloat(dc.value) / 100) : parseFloat(dc.value);
        await client.query('UPDATE discount_codes SET used_count = used_count + 1 WHERE id = $1', [dc.id]);
      }
    }

    const total = Math.max(subtotal - discount, 0);

    const orderResult = await client.query(
      `INSERT INTO orders (user_id, session_id, total, subtotal, discount, status, payment_status, payment_method, address_id)
       VALUES ($1, $2, $3, $4, $5, 'confirmed', 'paid', $6, $7)
       RETURNING *`,
      [req.user.id, req.sessionId, total, subtotal, discount, paymentMethod, addressId]
    );
    const order = orderResult.rows[0];

    for (const item of cart.items) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)`,
        [order.id, item.productId, item.quantity, item.price]
      );
      await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [item.quantity, item.productId]);
      await client.query(
        `INSERT INTO inventory_log (product_id, change, reason) VALUES ($1, $2, 'sale')`,
        [item.productId, -item.quantity]
      );
    }

    await client.query(`UPDATE carts SET status = 'completed' WHERE session_id = $1 AND status = 'checkout'`, [
      req.sessionId,
    ]);

    await client.query('COMMIT');
    await clearCart(cartOwnerId(req));

    res.status(201).json({ order });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Confirm order error', err);
    res.status(500).json({ error: 'Failed to place order' });
  } finally {
    client.release();
  }
});

module.exports = router;