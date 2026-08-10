import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../services/api';
import ProductCard from '../components/ProductCard';

export default function Search() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!query) {
      setProducts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .get('/products/search', { params: { q: query } })
      .then((res) => setProducts(res.data.products))
      .catch((err) => console.error('Search failed:', err))
      .finally(() => setLoading(false));
  }, [query]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <p className="font-mono text-xs tracking-widest text-emerald uppercase mb-2">Search results</p>
      <h1 className="text-3xl font-display font-semibold mb-8">
        {query ? `"${query}"` : 'Search'}
      </h1>

      {loading ? (
        <p className="text-ink/40 text-sm">Searching...</p>
      ) : !query ? (
        <p className="text-ink/40 text-sm">Type something in the search bar above to find products.</p>
      ) : products.length === 0 ? (
        <div>
          <p className="text-ink/60 text-sm mb-4">
            No products found for "{query}".
          </p>
          <Link to="/products" className="text-emerald text-sm hover:underline">
            Browse all products instead →
          </Link>
        </div>
      ) : (
        <>
          <p className="text-ink/40 text-sm mb-6">{products.length} result{products.length !== 1 ? 's' : ''}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-10">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}