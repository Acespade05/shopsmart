import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import ProductCard from '../components/ProductCard';

export default function ProductList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const sort = searchParams.get('sort') || 'newest';
  const minPrice = searchParams.get('minPrice') || '';
  const maxPrice = searchParams.get('maxPrice') || '';
  const inStock = searchParams.get('inStock') === 'true';

  useEffect(() => {
    setLoading(true);
    const params = { sort };
    if (minPrice) params.minPrice = minPrice;
    if (maxPrice) params.maxPrice = maxPrice;
    if (inStock) params.inStock = 'true';

    api
    .get('/products', { params })
    .then((res) => {
      setProducts(res.data.products);
      setTotal(res.data.pagination.total);
    })
    .catch((err) => console.error('Failed to load products:', err))
    .finally(() => setLoading(false));
}, [sort, minPrice, maxPrice, inStock]);

  function updateParam(key, value) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="flex items-baseline justify-between mb-8">
        <h1 className="text-3xl font-display font-semibold">All products</h1>
        <span className="text-ink/40 text-sm font-mono">{total} items</span>
      </div>

      <div className="flex gap-10">
        <aside className="w-48 shrink-0 space-y-8">
          <div>
            <h3 className="font-medium text-sm mb-3">Sort by</h3>
            <select
              value={sort}
              onChange={(e) => updateParam('sort', e.target.value)}
              className="input-field text-sm"
            >
              <option value="newest">Newest</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="rating">Highest Rated</option>
            </select>
          </div>

          <div>
            <h3 className="font-medium text-sm mb-3">Price range</h3>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Min"
                value={minPrice}
                onChange={(e) => updateParam('minPrice', e.target.value)}
                className="input-field text-sm"
              />
              <input
                type="number"
                placeholder="Max"
                value={maxPrice}
                onChange={(e) => updateParam('maxPrice', e.target.value)}
                className="input-field text-sm"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={inStock}
              onChange={(e) => updateParam('inStock', e.target.checked ? 'true' : '')}
            />
            In stock only
          </label>
        </aside>

        <div className="flex-1">
          {loading ? (
            <p className="text-ink/40 text-sm">Loading products...</p>
          ) : products.length === 0 ? (
            <p className="text-ink/40 text-sm">No products match these filters.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-10">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}