// ShopSmart traffic generator v3 — synthetic shoppers that behave like real ones.
//
// Arrivals: visits arrive at random (Poisson) at a rate that follows an Indian
// e-commerce day — quiet 2–6 am, building through the day, peaking 8–11 pm —
// busier at weekends and in the first days of the month (payday), with a sale
// spike every 5th day. DAILY_VISITS sets the average visits per day.
//
// Each visitor is a person with their own IP address (Indian ISPs), browser
// and phone/desktop, and keeps them on return visits. A visit makes the same
// requests a browser running the React app would: the page HTML and JS/CSS
// bundle (first visit only), the navbar/cart calls, then page by page.
//
// Shoppers react to the site's health like people do:
//   * slow pages → some give up (the slower, the more),
//   * errors/timeouts → they refresh once, then leave,
//   * payment declines → some retry with another method.
// So when the site is slow or broken, orders and revenue genuinely fall.
//
// Checkout needs an account: returning customers sign in, first-timers sign
// up (with a fictional name and address). Accounts use the
// @shopsmart-synthetic.internal email domain so their orders can be told
// apart from real ones. Each visit sends ONE summary to /api/bot-activity.

const fs = require('fs');

const BASE_URL = process.env.TARGET_URL || 'https://shopsmart-aisre.duckdns.org';
// Address shoppers "see" in their browser (used for Referer headers)
const SITE_URL = process.env.SITE_URL || 'https://shopsmart-aisre.duckdns.org';
const BOT_PASSWORD = process.env.SYNTHETIC_BOT_PASSWORD || '';
const DAILY_VISITS = parseInt(process.env.DAILY_VISITS, 10) || 8000;
const MAX_CONCURRENT_VISITS = 600; // safety cap only; during an incident visits pile up like real traffic
const REQUEST_TIMEOUT_MS = 20000; // a browser tab waits about this long before showing an error
const DATA_FILE = process.env.BOT_DATA_FILE || '/data/accounts.json';
// Testing only. BOT_TIME_SCALE=0.05 makes every wait 20× shorter;
// BOT_RATE_SCALE=20 makes visits arrive 20× more often. Leave unset in production.
const TIME_SCALE = parseFloat(process.env.BOT_TIME_SCALE) || 1;
const RATE_SCALE = parseFloat(process.env.BOT_RATE_SCALE) || 1;

const DOMAIN = '@shopsmart-synthetic.internal';

// ================================================================ people
// Seeded accounts (backend/seeds/run.js SYNTHETIC_CUSTOMERS)
const SEEDED_ACCOUNTS = [
  'aarav.sharma', 'priya.iyer', 'rohan.mehta', 'ananya.reddy', 'vikram.singh', 'sneha.kulkarni', 'arjun.nair',
  'kavya.rao', 'aditya.joshi', 'ishita.banerjee', 'rahul.verma', 'meera.pillai', 'karan.malhotra', 'pooja.desai',
  'siddharth.gupta', 'nikita.shah', 'aniket.patil', 'divya.menon', 'harsh.agarwal', 'riya.chatterjee',
  'manish.yadav', 'shruti.bhat', 'kunal.kapoor', 'tanvi.jain', 'varun.krishnan', 'neha.saxena', 'abhishek.das',
  'swati.mishra', 'yash.thakur', 'aishwarya.gowda', 'rajat.sinha', 'lavanya.subramanian', 'gaurav.bansal',
  'prachi.deshpande', 'nikhil.chauhan', 'sanya.arora', 'omkar.sawant', 'bhavna.trivedi', 'akash.hegde', 'zoya.khan',
].map((n) => `${n}${DOMAIN}`);

