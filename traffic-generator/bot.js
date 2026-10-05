// ShopSmart traffic generator — synthetic shoppers that behave like real ones.
//
// Each "visit" is one shopper in one browser session:
//   * keeps its session cookie for the whole visit (new visitors get a new
//     session; ~35% are returning visitors who reuse an earlier cookie),
//   * lands on the home page, a category or a search,
//   * views a few products, sometimes adds one to the cart (cheaper items
//     more often; clothing with a size),
//   * some go on to checkout: sign in, pick the saved address, maybe try a
//     coupon, pay (the mock gateway declines ~5%), and place the order,
//   * others abandon at the cart or at checkout, like real shoppers.
// Overall ~2–4% of visits become orders. Traffic follows Indian time of day,
// with heavier evenings/weekends and a short sale window every 5th day.
//
// Synthetic accounts use the @shopsmart-synthetic.internal email domain (see
// backend/seeds/run.js) so their orders can be separated from real ones.
// Each visit sends ONE summary to /api/bot-activity for the admin panel.

const BASE_URL = process.env.TARGET_URL || 'https://shopsmart-aisre.duckdns.org';
const BOT_PASSWORD = process.env.SYNTHETIC_BOT_PASSWORD || '';
const TOTAL_BOTS = 12;
// Testing only: 0.05 runs every wait 20× faster. Leave unset in production.
const TIME_SCALE = parseFloat(process.env.BOT_TIME_SCALE) || 1;

// Must match SYNTHETIC_CUSTOMERS in backend/seeds/run.js
const ACCOUNTS = [
  'aarav.sharma', 'priya.iyer', 'rohan.mehta', 'ananya.reddy', 'vikram.singh', 'sneha.kulkarni', 'arjun.nair',
  'kavya.rao', 'aditya.joshi', 'ishita.banerjee', 'rahul.verma', 'meera.pillai', 'karan.malhotra', 'pooja.desai',
  'siddharth.gupta', 'nikita.shah', 'aniket.patil', 'divya.menon', 'harsh.agarwal', 'riya.chatterjee',
  'manish.yadav', 'shruti.bhat', 'kunal.kapoor', 'tanvi.jain', 'varun.krishnan', 'neha.saxena', 'abhishek.das',
  'swati.mishra', 'yash.thakur', 'aishwarya.gowda', 'rajat.sinha', 'lavanya.subramanian', 'gaurav.bansal',
  'prachi.deshpande', 'nikhil.chauhan', 'sanya.arora', 'omkar.sawant', 'bhavna.trivedi', 'akash.hegde', 'zoya.khan',
].map((n) => `${n}@shopsmart-synthetic.internal`);

const SEARCH_TERMS = [
  'phone', 'iphone', 'samsung', 'laptop', 'watch', 'shirt', 'shoes', 'dress', 'bag', 'perfume',
  'lipstick', 'book', 'cricket', 'football', 'pan', 'knife', 'rice', 'coffee', 'headphones', 'sunglasses',
];
const COUPONS = [
  { code: 'WELCOME10', min: 0 },
  { code: 'FLAT200', min: 999 },
];
const PAYMENT_METHODS = ['upi', 'upi', 'upi', 'card', 'card', 'netbanking'];

// ---------------------------------------------------------------- helpers
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[randomInt(0, arr.length - 1)];
const chance = (p) => Math.random() < p;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms * TIME_SCALE));
const think = (min = 1500, max = 6000) => sleep(randomInt(min, max)); // reading time between pages

// Returning visitors reuse one of these cookies; capped so it doesn't grow forever.
const knownCookies = [];
function rememberCookie(cookie) {
  if (!cookie) return;
  knownCookies.push(cookie);
  if (knownCookies.length > 300) knownCookies.shift();
}

// Sign-in tokens (valid 7 days) are cached per account, so bots don't hit
// the sign-in rate limit on every visit.
const tokens = new Map();
let loginBlockedUntil = 0;

// One browser session.
class Visit {
  constructor(botId) {
    this.botId = botId;
    this.cookie = chance(0.35) && knownCookies.length ? pick(knownCookies) : null;
    this.token = null;
    this.email = null;
    this.log = [];
  }

