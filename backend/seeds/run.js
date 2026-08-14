// ShopSmart seed script
// Populates 5 categories, 50 products, admin user, discount codes,
// synthetic bot customer accounts, and progressive discount tiers.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../src/config/database');

const categories = [
  { name: 'Electronics', slug: 'electronics', description: 'Phones, laptops, gadgets and accessories.' },
  { name: 'Clothing', slug: 'clothing', description: 'Apparel for men, women, and kids.' },
  { name: 'Home & Kitchen', slug: 'home-kitchen', description: 'Everything for your home and kitchen.' },
  { name: 'Books', slug: 'books', description: 'Fiction, non-fiction, and academic books.' },
  { name: 'Sports', slug: 'sports', description: 'Sports gear, fitness equipment, and outdoor kit.' },
];

const productNamesByCategory = {
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

function slugify(text) {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function randomPrice(min, max) {
  return (Math.random() * (max - min) + min).toFixed(2);
}

function placeholderImage(productName, categorySlug) {
  const colorByCategory = {
    electronics: '0B6E4F/FAFAF7',
    clothing: 'C08A2E/FAFAF7',
    'home-kitchen': 'E8604C/FAFAF7',
    books: '171512/FAFAF7',
    sports: '08543C/FAFAF7',
  };
  const colors = colorByCategory[categorySlug] || '0B6E4F/FAFAF7';
  const text = encodeURIComponent(productName);
  return `https://placehold.co/500x500/${colors}?text=${text}&font=roboto`;
}

function realProductImage(productName, categorySlug) {
  return placeholderImage(productName, categorySlug);
}

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // --- Categories ---
    const categoryIds = {};
    for (const cat of categories) {
      const res = await client.query(
        `INSERT INTO categories (name, slug, description)
         VALUES ($1, $2, $3)
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
         RETURNING id, slug`,
        [cat.name, cat.slug, cat.description]
      );
      categoryIds[res.rows[0].slug] = res.rows[0].id;
    }
    console.log(`Seeded ${categories.length} categories`);

    // --- Products ---
    let productCount = 0;
    for (const [slug, names] of Object.entries(productNamesByCategory)) {
      const categoryId = categoryIds[slug];
      for (const name of names) {
        const productSlug = slugify(name) + '-' + Math.random().toString(36).slice(2, 6);
        const price = randomPrice(299, 24999);
        const hasDiscount = Math.random() > 0.5;
        const originalPrice = hasDiscount ? (parseFloat(price) * 1.2).toFixed(2) : null;
        const stock = Math.floor(Math.random() * 200) + 5;
        const rating = (Math.random() * 2 + 3).toFixed(2);
        const reviewCount = Math.floor(Math.random() * 300);

        await client.query(
          `INSERT INTO products
             (category_id, name, slug, description, price, original_price, stock, images, rating, review_count, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
           ON CONFLICT (slug) DO NOTHING`,
          [
            categoryId,
            name,
            productSlug,
            `${name} — quality product from our ${slug.replace('-', ' & ')} collection.`,
            price,
            originalPrice,
            stock,
            [realProductImage(name, slug)],
            rating,
            reviewCount,
          ]
        );
        productCount++;
      }
    }
    console.log(`Seeded ${productCount} products`);

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