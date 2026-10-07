const express = require('express');
const pool = require('../config/database');
const { applySale } = require('../services/pricing');

const router = express.Router();

// GET /api/products — list with filters + pagination
router.get('/', async (req, res) => {
  try {
    const {
      category, minPrice, maxPrice, minRating, inStock, brand, subcategory, minDiscount,
      sort = 'newest', page = 1, limit = 20,
    } = req.query;

    const conditions = ['is_active = true'];
    const values = [];

    if (category) {
      values.push(category);
      conditions.push(`category_id = (SELECT id FROM categories WHERE slug = $${values.length})`);
    }
    if (minPrice) {
      values.push(minPrice);
      conditions.push(`price >= $${values.length}`);
    }
    if (maxPrice) {
      values.push(maxPrice);
      conditions.push(`price <= $${values.length}`);
    }
    if (minRating) {
      values.push(minRating);
      conditions.push(`rating >= $${values.length}`);
    }
    if (inStock === 'true') {
      conditions.push('stock > 0');
    }
    if (brand) {
      values.push(brand);
      conditions.push(`brand = $${values.length}`);
    }
    if (subcategory) {
      values.push(subcategory);
      conditions.push(`subcategory = $${values.length}`);
    }
    if (minDiscount) {
      // percent off MRP, e.g. minDiscount=20 → at least 20% off
      values.push(parseFloat(minDiscount) / 100);
      conditions.push(`original_price > 0 AND (1 - price / original_price) >= $${values.length}`);
    }

    const sortMap = {
      newest: 'created_at DESC',
      price_asc: 'price ASC',
      price_desc: 'price DESC',
      rating: 'rating DESC',
      popular: 'review_count DESC',
      discount: 'COALESCE(1 - price / NULLIF(original_price, 0), 0) DESC',
    };
    const orderBy = sortMap[sort] || sortMap.newest;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const offset = (pageNum - 1) * limitNum;

    values.push(limitNum, offset);

    const query = `
      SELECT id, name, slug, price, original_price, stock, images, rating, review_count,
             brand, subcategory, sizes,
             (SELECT c.slug FROM categories c WHERE c.id = products.category_id) AS category_slug
      FROM products
      WHERE ${conditions.join(' AND ')}
      ORDER BY ${orderBy}
      LIMIT $${values.length - 1} OFFSET $${values.length}
    `;

    const result = await pool.query(query, values);

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM products WHERE ${conditions.join(' AND ')}`,
      values.slice(0, values.length - 2)
    );

    res.json({
      products: await applySale(result.rows),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: parseInt(countResult.rows[0].count, 10),
      },
    });
  } catch (err) {
    console.error('List products error', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// GET /api/products/search?q=
// NOTE: this route is the designated location for the intentional SQL
// injection vulnerability (per ShopSmart spec Section 8). Implemented safely
// here with a parameterized query; the vulnerable version gets swapped in
// during Week 6's deliberate vulnerability injection, not before.
router.get('/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) {
      return res.json({ products: [] });
    }

    const result = await pool.query(
      `SELECT id, name, slug, price, images, rating
       FROM products
       WHERE is_active = true AND name ILIKE $1
       ORDER BY rating DESC
       LIMIT 50`,
      [`%${q}%`]
    );

    // Sale prices are applied after the query, so the query itself stays as it is.
    res.json({ products: await applySale(result.rows), count: result.rows.length });
  } catch (err) {
    console.error('Search error', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// GET /api/products/facets?category=&subcategory= — filter options for the Shop page
router.get('/facets', async (req, res) => {
  try {
    const conditions = ['is_active = true'];
    const values = [];
    if (req.query.category) {
      values.push(req.query.category);
      conditions.push(`category_id = (SELECT id FROM categories WHERE slug = $${values.length})`);
    }
    if (req.query.subcategory) {
      values.push(req.query.subcategory);
      conditions.push(`subcategory = $${values.length}`);
    }
    const where = conditions.join(' AND ');
    const brands = await pool.query(
      `SELECT brand, COUNT(*)::int AS count FROM products
       WHERE ${where} AND brand IS NOT NULL
       GROUP BY brand ORDER BY count DESC, brand ASC`,
      values
    );
    const range = await pool.query(`SELECT MIN(price) AS min, MAX(price) AS max FROM products WHERE ${where}`, values);
    res.json({
      brands: brands.rows,
      price: { min: parseFloat(range.rows[0].min) || 0, max: parseFloat(range.rows[0].max) || 0 },
    });
  } catch (err) {
    console.error('Facets error', err);
    res.status(500).json({ error: 'Failed to fetch filters' });
  }
});

// GET /api/products/:slug — detail + reviews
router.get('/:slug', async (req, res) => {
  try {
    const productResult = await pool.query(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.slug = $1 AND p.is_active = true`,
      [req.params.slug]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const [product] = await applySale(productResult.rows);

    const reviewsResult = await pool.query(
      `SELECT r.id, r.rating, r.title, r.body, r.created_at, u.name AS user_name
       FROM reviews r
       JOIN users u ON u.id = r.user_id
       WHERE r.product_id = $1
       ORDER BY r.created_at DESC
       LIMIT 20`,
      [product.id]
    );

    const relatedResult = await pool.query(
      `SELECT id, name, slug, price, original_price, stock, images, rating, review_count, brand, sizes
       FROM products
       WHERE category_id = $1 AND id != $2 AND is_active = true
       ORDER BY (subcategory IS NOT DISTINCT FROM $3) DESC, rating DESC
       LIMIT 12`,
      [product.category_id, product.id, product.subcategory]
    );

    res.json({ product, reviews: reviewsResult.rows, related: await applySale(relatedResult.rows) });
  } catch (err) {
    console.error('Get product error', err);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

module.exports = router;
