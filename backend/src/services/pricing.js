// Sale pricing. Product prices in the database never change for a sale:
// while a sale is live, every price the API hands out (product lists, product
// pages, search, the cart, checkout) goes through this module, which applies
// the sale discount on the fly. When the sale ends, normal prices are back
// with nothing to undo.
const pool = require('../config/database');

const SALE_CACHE_MS = 10000; // sales change rarely; re-check every 10 s
let saleCache = { at: 0, until: 0, live: null, next: null };

function toSale(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    discountPercent: row.discount_percent,
    categories: row.category_slugs || null, // null = whole store
    startsAt: row.starts_at,
    endsAt: row.ends_at,
  };
}

// The sale running right now (or null) and the next scheduled one.
async function getSaleState() {
  if (Date.now() < saleCache.until) return saleCache;
  let result;
  try {
    result = await pool.query(
    `(SELECT *, 'live' AS kind FROM sales WHERE starts_at <= now() AND ends_at > now() ORDER BY starts_at DESC LIMIT 1)
     UNION ALL
     (SELECT *, 'next' AS kind FROM sales WHERE starts_at > now() ORDER BY starts_at ASC LIMIT 1)`
    );
  } catch (err) {
    // e.g. the sales table doesn't exist yet during a deploy: sell at normal prices
    if (!saleCache.warned) console.error('Sale lookup failed, using normal prices:', err.message);
    saleCache = { at: Date.now(), until: Date.now() + SALE_CACHE_MS, live: null, next: null, warned: true };
    return saleCache;
  }
  const live = toSale(result.rows.find((r) => r.kind === 'live'));
  const next = toSale(result.rows.find((r) => r.kind === 'next'));
  // Re-check after 10 s, or exactly when a sale starts/ends if that's sooner
  const boundaries = [live?.endsAt, next?.startsAt].filter(Boolean).map((d) => new Date(d).getTime());
  saleCache = {
    at: Date.now(),
    until: Math.min(Date.now() + SALE_CACHE_MS, ...boundaries),
    live,
    next,
  };
  return saleCache;
}

// Call after the admin changes sales, so the store picks it up immediately.
function invalidateSales() {
  saleCache.until = 0;
}

// product id → category slug, for category-only sales
let categoryCache = { at: 0, byId: new Map() };
async function categoriesOf(ids) {
  const stale = Date.now() - categoryCache.at > 60000;
  if (stale || ids.some((id) => !categoryCache.byId.has(id))) {
    const result = await pool.query(
      `SELECT p.id, c.slug FROM products p LEFT JOIN categories c ON c.id = p.category_id`
    );
    categoryCache = { at: Date.now(), byId: new Map(result.rows.map((r) => [r.id, r.slug])) };
  }
  return categoryCache.byId;
}

// Sale price, rounded to the rupee like Indian shop prices
function salePrice(price, percent) {
  return Math.max(1, Math.round(price * (1 - percent / 100)));
}

async function saleApplies(sale, productIds) {
  if (!sale) return () => false;
  if (!sale.categories) return () => true;
  const cats = await categoriesOf(productIds);
  return (id) => sale.categories.includes(cats.get(id));
}

// Products as returned by the API → the same objects with sale prices.
// `price` becomes the sale price, `original_price` keeps the MRP (or the
// regular price when there is no MRP) so the store shows it struck through,
// and `sale` says which sale applied.
async function applySale(products) {
  if (!Array.isArray(products) || products.length === 0) return products;
  const { live } = await getSaleState();
  if (!live) return products;
  const applies = await saleApplies(live, products.map((p) => p.id));
  return products.map((p) => {
    if (!applies(p.id)) return p;
    const regular = parseFloat(p.price);
    const mrp = p.original_price ? parseFloat(p.original_price) : 0;
    return {
      ...p,
      price: salePrice(regular, live.discountPercent).toFixed(2),
      original_price: (mrp > regular ? mrp : regular).toFixed(2),
      regular_price: regular.toFixed(2),
      sale: { id: live.id, name: live.name, discountPercent: live.discountPercent },
    };
  });
}

// The cart stores each item's price from when it was added. Re-price it from
// the current product price (+ any live sale) every time it is read, so the
// shopper always sees — and pays — today's price.
async function priceCart(cart) {
  const items = cart?.items || [];
  if (items.length === 0) return { items: [] };
  const ids = [...new Set(items.map((i) => i.productId))];
  const result = await pool.query('SELECT id, price FROM products WHERE id = ANY($1::int[])', [ids]);
  const regularById = new Map(result.rows.map((r) => [r.id, parseFloat(r.price)]));
  const { live } = await getSaleState();
  const applies = await saleApplies(live, ids);
  return {
    ...cart,
    items: items.map((item) => {
      const regular = regularById.has(item.productId) ? regularById.get(item.productId) : item.price;
      const { listPrice, sale, ...rest } = item; // drop stale values
      if (live && applies(item.productId)) {
        return {
          ...rest,
          price: salePrice(regular, live.discountPercent),
          listPrice: regular,
          sale: { id: live.id, name: live.name, discountPercent: live.discountPercent },
        };
      }
      return { ...rest, price: regular };
    }),
  };
}

module.exports = { getSaleState, invalidateSales, applySale, priceCart, salePrice };
