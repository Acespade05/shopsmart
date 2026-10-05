require('dotenv').config();

// Sign-in tokens are signed with JWT_SECRET. A missing or publicly known value
// would let anyone forge an admin token, so refuse to start with one.
// (For a deliberate weak-secret security test, set ALLOW_WEAK_JWT_SECRET=true.)
const KNOWN_WEAK_SECRETS = ['change_me_to_a_long_random_string', 'secret', 'changeme'];
const jwtSecret = process.env.JWT_SECRET || '';
if (process.env.ALLOW_WEAK_JWT_SECRET !== 'true' && (jwtSecret.length < 16 || KNOWN_WEAK_SECRETS.includes(jwtSecret))) {
  console.error('FATAL: JWT_SECRET is missing or too weak. Set a long random JWT_SECRET in .env (see .env.example).');
  process.exit(1);
}
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const { trackSession } = require('./middleware/session');
const { optionalAuthenticate } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const categoryRoutes = require('./routes/categories');
const cartRoutes = require('./routes/cart');
const addressRoutes = require('./routes/addresses');
const checkoutRoutes = require('./routes/checkout');
const orderRoutes = require('./routes/orders');
const metricsRoutes = require('./routes/metrics');
const adminRoutes = require('./routes/admin');
const reviewRoutes = require('./routes/reviews');
const wishlistRoutes = require('./routes/wishlist');
const botActivityRoutes = require('./routes/botActivity');

const app = express();

app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

app.use(optionalAuthenticate);
app.use(trackSession);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/bot-activity', botActivityRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`ShopSmart backend listening on port ${PORT}`);
  if (process.env.SIMULATE_WAREHOUSE === 'true') {
    require('./jobs/warehouse').startWarehouse();
  }
});

module.exports = app;