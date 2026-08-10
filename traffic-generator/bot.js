// Synthetic shopper traffic generator for ShopSmart baseline data.
// Simulates realistic browsing funnels with time-of-day/day-of-week
// intensity variation, plus periodic "sale event" bursts.

const BASE_URL = process.env.TARGET_URL || 'https://shopsmart-aisre.duckdns.org';

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[randomInt(0, arr.length - 1)];
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function apiGet(path) {
  try {
    const res = await fetch(`${BASE_URL}${path}`);
    return res.ok ? res.json() : null;
  } catch (err) {
    console.error(`GET ${path} failed:`, err.message);
    return null;
  }
}

async function apiPost(path, body, headers = {}) {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    return res.ok ? res.json() : null;
  } catch (err) {
    console.error(`POST ${path} failed:`, err.message);
    return null;
  }
}

// --- Traffic intensity model ---

function getMode() {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sunday, 6 = Saturday
  const hour = now.getUTCHours();
  const istHour = (hour + 5) % 24; // rough IST offset, good enough for shaping traffic

  const isWeekend = day === 0 || day === 6;
  const isEvening = istHour >= 18 && istHour <= 23;
  const isNight = istHour >= 1 && istHour <= 6;

  if (isNight) return { name: 'night', concurrency: 2, delayMs: [8000, 20000] };
  if (isWeekend && isEvening) return { name: 'weekend-evening', concurrency: 10, delayMs: [1500, 4000] };
  if (isWeekend) return { name: 'weekend', concurrency: 7, delayMs: [2500, 6000] };
  if (isEvening) return { name: 'weekday-evening', concurrency: 8, delayMs: [2000, 5000] };
  return { name: 'weekday', concurrency: 5, delayMs: [3000, 7000] };
}

// Sale event: roughly a 2-hour burst window, once every ~5 days, deterministic
// from the date so all bot instances agree on when it's active without
// needing shared state.
function isSaleEvent() {
  const now = new Date();
  const dayOfYear = Math.floor((now - new Date(now.getUTCFullYear(), 0, 0)) / 86400000);
  const hour = now.getUTCHours();
  return dayOfYear % 5 === 0 && hour >= 12 && hour < 14;
}

// --- Shopper behavior funnel ---

async function shopperSession(id, saleMode) {
  try {
    const categoriesData = await apiGet('/api/categories');
    if (!categoriesData) return;

    // Browse home occasionally
    if (Math.random() < 0.3) {
      await apiGet('/api/products?sort=rating&limit=8');
      await sleep(randomInt(500, 1500));
    }

    // Browse a category
    const category = pick(categoriesData.categories);
    const categoryData = await apiGet(`/api/categories/${category.slug}`);
    if (!categoryData || categoryData.products.length === 0) return;
    await sleep(randomInt(800, 2000));

    // View 1-3 product details
    const viewCount = randomInt(1, 3);
    let viewedProduct = null;
    for (let i = 0; i < viewCount; i++) {
      viewedProduct = pick(categoryData.products);
      await apiGet(`/api/products/${viewedProduct.slug}`);
      await sleep(randomInt(1000, 3000));
    }

    // Sometimes search instead
    if (Math.random() < 0.15) {
      const terms = ['shirt', 'phone', 'book', 'shoes', 'kettle', 'watch'];
      await apiGet(`/api/products/search?q=${pick(terms)}`);
      await sleep(randomInt(800, 1800));
    }

    // Conversion funnel: baseline ~25% add-to-cart, boosted in sale mode
    const addToCartChance = saleMode ? 0.55 : 0.25;
    if (viewedProduct && Math.random() < addToCartChance) {
      await apiPost('/api/cart/add', { productId: viewedProduct.id, quantity: randomInt(1, 2) });
      await sleep(randomInt(1000, 2500));

      // Of those who add to cart, some proceed toward checkout intent
      // (we don't complete real orders here — that needs auth + address,
      // and creating fake orders would pollute real business metrics)
      if (Math.random() < 0.4) {
        await apiGet('/api/cart');
      }
    }

    console.log(`[bot ${id}] session complete — category: ${category.slug}, mode: ${saleMode ? 'SALE' : 'normal'}`);
  } catch (err) {
    console.error(`[bot ${id}] session error:`, err.message);
  }
}

async function runBotLoop(id) {
  while (true) {
    const mode = getMode();
    const saleMode = isSaleEvent();
    const effectiveConcurrency = saleMode ? mode.concurrency * 2 : mode.concurrency;

    // Each bot only acts if it's "within" the current concurrency budget —
    // simple way to scale active bots up/down without restarting containers.
    if (id <= effectiveConcurrency) {
      await shopperSession(id, saleMode);
    }

    const [minDelay, maxDelay] = mode.delayMs;
    await sleep(randomInt(minDelay, maxDelay));
  }
}

async function main() {
  console.log(`Traffic generator starting — target: ${BASE_URL}`);
  const totalBots = 12;
  const bots = [];
  for (let i = 1; i <= totalBots; i++) {
    bots.push(runBotLoop(i));
  }
  await Promise.all(bots);
}

main();