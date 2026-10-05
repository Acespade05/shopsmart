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

// Synthetic shoppers for the traffic generator (fictional people, tagged email domain).
const SYNTHETIC_CUSTOMERS = [
  { name: 'Aarav Sharma', email: 'aarav.sharma@shopsmart-synthetic.internal', phone: '9000012345', line1: '1, MG Road', city: 'Mumbai', state: 'Maharashtra', pincode: '400050' },
  { name: 'Priya Iyer', email: 'priya.iyer@shopsmart-synthetic.internal', phone: '9000020264', line1: '38, Station Road', city: 'Chennai', state: 'Tamil Nadu', pincode: '600020' },
  { name: 'Rohan Mehta', email: 'rohan.mehta@shopsmart-synthetic.internal', phone: '9000028183', line1: '75, Park Street', city: 'Pune', state: 'Maharashtra', pincode: '411004' },
  { name: 'Ananya Reddy', email: 'ananya.reddy@shopsmart-synthetic.internal', phone: '9000036102', line1: '112, Main Road', city: 'Hyderabad', state: 'Telangana', pincode: '500034' },
  { name: 'Vikram Singh', email: 'vikram.singh@shopsmart-synthetic.internal', phone: '9000044021', line1: '149, Link Road', city: 'Delhi', state: 'Delhi', pincode: '110017' },
  { name: 'Sneha Kulkarni', email: 'sneha.kulkarni@shopsmart-synthetic.internal', phone: '9000051940', line1: '186, MG Road', city: 'Pune', state: 'Maharashtra', pincode: '411038' },
  { name: 'Arjun Nair', email: 'arjun.nair@shopsmart-synthetic.internal', phone: '9000059859', line1: '23, Station Road', city: 'Kochi', state: 'Kerala', pincode: '682020' },
  { name: 'Kavya Rao', email: 'kavya.rao@shopsmart-synthetic.internal', phone: '9000067778', line1: '60, Park Street', city: 'Bengaluru', state: 'Karnataka', pincode: '560038' },
  { name: 'Aditya Joshi', email: 'aditya.joshi@shopsmart-synthetic.internal', phone: '9000075697', line1: '97, Main Road', city: 'Mumbai', state: 'Maharashtra', pincode: '400076' },
  { name: 'Ishita Banerjee', email: 'ishita.banerjee@shopsmart-synthetic.internal', phone: '9000083616', line1: '134, Link Road', city: 'Kolkata', state: 'West Bengal', pincode: '700019' },
  { name: 'Rahul Verma', email: 'rahul.verma@shopsmart-synthetic.internal', phone: '9000091535', line1: '171, MG Road', city: 'Lucknow', state: 'Uttar Pradesh', pincode: '226010' },
  { name: 'Meera Pillai', email: 'meera.pillai@shopsmart-synthetic.internal', phone: '9000099454', line1: '8, Station Road', city: 'Thiruvananthapuram', state: 'Kerala', pincode: '695010' },
  { name: 'Karan Malhotra', email: 'karan.malhotra@shopsmart-synthetic.internal', phone: '9000107373', line1: '45, Park Street', city: 'Gurugram', state: 'Haryana', pincode: '122002' },
  { name: 'Pooja Desai', email: 'pooja.desai@shopsmart-synthetic.internal', phone: '9000115292', line1: '82, Main Road', city: 'Ahmedabad', state: 'Gujarat', pincode: '380015' },
  { name: 'Siddharth Gupta', email: 'siddharth.gupta@shopsmart-synthetic.internal', phone: '9000123211', line1: '119, Link Road', city: 'Noida', state: 'Uttar Pradesh', pincode: '201301' },
  { name: 'Nikita Shah', email: 'nikita.shah@shopsmart-synthetic.internal', phone: '9000131130', line1: '156, MG Road', city: 'Surat', state: 'Gujarat', pincode: '395007' },
  { name: 'Aniket Patil', email: 'aniket.patil@shopsmart-synthetic.internal', phone: '9000139049', line1: '193, Station Road', city: 'Nashik', state: 'Maharashtra', pincode: '422005' },
  { name: 'Divya Menon', email: 'divya.menon@shopsmart-synthetic.internal', phone: '9000146968', line1: '30, Park Street', city: 'Bengaluru', state: 'Karnataka', pincode: '560102' },
  { name: 'Harsh Agarwal', email: 'harsh.agarwal@shopsmart-synthetic.internal', phone: '9000154887', line1: '67, Main Road', city: 'Jaipur', state: 'Rajasthan', pincode: '302017' },
  { name: 'Riya Chatterjee', email: 'riya.chatterjee@shopsmart-synthetic.internal', phone: '9000162806', line1: '104, Link Road', city: 'Kolkata', state: 'West Bengal', pincode: '700091' },
  { name: 'Manish Yadav', email: 'manish.yadav@shopsmart-synthetic.internal', phone: '9000170725', line1: '141, MG Road', city: 'Patna', state: 'Bihar', pincode: '800001' },
  { name: 'Shruti Bhat', email: 'shruti.bhat@shopsmart-synthetic.internal', phone: '9000178644', line1: '178, Station Road', city: 'Mangaluru', state: 'Karnataka', pincode: '575003' },
  { name: 'Kunal Kapoor', email: 'kunal.kapoor@shopsmart-synthetic.internal', phone: '9000186563', line1: '15, Park Street', city: 'Chandigarh', state: 'Chandigarh', pincode: '160017' },
  { name: 'Tanvi Jain', email: 'tanvi.jain@shopsmart-synthetic.internal', phone: '9000194482', line1: '52, Main Road', city: 'Indore', state: 'Madhya Pradesh', pincode: '452010' },
  { name: 'Varun Krishnan', email: 'varun.krishnan@shopsmart-synthetic.internal', phone: '9000202401', line1: '89, Link Road', city: 'Chennai', state: 'Tamil Nadu', pincode: '600041' },
  { name: 'Neha Saxena', email: 'neha.saxena@shopsmart-synthetic.internal', phone: '9000210320', line1: '126, MG Road', city: 'Bhopal', state: 'Madhya Pradesh', pincode: '462016' },
  { name: 'Abhishek Das', email: 'abhishek.das@shopsmart-synthetic.internal', phone: '9000218239', line1: '163, Station Road', city: 'Bhubaneswar', state: 'Odisha', pincode: '751007' },
  { name: 'Swati Mishra', email: 'swati.mishra@shopsmart-synthetic.internal', phone: '9000226158', line1: '200, Park Street', city: 'Varanasi', state: 'Uttar Pradesh', pincode: '221005' },
  { name: 'Yash Thakur', email: 'yash.thakur@shopsmart-synthetic.internal', phone: '9000234077', line1: '37, Main Road', city: 'Mumbai', state: 'Maharashtra', pincode: '400092' },
  { name: 'Aishwarya Gowda', email: 'aishwarya.gowda@shopsmart-synthetic.internal', phone: '9000241996', line1: '74, Link Road', city: 'Mysuru', state: 'Karnataka', pincode: '570009' },
  { name: 'Rajat Sinha', email: 'rajat.sinha@shopsmart-synthetic.internal', phone: '9000249915', line1: '111, MG Road', city: 'Ranchi', state: 'Jharkhand', pincode: '834001' },
  { name: 'Lavanya Subramanian', email: 'lavanya.subramanian@shopsmart-synthetic.internal', phone: '9000257834', line1: '148, Station Road', city: 'Coimbatore', state: 'Tamil Nadu', pincode: '641018' },
  { name: 'Gaurav Bansal', email: 'gaurav.bansal@shopsmart-synthetic.internal', phone: '9000265753', line1: '185, Park Street', city: 'Delhi', state: 'Delhi', pincode: '110085' },
  { name: 'Prachi Deshpande', email: 'prachi.deshpande@shopsmart-synthetic.internal', phone: '9000273672', line1: '22, Main Road', city: 'Nagpur', state: 'Maharashtra', pincode: '440010' },
  { name: 'Nikhil Chauhan', email: 'nikhil.chauhan@shopsmart-synthetic.internal', phone: '9000281591', line1: '59, Link Road', city: 'Dehradun', state: 'Uttarakhand', pincode: '248001' },
  { name: 'Sanya Arora', email: 'sanya.arora@shopsmart-synthetic.internal', phone: '9000289510', line1: '96, MG Road', city: 'Delhi', state: 'Delhi', pincode: '110024' },
  { name: 'Omkar Sawant', email: 'omkar.sawant@shopsmart-synthetic.internal', phone: '9000297429', line1: '133, Station Road', city: 'Thane', state: 'Maharashtra', pincode: '400601' },
  { name: 'Bhavna Trivedi', email: 'bhavna.trivedi@shopsmart-synthetic.internal', phone: '9000305348', line1: '170, Park Street', city: 'Vadodara', state: 'Gujarat', pincode: '390007' },
  { name: 'Akash Hegde', email: 'akash.hegde@shopsmart-synthetic.internal', phone: '9000313267', line1: '7, Main Road', city: 'Bengaluru', state: 'Karnataka', pincode: '560076' },
  { name: 'Zoya Khan', email: 'zoya.khan@shopsmart-synthetic.internal', phone: '9000321186', line1: '44, Link Road', city: 'Hyderabad', state: 'Telangana', pincode: '500028' },
];

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
    // Credentials come from the environment (.env), never from this repo.
    // If ADMIN_PASSWORD isn't set, no admin is created; an existing admin is
    // never overwritten here (use `npm run admin:password` to change it).
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@shopsmart.com';
    if (process.env.ADMIN_PASSWORD) {
      if (process.env.ADMIN_PASSWORD.length < 12) {
        throw new Error('ADMIN_PASSWORD must be at least 12 characters');
      }
      const adminPasswordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
      const adminRes = await client.query(
        `INSERT INTO users (name, email, password, role)
         VALUES ($1, $2, $3, 'admin')
         ON CONFLICT (email) DO NOTHING
         RETURNING id`,
        ['Admin', adminEmail, adminPasswordHash]
      );
      console.log(adminRes.rowCount ? `Created admin user ${adminEmail}` : `Admin user ${adminEmail} already exists (password unchanged)`);
    } else {
      console.log('ADMIN_PASSWORD not set — skipped creating an admin user');
    }

    // --- Synthetic customer accounts (used by the traffic generator) ---
    // Tagged by the @shopsmart-synthetic.internal email domain so their orders
    // can be filtered out of, or studied separately from, real business data.
    // The password comes from SYNTHETIC_BOT_PASSWORD (.env), shared with the
    // traffic-generator container; it is never stored in this repo.
    if (process.env.SYNTHETIC_BOT_PASSWORD) {
      const botPasswordHash = await bcrypt.hash(process.env.SYNTHETIC_BOT_PASSWORD, 10);
      for (const c of SYNTHETIC_CUSTOMERS) {
        const userRes = await client.query(
          `INSERT INTO users (name, email, password, role)
           VALUES ($1, $2, $3, 'customer')
           ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password = EXCLUDED.password
           RETURNING id`,
          [c.name, c.email, botPasswordHash]
        );
        const userId = userRes.rows[0].id;
        const existingAddr = await client.query('SELECT id FROM addresses WHERE user_id = $1', [userId]);
        if (existingAddr.rows.length === 0) {
          await client.query(
            `INSERT INTO addresses (user_id, name, phone, line1, city, state, pincode, is_default)
             VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
            [userId, c.name, c.phone, c.line1, c.city, c.state, c.pincode]
          );
        }
      }
      // Older synthetic accounts (bot1..bot5) get the same password, so none keep the old public one.
      await client.query(
        `UPDATE users SET password = $1 WHERE email LIKE '%@shopsmart-synthetic.internal'`,
        [botPasswordHash]
      );
      console.log(`Seeded ${SYNTHETIC_CUSTOMERS.length} synthetic customer accounts`);
    } else {
      console.log('SYNTHETIC_BOT_PASSWORD not set — skipped synthetic customer accounts');
    }

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