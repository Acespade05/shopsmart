// ShopSmart seed script
// Populates the product catalog (backend/seeds/catalog.json), admin user,
// discount codes, synthetic bot customer accounts, and progressive discount tiers.
//
// Safe to run more than once: every insert is an upsert keyed on a stable
// value (product slug, category slug, email, discount code), so re-running
// never creates duplicates.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../src/config/database');
const catalog = require('./catalog.json');

// Products from the original (pre-catalog) seed. They are deactivated — not
// deleted — when the new catalog is applied, so past orders that reference
// them stay intact. Products added by hand through the admin panel are left alone.
const LEGACY_PRODUCT_NAMES_BY_CATEGORY = {
  electronics: [
    'Wireless Bluetooth Earbuds', 'Smartphone 128GB', '27-inch 4K Monitor', 'Mechanical Keyboard',
    'Wireless Mouse', 'Portable Power Bank 20000mAh', 'Smart Watch Series 5', 'Noise Cancelling Headphones',
    'USB-C Hub 7-in-1', 'Bluetooth Speaker Waterproof', '1TB Portable SSD', 'Laptop Stand Aluminium',
  ],
  clothing: [
    "Men's Cotton T-Shirt", "Women's Denim Jacket", "Men's Slim Fit Jeans", "Women's Kurti Set",
    "Unisex Hoodie", "Men's Formal Shirt", "Women's Yoga Pants", "Kids' Graphic T-Shirt",
    "Men's Running Shorts", "Women's Cardigan",
  ],
  'home-kitchen': [
    'Non-Stick Frying Pan', 'Electric Kettle 1.5L', 'Air Fryer 4L', 'Stainless Steel Cookware Set',
    'Ceramic Dinner Set 16pc', 'Memory Foam Pillow', 'Cotton Bedsheet Set', 'LED Desk Lamp',
    'Vacuum Flask 1L', 'Kitchen Knife Set',
  ],
  books: [
    'Atomic Habits', 'The Silent Patient', 'Sapiens: A Brief History', 'Clean Code',
    'The Alchemist', 'Rich Dad Poor Dad', 'Deep Work', 'Ikigai',
    'The Psychology of Money', 'Zero to One',
  ],
  sports: [
    'Football Size 5', 'Yoga Mat 6mm', 'Adjustable Dumbbell Set', 'Cricket Bat Kashmir Willow',
    'Running Shoes', 'Resistance Bands Set', 'Badminton Racket Pair', 'Skipping Rope',
    'Cycling Helmet', 'Table Tennis Paddle Set',
  ],
};

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // --- Categories ---
    const categoryIds = {};
    for (const cat of catalog.categories) {
      const cover = catalog.products.find((p) => p.category === cat.slug)?.images?.[0] || null;
      const res = await client.query(
        `INSERT INTO categories (name, slug, description, image_url)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (slug) DO UPDATE
           SET name = EXCLUDED.name, description = EXCLUDED.description, image_url = EXCLUDED.image_url
         RETURNING id`,
        [cat.name, cat.slug, cat.description, cover]
      );
      categoryIds[cat.slug] = res.rows[0].id;
    }
    console.log(`Seeded ${catalog.categories.length} categories`);

    // --- Products ---
    // On re-run, descriptive fields are refreshed but stock is NOT reset,
    // so stock changes from real orders are preserved.
    for (const p of catalog.products) {
      await client.query(
        `INSERT INTO products
           (category_id, name, slug, description, price, original_price, stock, images,
            rating, review_count, is_active,
            brand, sku, subcategory, tags, specs, sizes, warranty, return_policy, shipping_info)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true,
                 $11, $12, $13, $14, $15, $16, $17, $18, $19)
         ON CONFLICT (slug) DO UPDATE SET
           category_id = EXCLUDED.category_id, name = EXCLUDED.name, description = EXCLUDED.description,
           price = EXCLUDED.price, original_price = EXCLUDED.original_price, images = EXCLUDED.images,
           rating = EXCLUDED.rating, review_count = EXCLUDED.review_count, is_active = true,
           brand = EXCLUDED.brand, sku = EXCLUDED.sku, subcategory = EXCLUDED.subcategory,
           tags = EXCLUDED.tags, specs = EXCLUDED.specs, sizes = EXCLUDED.sizes,
           warranty = EXCLUDED.warranty, return_policy = EXCLUDED.return_policy,
           shipping_info = EXCLUDED.shipping_info, updated_at = now()`,
        [
          categoryIds[p.category], p.name, p.slug, p.description, p.price, p.original_price,
          p.stock, p.images, p.rating, p.review_count,
          p.brand, p.sku, p.subcategory, p.tags, JSON.stringify(p.specs), p.sizes,
          p.warranty, p.return_policy, p.shipping_info,
        ]
      );
    }
    console.log(`Seeded ${catalog.products.length} products`);

    // Retire the old placeholder products (and any duplicates the old seed created).
    const legacyNames = Object.values(LEGACY_PRODUCT_NAMES_BY_CATEGORY).flat();
    const retired = await client.query(
      `UPDATE products SET is_active = false, updated_at = now()
       WHERE is_active = true AND name = ANY($1) AND NOT (slug = ANY($2))`,
      [legacyNames, catalog.products.map((p) => p.slug)]
    );
    if (retired.rowCount > 0) console.log(`Retired ${retired.rowCount} old placeholder products (kept for order history)`);

    // --- Admin user ---
    const adminPasswordHash = await bcrypt.hash('admin123', 10);
    await client.query(
      `INSERT INTO users (name, email, password, role)
       VALUES ($1, $2, $3, 'admin')
       ON CONFLICT (email) DO NOTHING`,
      ['Admin', 'admin@shopsmart.com', adminPasswordHash]
    );
    console.log('Seeded admin user (admin@shopsmart.com / admin123)');

    // --- Synthetic bot customer accounts ---
    // Clearly tagged via email domain so bot-driven orders can be filtered
    // out of (or studied separately from) real business metrics.
    const botPasswordHash = await bcrypt.hash('synthetic-bot-account', 10);
    const botNames = ['Bot Shopper One', 'Bot Shopper Two', 'Bot Shopper Three', 'Bot Shopper Four', 'Bot Shopper Five'];
    const botAddresses = [
      { city: 'Mumbai', state: 'Maharashtra', pincode: '400001' },
      { city: 'Bengaluru', state: 'Karnataka', pincode: '560001' },
      { city: 'Delhi', state: 'Delhi', pincode: '110001' },
      { city: 'Pune', state: 'Maharashtra', pincode: '411001' },
      { city: 'Chennai', state: 'Tamil Nadu', pincode: '600001' },
    ];

    for (let i = 0; i < botNames.length; i++) {
      const email = `bot${i + 1}@shopsmart-synthetic.internal`;
      const userRes = await client.query(
        `INSERT INTO users (name, email, password, role)
         VALUES ($1, $2, $3, 'customer')
         ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [botNames[i], email, botPasswordHash]
      );
      const userId = userRes.rows[0].id;

      const addr = botAddresses[i];
      const existingAddr = await client.query('SELECT id FROM addresses WHERE user_id = $1', [userId]);
      if (existingAddr.rows.length === 0) {
        await client.query(
          `INSERT INTO addresses (user_id, name, phone, line1, city, state, pincode, is_default)
           VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
          [userId, botNames[i], '9999999999', 'Synthetic Traffic Address', addr.city, addr.state, addr.pincode]
        );
      }
    }
    console.log(`Seeded ${botNames.length} synthetic bot customer accounts with default addresses`);

    // --- Discount codes (manual, user-entered) ---
    const discountCodes = [
      { code: 'WELCOME10', type: 'percentage', value: 10, min_order_value: 0 },
      { code: 'FLAT200', type: 'fixed', value: 200, min_order_value: 999 },
      { code: 'SALE50', type: 'percentage', value: 50, min_order_value: 2000 },
    ];
    for (const dc of discountCodes) {
      await client.query(
        `INSERT INTO discount_codes (code, type, value, min_order_value, max_uses, is_active)
         VALUES ($1, $2, $3, $4, $5, true)
         ON CONFLICT (code) DO NOTHING`,
        [dc.code, dc.type, dc.value, dc.min_order_value, 1000]
      );
    }
    console.log(`Seeded ${discountCodes.length} manual discount codes`);

    // --- Progressive discount tiers (automatic, Zepto/Zomato-style) ---
    // Prefixed "TIER" so the backend can identify and auto-apply the best
    // matching one without the customer typing a code. Not shown in any
    // manual "enter code" UI.
    const tierCodes = [
      { code: 'TIER500', type: 'percentage', value: 5, min_order_value: 500 },
      { code: 'TIER1000', type: 'percentage', value: 10, min_order_value: 1000 },
      { code: 'TIER2000', type: 'percentage', value: 15, min_order_value: 2000 },
    ];
    for (const tc of tierCodes) {
      await client.query(
        `INSERT INTO discount_codes (code, type, value, min_order_value, max_uses, is_active)
         VALUES ($1, $2, $3, $4, $5, true)
         ON CONFLICT (code) DO NOTHING`,
        [tc.code, tc.type, tc.value, tc.min_order_value, null]
      );
    }
    console.log(`Seeded ${tierCodes.length} automatic progressive discount tiers`);

    await client.query('COMMIT');
    console.log('Seed complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();