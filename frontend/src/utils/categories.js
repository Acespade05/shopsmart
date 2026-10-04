// Shared display settings for categories (the categories themselves come from the API).

// Order categories appear in the header menu and on the home page.
export const CATEGORY_ORDER = [
  'electronics', 'clothing', 'accessories', 'home-kitchen',
  'beauty', 'groceries', 'sports', 'books',
];

// Short names for tight spaces (header menu, the large home-page titles).
export const CATEGORY_LABEL = {
  electronics: 'Electronics',
  clothing: 'Fashion',
  accessories: 'Accessories',
  'home-kitchen': 'Home',
  beauty: 'Beauty',
  groceries: 'Grocery',
  sports: 'Sports',
  books: 'Books',
};

export function sortCategories(categories) {
  const rank = (slug) => {
    const i = CATEGORY_ORDER.indexOf(slug);
    return i === -1 ? CATEGORY_ORDER.length : i;
  };
  return [...categories].sort((a, b) => rank(a.slug) - rank(b.slug));
}

export function shortName(category) {
  return CATEGORY_LABEL[category.slug] || category.name;
}
