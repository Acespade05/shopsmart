import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import ProductCard from '../components/ProductCard';

export default function Home() {
  const [categories, setCategories] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/categories'), api.get('/products?sort=rating&limit=8')])
      .then(([catRes, prodRes]) => {
        setCategories(catRes.data.categories);
        setFeatured(prodRes.data.products);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-20 text-center">
        <p className="font-mono text-xs tracking-widest text-emerald uppercase mb-4">
          Five categories, one catalog
        </p>
        <h1 className="text-5xl md:text-6xl font-display font-semibold leading-tight mb-6">
          Everything you need,
          <br />
          nothing you don't.
        </h1>
        <p className="text-ink/60 max-w-md mx-auto mb-8">
          Curated electronics, apparel, home goods, books, and sports gear —
          shipped fast, priced fair.
        </p>
        <Link to="/products" className="btn-primary inline-block">
          Browse all products
        </Link>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              to={`/category/${cat.slug}`}
              className="border border-line rounded-sm p-5 text-center hover:border-emerald hover:bg-emerald-light transition-colors"
            >
              <p className="font-medium text-sm mb-1">{cat.name}</p>
              <p className="text-ink/40 text-xs font-mono">{cat.product_count} items</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="flex items-baseline justify-between mb-8">
          <h2 className="text-2xl font-display font-semibold">Top rated</h2>
          <Link to="/products?sort=rating" className="text-sm text-emerald hover:underline">
            View all
          </Link>
        </div>

        {loading ? (
          <p className="text-ink/40 text-sm">Loading products...</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-10">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}