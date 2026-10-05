// "Recently viewed" products, kept in this browser only (localStorage).
const KEY = 'shopsmart_recently_viewed';
const MAX = 12;

export function recentlyViewed() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

export function rememberProduct(p) {
  // Store just what a product card needs.
  const entry = {
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: p.price,
    original_price: p.original_price,
    images: (p.images || []).slice(0, 2),
    rating: p.rating,
    review_count: p.review_count,
    brand: p.brand,
    sizes: p.sizes || [],
    stock: p.stock,
  };
  try {
    const list = [entry, ...recentlyViewed().filter((x) => x.id !== p.id)].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // storage blocked — the feature just stays empty
  }
}
