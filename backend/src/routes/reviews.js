const express = require('express');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/reviews/:productId
router.get('/:productId', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.id, r.rating, r.title, r.body, r.created_at, u.name AS user_name
       FROM reviews r JOIN users u ON u.id = r.user_id
       WHERE r.product_id = $1 ORDER BY r.created_at DESC`,
      [req.params.productId]
    );
    res.json({ reviews: result.rows });
  } catch (err) {
    console.error('List reviews error', err);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// POST /api/reviews/:productId
//
// NOTE: per ShopSmart spec Section 8, this route is the designated location
// for the intentional XSS vulnerability (unsanitized `body` rendered without
// escaping). This implementation stores the review as-is, which is
// correct — sanitization belongs on the frontend render layer, not here —
// but does NOT include any deliberate additional unsafe handling. The
// intentional vulnerability variant is toggled in during Week 6.
router.post('/:productId', authenticate, async (req, res) => {
  try {
    const { rating, title, body } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'rating must be between 1 and 5' });
    }

    const productCheck = await pool.query('SELECT id FROM products WHERE id = $1', [req.params.productId]);
    if (productCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const result = await pool.query(
      `INSERT INTO reviews (product_id, user_id, rating, title, body)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (product_id, user_id) DO UPDATE
         SET rating = EXCLUDED.rating, title = EXCLUDED.title, body = EXCLUDED.body
       RETURNING *`,
      [req.params.productId, req.user.id, rating, title || null, body || null]
    );

    // Recalculate product's aggregate rating
    const agg = await pool.query(
      `SELECT AVG(rating) AS avg_rating, COUNT(*) AS review_count FROM reviews WHERE product_id = $1`,
      [req.params.productId]
    );
    await pool.query('UPDATE products SET rating = $1, review_count = $2 WHERE id = $3', [
      parseFloat(agg.rows[0].avg_rating).toFixed(2),
      agg.rows[0].review_count,
      req.params.productId,
    ]);

    res.status(201).json({ review: result.rows[0] });
  } catch (err) {
    console.error('Create review error', err);
    res.status(500).json({ error: 'Failed to create review' });
  }
});

// DELETE /api/reviews/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM reviews WHERE id = $1 AND user_id = $2 RETURNING product_id', [
      req.params.id,
      req.user.id,
    ]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Review not found' });
    }

    const productId = result.rows[0].product_id;
    const agg = await pool.query(
      `SELECT COALESCE(AVG(rating), 0) AS avg_rating, COUNT(*) AS review_count FROM reviews WHERE product_id = $1`,
      [productId]
    );
    await pool.query('UPDATE products SET rating = $1, review_count = $2 WHERE id = $3', [
      parseFloat(agg.rows[0].avg_rating).toFixed(2),
      agg.rows[0].review_count,
      productId,
    ]);

    res.json({ message: 'Review deleted' });
  } catch (err) {
    console.error('Delete review error', err);
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

module.exports = router;