const FIRST_NAMES = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Krishna', 'Ishaan', 'Shaurya', 'Atharv', 'Kabir',
  'Rohan', 'Kunal', 'Pranav', 'Siddharth', 'Rahul', 'Amit', 'Vikram', 'Nikhil', 'Harsh', 'Yash', 'Tejas', 'Omkar',
  'Faisal', 'Imran', 'Joseph', 'Gurpreet', 'Ananya', 'Diya', 'Saanvi', 'Aadhya', 'Isha', 'Kavya', 'Priya', 'Sneha',
  'Pooja', 'Neha', 'Riya', 'Shruti', 'Tanvi', 'Meera', 'Divya', 'Swati', 'Anjali', 'Nisha', 'Pallavi', 'Aishwarya',
  'Sana', 'Fatima', 'Mary', 'Harleen', 'Lakshmi', 'Deepika', 'Komal', 'Megha', 'Ritika', 'Shreya', 'Varsha', 'Zoya',
];
const LAST_NAMES = [
  'Sharma', 'Verma', 'Gupta', 'Singh', 'Kumar', 'Patel', 'Shah', 'Mehta', 'Joshi', 'Desai', 'Kulkarni', 'Patil',
  'Deshpande', 'Iyer', 'Nair', 'Menon', 'Pillai', 'Reddy', 'Rao', 'Naidu', 'Gowda', 'Hegde', 'Shetty', 'Bhat',
  'Banerjee', 'Chatterjee', 'Mukherjee', 'Das', 'Bose', 'Sen', 'Mishra', 'Tiwari', 'Pandey', 'Yadav', 'Saxena',
  'Agarwal', 'Bansal', 'Jain', 'Malhotra', 'Kapoor', 'Khanna', 'Arora', 'Chopra', 'Khan', 'Shaikh', 'Fernandes',
  "D'Souza", 'Gill', 'Sandhu', 'Thakur', 'Chauhan', 'Sawant', 'Pawar', 'Jadhav', 'Krishnan', 'Subramanian',
];
// [city, state, PIN prefix, weight] — metros get most orders
const CITIES = [
  ['Mumbai', 'Maharashtra', '400', 14], ['Delhi', 'Delhi', '110', 13], ['Bengaluru', 'Karnataka', '560', 12],
  ['Hyderabad', 'Telangana', '500', 8], ['Chennai', 'Tamil Nadu', '600', 7], ['Pune', 'Maharashtra', '411', 7],
  ['Kolkata', 'West Bengal', '700', 6], ['Ahmedabad', 'Gujarat', '380', 5], ['Thane', 'Maharashtra', '400', 4],
  ['Gurugram', 'Haryana', '122', 4], ['Noida', 'Uttar Pradesh', '201', 4], ['Jaipur', 'Rajasthan', '302', 3],
  ['Lucknow', 'Uttar Pradesh', '226', 3], ['Surat', 'Gujarat', '395', 2], ['Indore', 'Madhya Pradesh', '452', 2],
  ['Nagpur', 'Maharashtra', '440', 2], ['Kochi', 'Kerala', '682', 2], ['Chandigarh', 'Chandigarh', '160', 2],
  ['Coimbatore', 'Tamil Nadu', '641', 2], ['Bhopal', 'Madhya Pradesh', '462', 1], ['Patna', 'Bihar', '800', 1],
  ['Vadodara', 'Gujarat', '390', 1], ['Nashik', 'Maharashtra', '422', 1], ['Mysuru', 'Karnataka', '570', 1],
  ['Bhubaneswar', 'Odisha', '751', 1], ['Guwahati', 'Assam', '781', 1], ['Dehradun', 'Uttarakhand', '248', 1],
];
const STREETS = ['MG Road', 'Station Road', 'Link Road', 'Main Road', 'Park Street', 'Gandhi Nagar', 'Nehru Road',
  'Shivaji Nagar', 'Lake View Road', 'Church Street', 'Ring Road', 'Market Road', 'Temple Street', 'Hill Road'];

// IP prefixes of Indian ISPs, so access logs look like Indian visitors.
const MOBILE_PREFIXES = ['49.36', '49.37', '49.43', '49.44', '157.32', '157.35', '157.38', '152.58', '106.195',
  '106.205', '106.207', '106.216', '223.181', '223.187', '42.105', '42.106', '42.108', '27.97', '110.224'];
const BROADBAND_PREFIXES = ['122.161', '122.171', '122.172', '182.70', '182.73', '49.205', '49.206', '49.207',
  '117.196', '117.199', '117.213', '103.21', '103.87', '103.211', '106.51', '171.76', '171.79', '59.92', '59.95'];

const MOBILE_UAS = [
  'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.6668.81 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 13; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.6613.146 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 14; 23108RN04Y) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.6668.70 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 13; V2207) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.6533.103 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 14; CPH2581) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.6668.81 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 14; RMX3741) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.6613.127 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 12; moto g62 5G) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.122 Mobile Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
];
const DESKTOP_UAS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
];
// Search-engine crawlers fetch pages too (no JS, no cookies)
const CRAWLERS = [
  ['Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.6668.70 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', '66.249'],
  ['Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)', '157.55'],
  ['Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)', '54.36'],
];

