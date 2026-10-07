const express = require('express');
const pool = require('../config/database');
const { applySale } = require('../services/pricing');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/wishlist
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT w.id AS wishlist_id, p.id, p.name, p.slug, p.price, p.images, p.stock
       FROM wishlist w JOIN products p ON p.id = w.product_id
       WHERE w.user_id = $1 ORDER BY w.created_at DESC`,
      [req.user.id]
    );
    res.json({ wishlist: await applySale(result.rows) });
  } catch (err) {
    console.error('Get wishlist error', err);
    res.status(500).json({ error: 'Failed to fetch wishlist' });
  }
});

// POST /api/wishlist/:productId
router.post('/:productId', async (req, res) => {
  try {
    const result = await pool.query(
      `INSERT INTO wishlist (user_id, product_id) VALUES ($1, $2)
       ON CONFLICT (user_id, product_id) DO NOTHING RETURNING *`,
      [req.user.id, req.params.productId]
    );
    res.status(201).json({ added: result.rows.length > 0 });
  } catch (err) {
    console.error('Add to wishlist error', err);
    res.status(500).json({ error: 'Failed to add to wishlist' });
  }
});

// DELETE /api/wishlist/:productId
router.delete('/:productId', async (req, res) => {
  try {
    await pool.query('DELETE FROM wishlist WHERE user_id = $1 AND product_id = $2', [
      req.user.id,
      req.params.productId,
    ]);
    res.json({ message: 'Removed from wishlist' });
  } catch (err) {
    console.error('Remove from wishlist error', err);
    res.status(500).json({ error: 'Failed to remove from wishlist' });
  }
});

module.exports = router;