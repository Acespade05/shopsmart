const express = require('express');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { getCart, saveCart, clearCart } = require('../services/cacheService');
const { processPayment } = require('../services/paymentService');

const router = express.Router();

function cartOwnerId(req) {
  return req.user?.id ? `user:${req.user.id}` : `session:${req.sessionId}`;
}

async function findBestTierDiscount(subtotal) {
  const result = await pool.query(
    `SELECT code, type, value FROM discount_codes
     WHERE code LIKE 'TIER%' AND is_active = true AND min_order_value <= $1
     ORDER BY value DESC LIMIT 1`,
    [subtotal]
  );
  return result.rows[0] || null;
}

// GET /api/checkout/tiers — PUBLIC, no auth. Must be registered before any
// router.use(authenticate) call below, so it's never gated behind a token.
router.get('/tiers', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT code, value, min_order_value FROM discount_codes
       WHERE code LIKE 'TIER%' AND is_active = true
       ORDER BY min_order_value ASC`
    );
    res.json({
      tiers: result.rows.map((r) => ({
        code: r.code,
        discountPercent: parseFloat(r.value),
        minOrderValue: parseFloat(r.min_order_value),
      })),
    });
  } catch (err) {
    console.error('Get tiers error', err);
    res.status(500).json({ error: 'Failed to fetch discount tiers' });
  }
});

// GET /api/checkout/offers — PUBLIC. Manual coupon codes shoppers can enter.
router.get('/offers', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT code, type, value, min_order_value FROM discount_codes
       WHERE code NOT LIKE 'TIER%' AND is_active = true
         AND (max_uses IS NULL OR used_count < max_uses)
       ORDER BY min_order_value ASC`
    );
    res.json({
      offers: result.rows.map((r) => ({
        code: r.code,
        type: r.type,
        value: parseFloat(r.value),
        minOrderValue: parseFloat(r.min_order_value),
      })),
    });
  } catch (err) {
    console.error('Get offers error', err);
    res.status(500).json({ error: 'Failed to fetch offers' });
  }
});

// --- everything below this line requires authentication ---
router.use(authenticate);

// POST /api/checkout/start — validate cart, mark checkout intent
router.post('/start', async (req, res) => {
  try {
    const cart = await getCart(cartOwnerId(req));
    if (!cart.items || cart.items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    const subtotal = cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const autoTier = await findBestTierDiscount(subtotal);

    // Record that this session is in checkout. /api/metrics/active-checkouts
    // reads this table; confirm marks it 'completed', the warehouse job marks
    // stale ones 'abandoned'.
    if (req.sessionId) {
      const updated = await pool.query(
        `UPDATE carts SET status = 'checkout', user_id = $2, updated_at = now()
         WHERE session_id = $1 AND status IN ('active', 'checkout')`,
        [req.sessionId, req.user.id]
      );
      if (updated.rowCount === 0) {
        await pool.query(
          `INSERT INTO carts (session_id, user_id, status) VALUES ($1, $2, 'checkout')`,
          [req.sessionId, req.user.id]
        );
      }
    }

    res.json({
      cart,
      subtotal: parseFloat(subtotal.toFixed(2)),
      autoTier: autoTier
        ? { code: autoTier.code, discountPercent: parseFloat(autoTier.value) }
        : null,
    });
  } catch (err) {
    console.error('Checkout start error', err);
    res.status(500).json({ error: 'Failed to start checkout' });
  }
});

// POST /api/checkout/apply-coupon
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

    let bestCode = discount;
    let discountAmount =
      discount.type === 'percentage'
        ? subtotal * (parseFloat(discount.value) / 100)
        : parseFloat(discount.value);

    const autoTier = await findBestTierDiscount(subtotal);
    if (autoTier) {
      const tierAmount = subtotal * (parseFloat(autoTier.value) / 100);
      if (tierAmount > discountAmount) {
        bestCode = autoTier;
        discountAmount = tierAmount;
      }
    }

    const total = Math.max(subtotal - discountAmount, 0);

    res.json({
      code: bestCode.code,
      subtotal: parseFloat(subtotal.toFixed(2)),
      discount: parseFloat(discountAmount.toFixed(2)),
      total: parseFloat(total.toFixed(2)),
    });
  } catch (err) {
    console.error('Apply coupon error', err);
    res.status(500).json({ error: 'Failed to apply coupon' });
  }
});

// POST /api/checkout/payment
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

// POST /api/checkout/confirm
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

    // Total quantity per product (the same product can be in the cart in several sizes).
    const qtyByProduct = {};
    for (const item of cart.items) {
      qtyByProduct[item.productId] = (qtyByProduct[item.productId] || 0) + item.quantity;
    }
    for (const [productId, qty] of Object.entries(qtyByProduct)) {
      const stockResult = await client.query('SELECT stock FROM products WHERE id = $1 FOR UPDATE', [productId]);
      if (stockResult.rows.length === 0 || stockResult.rows[0].stock < qty) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: `Insufficient stock for product ${productId}` });
      }
    }

    const subtotal = cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0);

    let manualDiscount = 0;
    let manualCode = null;
    if (discountCode) {
      const dcResult = await client.query(
        `SELECT * FROM discount_codes WHERE code = $1 AND is_active = true`,
        [discountCode.toUpperCase()]
      );
      if (dcResult.rows.length > 0) {
        manualCode = dcResult.rows[0];
        manualDiscount =
          manualCode.type === 'percentage'
            ? subtotal * (parseFloat(manualCode.value) / 100)
            : parseFloat(manualCode.value);
      }
    }

    const autoTierResult = await client.query(
      `SELECT * FROM discount_codes
       WHERE code LIKE 'TIER%' AND is_active = true AND min_order_value <= $1
       ORDER BY value DESC LIMIT 1`,
      [subtotal]
    );
    let autoDiscount = 0;
    let autoCode = null;
    if (autoTierResult.rows.length > 0) {
      autoCode = autoTierResult.rows[0];
      autoDiscount = subtotal * (parseFloat(autoCode.value) / 100);
    }

    let discount = 0;
    let appliedCodeId = null;
    if (manualDiscount >= autoDiscount && manualCode) {
      discount = manualDiscount;
      appliedCodeId = manualCode.id;
    } else if (autoCode) {
      discount = autoDiscount;
      appliedCodeId = autoCode.id;
    }

    if (appliedCodeId) {
      await client.query('UPDATE discount_codes SET used_count = used_count + 1 WHERE id = $1', [appliedCodeId]);
    }

    const total = Math.max(subtotal - discount, 0);

    const orderResult = await client.query(
      `INSERT INTO orders (user_id, session_id, total, subtotal, discount, status, payment_status, payment_method, address_id)
       VALUES ($1, $2, $3, $4, $5, 'confirmed', 'paid', $6, $7)
       RETURNING *`,
      [req.user.id, req.sessionId, total, subtotal, discount, paymentMethod, addressId]
    );
    const order = orderResult.rows[0];
    await client.query(`INSERT INTO order_status_history (order_id, status) VALUES ($1, 'confirmed')`, [order.id]);

    for (const item of cart.items) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price, size) VALUES ($1, $2, $3, $4, $5)`,
        [order.id, item.productId, item.quantity, item.price, item.size || null]
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