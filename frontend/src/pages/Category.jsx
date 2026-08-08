import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import ProductCard from '../components/ProductCard';

export default function Category() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/categories/${slug}`)
      .then((res) => setData(res.data))
      .catch((err) => console.error('Failed to load category:', err))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <div className="max-w-6xl mx-auto px-6 py-20 text-ink/40 text-sm">Loading...</div>;
  if (!data) return <div className="max-w-6xl mx-auto px-6 py-20 text-ink/40 text-sm">Category not found.</div>;

  const { category, products } = data;

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <p className="font-mono text-xs tracking-widest text-emerald uppercase mb-2">Category</p>
      <h1 className="text-3xl font-display font-semibold mb-2">{category.name}</h1>
      <p className="text-ink/60 mb-10">{category.description}</p>

      {products.length === 0 ? (
        <p className="text-ink/40 text-sm">No products in this category yet.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-10">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}