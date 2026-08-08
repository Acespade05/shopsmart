const express = require('express');
const pool = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// NOTE: per ShopSmart spec Section 8, GET /api/admin/dashboard is the
// designated location for the intentional "broken access control"
// vulnerability (missing auth middleware). This implementation correctly
// requires admin auth — the vulnerable version is swapped in during Week 6's
// deliberate vulnerability injection, not left in by accident here.
router.use(authenticate, requireAdmin);

// GET /api/admin/dashboard — summary stats
router.get('/dashboard', async (req, res) => {
  try {
    const [revenue, orders, sessions, topProducts] = await Promise.all([
      pool.query(
        `SELECT COALESCE(SUM(total), 0) AS revenue FROM orders
         WHERE created_at::date = CURRENT_DATE AND payment_status = 'paid'`
      ),
      pool.query(`SELECT COUNT(*) FROM orders WHERE created_at::date = CURRENT_DATE`),
      pool.query(`SELECT COUNT(*) FROM sessions WHERE last_active > now() - INTERVAL '5 minutes'`),
      pool.query(`
        SELECT p.id, p.name, COUNT(oi.id) AS units_sold
        FROM order_items oi
        JOIN products p ON p.id = oi.product_id
        JOIN orders o ON o.id = oi.order_id
        WHERE o.payment_status = 'paid'
        GROUP BY p.id, p.name
        ORDER BY units_sold DESC
        LIMIT 5
      `),
    ]);

    res.json({
      revenueToday: parseFloat(revenue.rows[0].revenue).toFixed(2),
      ordersToday: parseInt(orders.rows[0].count, 10),
      activeSessions: parseInt(sessions.rows[0].count, 10),
      topProducts: topProducts.rows,
    });
  } catch (err) {
    console.error('Admin dashboard error', err);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// GET /api/admin/products
router.get('/products', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY id DESC');
    res.json({ products: result.rows });
  } catch (err) {
    console.error('Admin list products error', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// POST /api/admin/products
router.post('/products', async (req, res) => {
  try {
    const { categoryId, name, slug, description, price, originalPrice, stock, images } = req.body;
    if (!name || !slug || !price) {
      return res.status(400).json({ error: 'name, slug, and price are required' });
    }

    const result = await pool.query(
      `INSERT INTO products (category_id, name, slug, description, price, original_price, stock, images)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [categoryId, name, slug, description, price, originalPrice || null, stock || 0, images || []]
    );
    res.status(201).json({ product: result.rows[0] });
  } catch (err) {
    console.error('Create product error', err);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// PUT /api/admin/products/:id
router.put('/products/:id', async (req, res) => {
  try {
    const { name, price, originalPrice, stock, description, categoryId, isActive } = req.body;
    const result = await pool.query(
      `UPDATE products SET
         name = COALESCE($1, name), price = COALESCE($2, price),
         original_price = $3, stock = COALESCE($4, stock),
         description = COALESCE($5, description), category_id = COALESCE($6, category_id),
         is_active = COALESCE($7, is_active)
       WHERE id = $8 RETURNING *`,
      [name, price, originalPrice, stock, description, categoryId, isActive, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json({ product: result.rows[0] });
  } catch (err) {
    console.error('Update product error', err);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// DELETE /api/admin/products/:id
router.delete('/products/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product deleted' });
  } catch (err) {
    console.error('Delete product error', err);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// GET /api/admin/orders
router.get('/orders', async (req, res) => {
  try {
    const { status } = req.query;
    const conditions = [];
    const values = [];
    if (status) {
      values.push(status);
      conditions.push(`o.status = $${values.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT o.*, u.name AS customer_name, u.email AS customer_email
       FROM orders o JOIN users u ON u.id = o.user_id
       ${where}
       ORDER BY o.created_at DESC`,
      values
    );
    res.json({ orders: result.rows });
  } catch (err) {
    console.error('Admin list orders error', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// PUT /api/admin/orders/:id/status
router.put('/orders/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const valid = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
    if (!valid.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${valid.join(', ')}` });
    }
    const result = await pool.query('UPDATE orders SET status = $1 WHERE id = $2 RETURNING *', [
      status,
      req.params.id,
    ]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    res.json({ order: result.rows[0] });
  } catch (err) {
    console.error('Update order status error', err);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, phone, is_blocked, created_at FROM users ORDER BY created_at DESC'
    );
    res.json({ users: result.rows });
  } catch (err) {
    console.error('Admin list users error', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// PUT /api/admin/users/:id/block
router.put('/users/:id/block', async (req, res) => {
  try {
    const { blocked } = req.body;
    const result = await pool.query(
      'UPDATE users SET is_blocked = $1 WHERE id = $2 RETURNING id, name, email, is_blocked',
      [!!blocked, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Block user error', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// GET /api/admin/inventory
router.get('/inventory', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, sku, stock,
              CASE WHEN stock < 10 THEN true ELSE false END AS low_stock
       FROM (SELECT id, name, slug AS sku, stock FROM products) sub
       ORDER BY stock ASC`
    );
    res.json({ inventory: result.rows });
  } catch (err) {
    console.error('Inventory error', err);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

// PUT /api/admin/inventory/:id
router.put('/inventory/:id', async (req, res) => {
  try {
    const { stock, reason } = req.body;
    if (stock === undefined) {
      return res.status(400).json({ error: 'stock is required' });
    }

    const current = await pool.query('SELECT stock FROM products WHERE id = $1', [req.params.id]);
    if (current.rows.length === 0) return res.status(404).json({ error: 'Product not found' });

    const change = stock - current.rows[0].stock;

    const result = await pool.query('UPDATE products SET stock = $1 WHERE id = $2 RETURNING *', [
      stock,
      req.params.id,
    ]);

    await pool.query('INSERT INTO inventory_log (product_id, change, reason) VALUES ($1, $2, $3)', [
      req.params.id,
      change,
      reason || 'adjustment',
    ]);

    res.json({ product: result.rows[0] });
  } catch (err) {
    console.error('Update inventory error', err);
    res.status(500).json({ error: 'Failed to update inventory' });
  }
});

// GET /api/admin/analytics
router.get('/analytics', async (req, res) => {
  try {
    const revenueByDay = await pool.query(`
      SELECT created_at::date AS day, SUM(total) AS revenue
      FROM orders WHERE payment_status = 'paid' AND created_at > now() - INTERVAL '30 days'
      GROUP BY day ORDER BY day
    `);
    const topProducts = await pool.query(`
      SELECT p.name, COUNT(oi.id) AS units_sold, SUM(oi.price * oi.quantity) AS revenue
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      JOIN orders o ON o.id = oi.order_id
      WHERE o.payment_status = 'paid'
      GROUP BY p.name ORDER BY revenue DESC LIMIT 10
    `);

    res.json({
      revenueByDay: revenueByDay.rows,
      topProducts: topProducts.rows,
    });
  } catch (err) {
    console.error('Analytics error', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// GET /api/admin/discount-codes
router.get('/discount-codes', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM discount_codes ORDER BY id DESC');
    res.json({ discountCodes: result.rows });
  } catch (err) {
    console.error('List discount codes error', err);
    res.status(500).json({ error: 'Failed to fetch discount codes' });
  }
});

// POST /api/admin/discount-codes
router.post('/discount-codes', async (req, res) => {
  try {
    const { code, type, value, minOrderValue, maxUses, expiresAt } = req.body;
    if (!code || !type || value === undefined) {
      return res.status(400).json({ error: 'code, type, and value are required' });
    }

    const result = await pool.query(
      `INSERT INTO discount_codes (code, type, value, min_order_value, max_uses, expires_at, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING *`,
      [code.toUpperCase(), type, value, minOrderValue || 0, maxUses || null, expiresAt || null]
    );
    res.status(201).json({ discountCode: result.rows[0] });
  } catch (err) {
    console.error('Create discount code error', err);
    res.status(500).json({ error: 'Failed to create discount code' });
  }
});

module.exports = router;