// Searches that find products in this catalogue…
const SEARCH_TERMS = [
  'phone', 'iphone', 'samsung', 'laptop', 'macbook', 'ipad', 'charger', 'watch', 'shirt', 'top', 'dress', 'shoes',
  'sneakers', 'heels', 'slippers', 'bag', 'handbag', 'backpack', 'belt', 'earrings', 'ring', 'sunglasses',
  'lipstick', 'mascara', 'cream', 'book', 'novel', 'cricket', 'bat', 'ball', 'football', 'racket', 'yoga',
  'helmet', 'pan', 'knife', 'blender', 'lamp', 'table', 'chair', 'sofa', 'bed', 'rice', 'oil', 'coffee', 'tea',
  'honey', 'juice', 'eggs',
];
// …and ~12% that don't (typos, things the store doesn't sell) — normal for a real shop
const MISSED_SEARCHES = ['kurta', 'saree', 'atta', 'redmi', 'earbuds', 'headphone', 'perfum', 'iphne', 'mixer grinder',
  'bedsheet', 'pressure cooker', 'jeans'];
const COUPONS = [
  { code: 'WELCOME10', min: 0 },
  { code: 'FLAT200', min: 999 },
];
const PAYMENT_METHODS = ['upi', 'upi', 'upi', 'upi', 'card', 'card', 'netbanking'];
// Where visitors come from: [source, weight, referer, utm query]
const SOURCES = [
  ['direct', 30, null, ''],
  ['google', 34, 'https://www.google.com/', ''],
  ['instagram', 14, 'https://l.instagram.com/', '?utm_source=instagram&utm_medium=paid_social&utm_campaign=festive'],
  ['facebook', 6, 'https://m.facebook.com/', '?utm_source=facebook&utm_medium=paid_social&utm_campaign=festive'],
  ['whatsapp', 9, null, '?utm_source=whatsapp&utm_medium=share'],
  ['email', 5, null, '?utm_source=newsletter&utm_medium=email'],
  ['bing', 2, 'https://www.bing.com/', ''],
];

// ================================================================ helpers
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[randomInt(0, arr.length - 1)];
const chance = (p) => Math.random() < p;
const weighted = (items, w = (i) => i[i.length - 1]) => {
  const total = items.reduce((s, i) => s + w(i), 0);
  let r = Math.random() * total;
  for (const i of items) if ((r -= w(i)) < 0) return i;
  return items[items.length - 1];
};
const rawSleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sleep = (ms) => rawSleep(ms * TIME_SCALE);
const think = (min = 1500, max = 6000) => sleep(randomInt(min, max)); // reading time between pages
const rupees = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;

// ================================================================ accounts
// Seeded accounts plus everyone the bots have signed up. Saved to a file on a
// Docker volume so customers stay "known" across container restarts.
let accounts = [...SEEDED_ACCOUNTS];
try {
  const saved = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  if (Array.isArray(saved.accounts)) accounts = [...new Set([...accounts, ...saved.accounts])];
} catch {
  // first run, or no volume (local testing)
}
let saveTimer = null;
function saveAccounts() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify({ accounts: accounts.filter((a) => !SEEDED_ACCOUNTS.includes(a)) }));
    } catch {
      // not fatal: accounts still exist in the database
    }
  }, 2000);
}

const tokens = new Map(); // email -> JWT (valid 7 days), so bots don't sign in on every visit