  async request(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.cookie) headers.Cookie = this.cookie;
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
      const sid = setCookies.map((c) => c.split(';')[0]).find((c) => c.startsWith('session_id='));
      if (sid) this.cookie = sid;
      let data = null;
      try {
        data = await res.json();
      } catch {
        // non-JSON body (e.g. nginx error page)
      }
      return { status: res.status, ok: res.ok, data };
    } catch (err) {
      console.error(`[bot ${this.botId}] ${method} ${path} failed: ${err.message}`);
      return { status: 0, ok: false, data: null };
    }
  }

  get(path) {
    return this.request('GET', path);
  }

  post(path, body) {
    return this.request('POST', path, body);
  }

  async signIn() {
    if (!BOT_PASSWORD) return false;
    this.email = pick(ACCOUNTS);
    if (tokens.has(this.email)) {
      this.token = tokens.get(this.email);
      const me = await this.get('/api/auth/me');
      if (me.ok) return true;
      tokens.delete(this.email);
      this.token = null;
    }
    if (Date.now() < loginBlockedUntil) return false;
    const res = await this.post('/api/auth/login', { email: this.email, password: BOT_PASSWORD });
    if (res.status === 429) {
      loginBlockedUntil = Date.now() + 60000;
      return false;
    }
    if (!res.ok || !res.data?.token) return false;
    this.token = res.data.token;
    tokens.set(this.email, this.token);
    return true;
  }

  async summary(action, detail) {
    rememberCookie(this.cookie);
    await this.post('/api/bot-activity', { botId: this.botId, action, detail });
  }
}

// ---------------------------------------------------------------- schedule
function getMode() {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 3600 * 1000);
  const day = ist.getUTCDay();
  const hour = ist.getUTCHours();
  const isWeekend = day === 0 || day === 6;
  const isEvening = hour >= 18 && hour <= 23;
  const isNight = hour >= 1 && hour <= 6;

  if (isNight) return { name: 'night', concurrency: 2, delayMs: [20000, 60000] };
  if (isWeekend && isEvening) return { name: 'weekend-evening', concurrency: 10, delayMs: [3000, 9000] };
  if (isWeekend) return { name: 'weekend', concurrency: 7, delayMs: [5000, 15000] };
  if (isEvening) return { name: 'weekday-evening', concurrency: 8, delayMs: [4000, 12000] };
  return { name: 'weekday', concurrency: 5, delayMs: [6000, 18000] };
}

function isSaleEvent() {
  const now = new Date();
  const dayOfYear = Math.floor((now - new Date(now.getUTCFullYear(), 0, 0)) / 86400000);
  const hour = now.getUTCHours();
  return dayOfYear % 5 === 0 && hour >= 12 && hour < 14;
}

// Cheaper products get added to carts far more often: a ₹500 item is ~8× as
// likely as a ₹50,000 one, which keeps average order value in a realistic range.
function addToCartChance(product, saleMode) {
  const price = parseFloat(product.price) || 1000;
  const base = saleMode ? 0.12 : 0.07;
  return base * Math.min(2, Math.pow(3000 / price, 0.6));
}

