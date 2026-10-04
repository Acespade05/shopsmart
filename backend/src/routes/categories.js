const express = require('express');
const pool = require('../config/database');

const router = express.Router();

// GET /api/categories — list all with product count
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.id, c.name, c.slug, c.description, c.image_url,
             COUNT(p.id) FILTER (WHERE p.is_active = true) AS product_count,
             COALESCE(
               ARRAY_AGG(DISTINCT p.subcategory) FILTER (WHERE p.is_active = true AND p.subcategory IS NOT NULL),
               '{}'
             ) AS subcategories
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id
      GROUP BY c.id
      ORDER BY c.name
    `);
    res.json({ categories: result.rows });
  } catch (err) {
    console.error('List categories error', err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// GET /api/categories/:slug — products in a category
router.get('/:slug', async (req, res) => {
  try {
    const categoryResult = await pool.query('SELECT * FROM categories WHERE slug = $1', [req.params.slug]);
    if (categoryResult.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    const category = categoryResult.rows[0];

    const productsResult = await pool.query(
      `SELECT id, name, slug, price, original_price, stock, images, rating, review_count,
              brand, subcategory
       FROM products
       WHERE category_id = $1 AND is_active = true
       ORDER BY created_at DESC`,
      [category.id]
    );

    res.json({ category, products: productsResult.rows });
  } catch (err) {
    console.error('Get category error', err);
    res.status(500).json({ error: 'Failed to fetch category' });
  }
});

module.exports = router;