function newPerson() {
  const first = pick(FIRST_NAMES);
  const last = pick(LAST_NAMES);
  const [city, state, pinPrefix] = weighted(CITIES);
  const handle = `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, '');
  return {
    name: `${first} ${last}`,
    email: `${handle}${randomInt(10, 9999)}${DOMAIN}`,
    phone: `${pick(['6', '7', '8', '9'])}${randomInt(100000000, 999999999)}`,
    line1: `${randomInt(1, 220)}, ${pick(STREETS)}`,
    city,
    state,
    pincode: `${pinPrefix}${String(randomInt(1, 99)).padStart(3, '0')}`,
  };
}

// ================================================================ visitors
const randomIp = (prefixes) => `${pick(prefixes)}.${randomInt(0, 255)}.${randomInt(1, 254)}`;

function newVisitor() {
  const mobile = chance(0.72);
  return {
    ip: randomIp(mobile ? MOBILE_PREFIXES : BROADBAND_PREFIXES),
    ua: pick(mobile ? MOBILE_UAS : DESKTOP_UAS),
    cookie: null, // session_id cookie
    email: null, // signed-in account, if any
    hasAssets: false, // JS/CSS bundle in browser cache
  };
}

// Returning visitors come back with the same IP, browser, cookie and login.
const returning = [];
function rememberVisitor(v) {
  if (!v.cookie || returning.includes(v)) return;
  returning.push(v);
  if (returning.length > 3000) returning.shift();
}

// Product slugs seen so far, for visitors who land straight on a product page
// (from Google or a shared link).
const knownSlugs = new Set();

// The current JS/CSS bundle file names, read from index.html
let assetPaths = [];
function readAssets(html) {
  if (typeof html !== 'string') return;
  const found = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1]);
  if (found.length) assetPaths = found;
}

// Thrown to end a visit early (shopper gave up)
class Leave {
  constructor(action, why) {
    this.action = action;
    this.why = why;
  }
}

// ================================================================ one browser session
class Visit {
  constructor(visitor, botId) {
    this.v = visitor;
    this.botId = botId;
    this.token = visitor.email ? tokens.get(visitor.email) || null : null;
    this.page = '/'; // current page in the SPA (for Referer)
    this.log = [];
  }

  async request(method, path, body, { referer, json = true } = {}) {
    const headers = {
      'User-Agent': this.v.ua,
      'X-Forwarded-For': this.v.ip,
      'Accept-Language': 'en-IN,en-GB;q=0.9,en-US;q=0.8,hi;q=0.7',
      Accept: json ? 'application/json, text/plain, */*' : 'text/html,application/xhtml+xml,*/*;q=0.8',
      Referer: referer === undefined ? `${SITE_URL}${this.page}` : referer,
    };
    if (!headers.Referer) delete headers.Referer;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (this.v.cookie) headers.Cookie = this.v.cookie;
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    const started = Date.now();
    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
      const sid = setCookies.map((c) => c.split(';')[0]).find((c) => c.startsWith('session_id='));
      if (sid) this.v.cookie = sid;
      const text = await res.text();
      let data = text;
      if (json) {
        try {
          data = JSON.parse(text);
        } catch {
          data = null; // e.g. nginx error page
        }
      }
      return { status: res.status, ok: res.ok, data, ms: Date.now() - started };
    } catch (err) {
      const timedOut = err.name === 'TimeoutError' || err.name === 'AbortError';
      return { status: 0, ok: false, data: null, ms: Date.now() - started, error: timedOut ? 'timed out' : err.message };
    }
  }

  // Did this response make the shopper give up? `patience` > 1 = more patient
  // (people wait longer on payment than on a product page).
  judge(res, what, patience = 1) {
    if (res.status === 0 || res.status >= 500) return 'error';
    const s = res.ms / 1000 / patience;
    const p = s < 2.5 ? 0 : s < 5 ? 0.15 : s < 10 ? 0.4 : 0.75;
    if (chance(p)) throw new Leave('too_slow', `${what} took ${(res.ms / 1000).toFixed(1)}s, gave up`);
    return 'ok';
  }

  // A request the shopper is waiting on. Errors: refresh/retry once (most
  // people), then leave. Client errors (404 etc.) are returned to the caller.
  async call(method, path, body, what, opts = {}) {
    let res = await this.request(method, path, body, opts);
    if (res.status === 429) throw new Leave('site_error', `${what}: too many requests (429), left`);
    if (this.judge(res, what, opts.patience) === 'error') {
      if (chance(0.7)) {
        await think(2000, 6000);
        res = await this.request(method, path, body, opts);
        if (res.status === 429) throw new Leave('site_error', `${what}: too many requests (429), left`);
      }
      if (res.status === 0 || res.status >= 500) {
        throw new Leave('site_error', `${what}: ${res.error || `HTTP ${res.status}`}, left`);
      }
      this.judge(res, what, opts.patience);
    }
    return res;
  }

  get(path, what, opts) {
    return this.call('GET', path, undefined, what, opts);
  }

  post(path, body, what, opts) {
    return this.call('POST', path, body, what, opts);
  }

  // What a browser does when it opens the site: the HTML page, the JS/CSS
  // bundle (unless cached), then the calls every page makes on start-up.
  async openSite(landingPath, referer) {
    this.page = landingPath;
    const html = await this.call('GET', landingPath, undefined, 'page', { referer, json: false });
    readAssets(html.data);
    if (!this.v.hasAssets && assetPaths.length) {
      await Promise.all(assetPaths.map((p) => this.call('GET', p, undefined, 'page assets', { json: false })));
      this.v.hasAssets = true;
    }
    const boot = [this.get('/api/categories', 'menu'), this.get('/api/cart', 'cart')];
    if (this.token) boot.push(this.request('GET', '/api/auth/me'));
    const results = await Promise.all(boot);
    const me = results[2];
    if (me && !me.ok) {
      // token expired
      tokens.delete(this.v.email);
      this.token = null;
      this.v.email = null;
    }
    return results[0].data?.categories || [];
  }

  // Signing in on this browser (the guest cart is merged into the account)
  async signIn(email) {
    this.page = '/login';
    const res = await this.post('/api/auth/login', { email, password: BOT_PASSWORD }, 'sign-in', { patience: 1.5 });
    if (res.status === 429) return false;
    if (!res.ok || !res.data?.token) return false;
    this.token = res.data.token;
    this.v.email = email;
    tokens.set(email, this.token);
    return true;
  }

  async signUp() {
    const person = newPerson();
    this.page = '/register';
    await think(15000, 40000); // filling in the form
    const res = await this.post(
      '/api/auth/register',
      { name: person.name, email: person.email, password: BOT_PASSWORD, phone: person.phone },
      'sign-up',
      { patience: 1.5 }
    );
    if (!res.ok || !res.data?.token) return null;
    this.token = res.data.token;
    this.v.email = person.email;
    tokens.set(person.email, this.token);
    accounts.push(person.email);
    saveAccounts();
    return person;
  }

  async summary(action, detail) {
    rememberVisitor(this.v);
    await this.request('POST', '/api/bot-activity', { botId: this.botId, action, detail });
  }
}

// ================================================================ traffic curve
// Relative visits per IST hour (0 = midnight). Shape of a typical Indian
// online store: late-night tail, dead 3–5 am, lunch bump, evening peak.
const HOURLY = [
  0.62, 0.38, 0.22, 0.13, 0.1, 0.12, 0.2, 0.36, 0.52, 0.66, 0.76, 0.82,
  0.88, 0.92, 0.84, 0.8, 0.8, 0.85, 0.95, 1.08, 1.22, 1.3, 1.15, 0.88,
];
const HOURLY_MEAN = HOURLY.reduce((a, b) => a + b, 0) / 24;

function istParts(now) {
  const ist = new Date(now.getTime() + 5.5 * 3600 * 1000);
  return {
    day: ist.getUTCDay(),
    date: ist.getUTCDate(),
    hour: ist.getUTCHours() + ist.getUTCMinutes() / 60,
  };
}

// Sale: every 5th day, 5:30–7:30 pm IST (same window as before)
function isSaleEvent(now = new Date()) {
  const dayOfYear = Math.floor((now - new Date(Date.UTC(now.getUTCFullYear(), 0, 0))) / 86400000);
  const hour = now.getUTCHours();
  return dayOfYear % 5 === 0 && hour >= 12 && hour < 14;
}

// Slow-moving random noise (±12%, changes every 15 min) so days aren't identical
let noise = { slot: -1, value: 1 };
function noiseFactor(now) {
  const slot = Math.floor(now.getTime() / (15 * 60000));
  if (slot !== noise.slot) noise = { slot, value: 0.88 + Math.random() * 0.24 };
  return noise.value;
}

function visitsPerMinute(now = new Date()) {
  const { day, date, hour } = istParts(now);
  const h0 = Math.floor(hour);
  const frac = hour - h0;
  const shape = (HOURLY[h0] * (1 - frac) + HOURLY[(h0 + 1) % 24] * frac) / HOURLY_MEAN;
  const weekday = day === 0 ? 1.28 : day === 6 ? 1.2 : day === 5 ? 1.05 : 1;
  const payday = date <= 5 ? 1.15 : date >= 26 ? 0.92 : 1;
  const sale = isSaleEvent(now) ? 2.2 : 1;
  return (DAILY_VISITS / 1440) * shape * weekday * payday * sale * noiseFactor(now) * RATE_SCALE;
}

// ================================================================ shopper behaviour
// Cheaper products get added to carts far more often, which keeps the average
// order value realistic: ~₹2,300 on average, median ~₹600, a long tail of
// phones and appliances (fitted on the products shoppers actually view).
function addToCartChance(product, saleMode) {
  const price = parseFloat(product.price) || 1000;
  const base = saleMode ? 0.065 : 0.042;
  return base * Math.min(2, Math.pow(2000 / price, 0.68));
}

// One shopper's visit. Returns how it ended: { v, action, detail }.
async function shopperVisit(botId) {
  const saleMode = isSaleEvent();
  const isReturning = returning.length > 0 && chance(0.32);
  const visitor = isReturning ? pick(returning) : newVisitor();
  const v = new Visit(visitor, botId);
  try {
    const detail = await shop(v, visitor, isReturning, saleMode);
    return { v, action: 'purchase', detail };
  } catch (err) {
    if (err instanceof Leave) return { v, action: err.action, detail: err.why };
    throw err;
  }
}

async function shop(v, visitor, isReturning, saleMode) {
  const viewed = [];

  // ---- 1. Arrive
  const [source, , referer, utm] = weighted(SOURCES, (s) => s[1]);
  const r = Math.random();
  let landing;
  let pool = [];
  if (source === 'google' && knownSlugs.size && r < 0.45) {
    landing = { kind: 'product', slug: pick([...knownSlugs]) };
  } else if (source === 'whatsapp' && knownSlugs.size && r < 0.7) {
    landing = { kind: 'product', slug: pick([...knownSlugs]) };
  } else if (r < 0.5) {
    landing = { kind: 'home' };
  } else if (r < 0.8) {
    landing = { kind: 'category' };
  } else {
    landing = { kind: 'search' };
  }
  v.log.push(isReturning ? `returning via ${source}` : `new via ${source}`);

  const landingPath = landing.kind === 'product' ? `/products/${landing.slug}` : '/';
  const categories = await v.openSite(`${landingPath}${utm}`, referer);
  const catBySlug = Object.fromEntries(categories.map((c) => [c.slug, c]));

  if (landing.kind === 'home') {
    const [deals, popular] = await Promise.all([
      v.get('/api/products?sort=discount&limit=60', 'home page'),
      v.get('/api/products?sort=popular&limit=12', 'home page'),
    ]);
    pool = [...(popular.data?.products || []), ...(deals.data?.products || []).slice(0, 24)];
    v.log.push('home');
    // Most home visitors then open a category from the menu
    if (categories.length && chance(0.45)) {
      landing = { kind: 'category' };
      await think();
    }
  }
  if (landing.kind === 'category') {
    const cat = pick(categories);
    if (cat) {
      v.page = `/category/${cat.slug}`;
      const res = await v.get(`/api/categories/${cat.slug}`, `${cat.name} page`);
      pool = res.data?.products || [];
      v.log.push(cat.name);
    }
  }
  if (landing.kind === 'search') {
    const term = chance(0.12) ? pick(MISSED_SEARCHES) : pick(SEARCH_TERMS);
    // The search box suggests as you type (debounced): a couple of partial queries
    for (const len of [Math.min(3, term.length), term.length]) {
      await sleep(randomInt(300, 900));
      await v.get(`/api/products/search?q=${encodeURIComponent(term.slice(0, len))}`, 'search suggestions');
    }
    v.page = `/search?q=${encodeURIComponent(term)}`;
    const res = await v.get(`/api/products/search?q=${encodeURIComponent(term)}`, 'search');
    pool = res.data?.products || [];
    v.log.push(`searched "${term}"`);
  }
  if (landing.kind === 'product') {
    pool = [{ slug: landing.slug }];
  }
  for (const p of pool) if (p.slug) knownSlugs.add(p.slug);

  await think();
  if (pool.length === 0) throw new Leave('visit', 'no results, left');
  // ~35% of visits bounce after the first page
  if (landing.kind !== 'product' && chance(0.35)) throw new Leave('visit', 'bounced');

  // ---- 2. Browse products, maybe add some to the cart
  let cartCount = 0;
  const views = landing.kind === 'product' ? randomInt(1, 4) : weighted([[1, 30], [2, 25], [3, 18], [4, 12], [5, 8], [6, 7]])[0];
  for (let i = 0; i < views; i++) {
    const p = i === 0 && landing.kind === 'product' ? pool[0] : pick(pool);
    v.page = `/products/${p.slug}`;
    const res = await v.get(`/api/products/${p.slug}`, 'product page');
    const product = res.data?.product;
    if (!product) continue;
    viewed.push(product.name);
    if (res.data.related?.length) {
      for (const rel of res.data.related) knownSlugs.add(rel.slug);
      if (chance(0.4)) pool = res.data.related; // follow "you may also like"
    }
    if (v.token && chance(0.3)) await v.request('GET', '/api/wishlist');
    await think(4000, 15000);

    if (product.stock > 0 && chance(addToCartChance(product, saleMode))) {
      const size = product.sizes?.length ? pick(product.sizes) : undefined;
      const qty = parseFloat(product.price) < 800 && chance(0.2) ? 2 : 1;
      const add = await v.post('/api/cart/add', { productId: product.id, quantity: qty, size }, 'add to cart');
      if (add.ok) cartCount++;
      await think(800, 2500);
    }
    if (catBySlug[product.category_slug] && chance(0.1)) break; // wandered off
  }
  if (viewed.length) v.log.push(`viewed ${viewed.length}`);

  if (cartCount === 0) throw new Leave('visit', 'left without buying');

  // ---- 3. Cart
  v.page = '/cart';
  const cartRes = await v.get('/api/cart', 'cart');
  const cart = cartRes.data?.cart;
  const subtotal = (cart?.items || []).reduce((s, i) => s + i.price * i.quantity, 0);
  v.log.push(`cart ${rupees(subtotal)}`);
  await v.request('GET', '/api/checkout/offers');
  await think();
  if (!chance(saleMode ? 0.48 : 0.36)) throw new Leave('abandoned_cart', 'abandoned cart');

  // ---- 4. Checkout: sign in (returning customer) or sign up (new customer)
  if (!BOT_PASSWORD) throw new Leave('abandoned_cart', 'left at sign-in (no bot password set)');
  let person = null;
  if (!v.token) {
    const knownCustomer = visitor.email || (chance(0.55) ? pick(accounts) : null);
    if (knownCustomer) {
      if (!(await v.signIn(knownCustomer))) throw new Leave('abandoned_cart', 'left at sign-in');
      v.log.push('signed in');
    } else {
      if (chance(0.2)) throw new Leave('abandoned_cart', 'left at sign-up form');
      person = await v.signUp();
      if (!person) throw new Leave('abandoned_cart', 'sign-up failed, left');
      v.log.push('new customer');
    }
  }
  // The account's cart now includes the guest cart (and anything left in it
  // from an earlier visit) — that's what will be paid for.
  const accountCart = (await v.get('/api/cart', 'cart')).data?.cart;
  const toPay = (accountCart?.items || []).reduce((s, i) => s + i.price * i.quantity, 0);
  if (!toPay) throw new Leave('abandoned_checkout', 'cart empty at checkout');

  v.page = '/checkout';
  const start = await v.post('/api/checkout/start', {}, 'checkout');
  if (!start.ok) throw new Leave('abandoned_checkout', `checkout error ${start.status}`);
  const addrRes = await v.get('/api/addresses', 'checkout');
  let address = (addrRes.data?.addresses || []).find((a) => a.is_default) || addrRes.data?.addresses?.[0];
  if (!address) {
    const p = person || newPerson();
    await think(20000, 50000); // typing an address
    const created = await v.post(
      '/api/addresses',
      { name: p.name, phone: p.phone, line1: p.line1, city: p.city, state: p.state, pincode: p.pincode, isDefault: true },
      'save address'
    );
    address = created.data?.address;
  }
  await think(4000, 12000);
  if (!address || chance(0.25)) throw new Leave('abandoned_checkout', 'abandoned at checkout');

  let discountCode;
  if (chance(0.22)) {
    const usable = COUPONS.filter((c) => toPay >= c.min);
    if (usable.length) {
      const c = pick(usable);
      const res = await v.post('/api/checkout/apply-coupon', { code: c.code }, 'coupon');
      if (res.ok) discountCode = c.code;
    }
  }

  // ---- 5. Payment (people wait longer here); a decline → some retry another way
  let method = pick(PAYMENT_METHODS);
  let pay = await v.post('/api/checkout/payment', { amount: Math.round(toPay), method }, 'payment', { patience: 2.5 });
  if (pay.status === 402 && chance(0.55)) {
    await think(3000, 8000);
    method = pick(PAYMENT_METHODS);
    pay = await v.post('/api/checkout/payment', { amount: Math.round(toPay), method }, 'payment', { patience: 2.5 });
  }
  if (!pay.ok) throw new Leave('payment_failed', `payment ${method} failed: ${pay.data?.code || pay.status}`);

  const confirm = await v.post(
    '/api/checkout/confirm',
    { addressId: address.id, paymentMethod: method, transactionId: pay.data?.payment?.transactionId, discountCode },
    'place order',
    { patience: 2.5 }
  );
  if (!confirm.ok) throw new Leave('order_failed', `order failed: ${confirm.data?.error || confirm.status}`);
  const order = confirm.data.order;
  v.page = `/orders/${order.id}`;
  await think(1000, 3000);
  await v.request('GET', `/api/orders/${order.id}`);
  return `ordered #${order.id} ${rupees(order.total)} via ${method}${discountCode ? ` with ${discountCode}` : ''}`;
}