// ---------------------------------------------------------------- one visit
async function shopperVisit(botId, saleMode) {
  const v = new Visit(botId);
  const viewed = [];
  let cartCount = 0;

  // Some returning visitors are already signed in.
  if (v.cookie && chance(0.5)) await v.signIn();

  // 1. Landing page
  const landing = Math.random();
  let pool = [];
  if (landing < 0.4) {
    await v.get('/api/categories');
    const res = await v.get(`/api/products?sort=${pick(['popular', 'discount', 'rating'])}&limit=12`);
    pool = res.data?.products || [];
    v.log.push('home');
  } else if (landing < 0.75) {
    const cats = (await v.get('/api/categories')).data?.categories || [];
    if (cats.length === 0) return;
    const cat = pick(cats);
    const res = await v.get(`/api/categories/${cat.slug}`);
    pool = res.data?.products || [];
    v.log.push(cat.name);
  } else {
    const term = pick(SEARCH_TERMS);
    const res = await v.get(`/api/products/search?q=${encodeURIComponent(term)}`);
    pool = res.data?.products || [];
    v.log.push(`searched "${term}"`);
  }
  await think();
  if (pool.length === 0) {
    await v.summary('visit', `${v.log.join(' → ')} · no results, left`);
    return;
  }

  // 2. Browse 1–5 products, maybe add some to the cart
  const views = randomInt(1, 5);
  for (let i = 0; i < views; i++) {
    const p = pick(pool);
    const res = await v.get(`/api/products/${p.slug}`);
    const product = res.data?.product;
    if (!product) continue;
    viewed.push(product.name);
    if (res.data.related?.length && chance(0.4)) pool = res.data.related; // follow "you may also like"
    await think(2500, 9000);

    if (product.stock > 0 && chance(addToCartChance(product, saleMode))) {
      const size = product.sizes?.length ? pick(product.sizes) : undefined;
      const add = await v.post('/api/cart/add', { productId: product.id, quantity: chance(0.85) ? 1 : 2, size });
      if (add.ok) cartCount++;
      await think(800, 2500);
    }
  }
  v.log.push(`viewed ${viewed.length}`);

  if (cartCount === 0) {
    await v.summary('visit', `${v.log.join(' → ')} · left without buying`);
    return;
  }

  // 3. Cart
  const cart = (await v.get('/api/cart')).data?.cart;
  const subtotal = (cart?.items || []).reduce((s, i) => s + i.price * i.quantity, 0);
  v.log.push(`cart ₹${Math.round(subtotal).toLocaleString('en-IN')}`);
  await think();
  if (!chance(saleMode ? 0.45 : 0.32)) {
    await v.summary('abandoned_cart', `${v.log.join(' → ')} · abandoned cart`);
    return;
  }

  // 4. Checkout (needs an account; the guest cart carries over on sign-in)
  if (!v.token && !(await v.signIn())) {
    await v.summary('abandoned_cart', `${v.log.join(' → ')} · left at sign-in`);
    return;
  }
  const start = await v.post('/api/checkout/start', {});
  if (!start.ok) {
    await v.summary('visit', `${v.log.join(' → ')} · checkout error ${start.status}`);
    return;
  }
  const addresses = (await v.get('/api/addresses')).data?.addresses || [];
  const address = addresses.find((a) => a.is_default) || addresses[0];
  await think(3000, 10000);
  if (!address || chance(0.25)) {
    await v.summary('abandoned_checkout', `${v.log.join(' → ')} · abandoned at checkout`);
    return;
  }

  let discountCode;
  if (chance(0.2)) {
    const usable = COUPONS.filter((c) => subtotal >= c.min);
    if (usable.length) {
      const c = pick(usable);
      const res = await v.post('/api/checkout/apply-coupon', { code: c.code });
      if (res.ok) discountCode = c.code;
    }
  }

  // 5. Payment (mock gateway declines ~5%); some shoppers retry once
  let method = pick(PAYMENT_METHODS);
  let pay = await v.post('/api/checkout/payment', { amount: Math.round(subtotal), method });
  if (pay.status === 402 && chance(0.5)) {
    await think(2000, 5000);
    method = pick(PAYMENT_METHODS);
    pay = await v.post('/api/checkout/payment', { amount: Math.round(subtotal), method });
  }
  if (!pay.ok) {
    await v.summary('payment_failed', `${v.log.join(' → ')} · payment ${method} failed`);
    return;
  }

  const confirm = await v.post('/api/checkout/confirm', {
    addressId: address.id,
    paymentMethod: method,
    transactionId: pay.data?.payment?.transactionId,
    discountCode,
  });
  if (!confirm.ok) {
    await v.summary('order_failed', `${v.log.join(' → ')} · order failed: ${confirm.data?.error || confirm.status}`);
    return;
  }
  const order = confirm.data.order;
  await think(1000, 3000);
  await v.get(`/api/orders/${order.id}`);
  await v.summary(
    'purchase',
    `${v.log.join(' → ')} · ordered #${order.id} ₹${Math.round(order.total).toLocaleString('en-IN')} via ${method}` +
      (discountCode ? ` with ${discountCode}` : '')
  );
}

// ---------------------------------------------------------------- main loop
async function runBot(id) {
  // Stagger start-up so all bots don't arrive at once.
  await sleep(id * 2500);
  while (true) {
    const mode = getMode();
    const saleMode = isSaleEvent();
    const active = saleMode ? mode.concurrency * 2 : mode.concurrency;
    if (id <= active) {
      try {
        await shopperVisit(id, saleMode);
      } catch (err) {
        console.error(`[bot ${id}] visit error:`, err.message);
      }
    }
    const [min, max] = mode.delayMs;
    await sleep(randomInt(min, max));
  }
}

console.log(`Traffic generator v2 — target: ${BASE_URL}${BOT_PASSWORD ? '' : ' (no SYNTHETIC_BOT_PASSWORD: browsing only)'}`);
Promise.all(Array.from({ length: TOTAL_BOTS }, (_, i) => runBot(i + 1)));