// A crawler fetches a handful of product pages (HTML only, no JS, no cookies)
async function crawlerVisit() {
  const [ua, prefix] = weighted(CRAWLERS, (c) => (c[1] === '66.249' ? 6 : c[1] === '157.55' ? 2 : 1));
  const ip = randomIp([prefix]);
  const slugs = [...knownSlugs];
  const pages = ['/', '/robots.txt', ...Array.from({ length: randomInt(3, 12) }, () => `/products/${pick(slugs)}`)];
  for (const path of pages) {
    try {
      await fetch(`${BASE_URL}${path}`, {
        headers: { 'User-Agent': ua, 'X-Forwarded-For': ip, Accept: 'text/html,*/*' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      }).then((r) => r.text());
    } catch {
      // crawlers just move on
    }
    await sleep(randomInt(1000, 4000));
  }
}

// ================================================================ main loop
let active = 0;
let visitNo = 0;
const stats = { visits: 0, purchases: 0, siteErrors: 0, tooSlow: 0, dropped: 0 };

async function runVisit() {
  const botId = (visitNo++ % 99) + 1;
  try {
    if (knownSlugs.size > 20 && chance(0.06)) {
      await crawlerVisit();
      return;
    }
    const { v, action, detail } = await shopperVisit(botId);
    stats.visits++;
    if (action === 'purchase') stats.purchases++;
    if (action === 'site_error') stats.siteErrors++;
    if (action === 'too_slow') stats.tooSlow++;
    await v.summary(action, `${v.log.join(' → ')} · ${detail}`);
  } catch (err) {
    console.error(`[visit ${botId}] error:`, err.message);
  }
}

async function arrivals() {
  while (true) {
    const perMinute = visitsPerMinute();
    // Poisson process: exponential gaps between arrivals
    const gapMs = (-Math.log(1 - Math.random()) / perMinute) * 60000;
    await rawSleep(Math.min(gapMs, 10 * 60000));
    if (active >= MAX_CONCURRENT_VISITS) {
      stats.dropped++;
      continue;
    }
    active++;
    runVisit().finally(() => {
      active--;
    });
  }
}

// A status line every 10 minutes in `docker compose logs traffic-generator`
setInterval(() => {
  console.log(
    `[${new Date().toISOString()}] rate ${visitsPerMinute().toFixed(1)}/min · in progress ${active} · ` +
      `last 10 min: ${stats.visits} visits, ${stats.purchases} orders, ${stats.siteErrors} left on errors, ` +
      `${stats.tooSlow} left (slow)${stats.dropped ? `, ${stats.dropped} dropped (cap)` : ''} · ${accounts.length} customer accounts`
  );
  Object.keys(stats).forEach((k) => (stats[k] = 0));
}, 10 * 60000 * Math.min(1, TIME_SCALE * 20));

console.log(
  `Traffic generator v3 — target ${BASE_URL} · ~${DAILY_VISITS} visits/day · ${accounts.length} known customers` +
    (BOT_PASSWORD ? '' : ' · no SYNTHETIC_BOT_PASSWORD: browsing only')
);
arrivals();
