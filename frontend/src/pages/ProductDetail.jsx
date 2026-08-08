import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import ProductCard from '../components/ProductCard';

export default function ProductDetail() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [inWishlist, setInWishlist] = useState(false);
  const { addItem } = useCart();
  const { user } = useAuth();

  useEffect(() => {
    setData(null);
    api.get(`/products/${slug}`).then((res) => setData(res.data));
  }, [slug]);

  if (!data) return <div className="max-w-6xl mx-auto px-6 py-20 text-ink/40 text-sm">Loading...</div>;

  const { product, reviews, related } = data;
  const hasDiscount = product.original_price && parseFloat(product.original_price) > parseFloat(product.price);

  async function handleAddToCart() {
    await addItem(product.id, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  async function toggleWishlist() {
    if (!user) return;
    if (inWishlist) {
      await api.delete(`/wishlist/${product.id}`);
      setInWishlist(false);
    } else {
      await api.post(`/wishlist/${product.id}`);
      setInWishlist(true);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="grid md:grid-cols-2 gap-12 mb-16">
        <div className="aspect-square bg-emerald-light rounded-sm overflow-hidden">
          <img
            src={product.images?.[0]}
            alt={product.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = `https://placehold.co/500x500/0B6E4F/FAFAF7?text=${encodeURIComponent(product.name)}&font=roboto`;
            }}
          />
        </div>

        <div>
          <Link to={`/category/${product.category_slug}`} className="text-xs text-emerald font-mono uppercase">
            {product.category_name}
          </Link>
          <h1 className="text-3xl font-display font-semibold mt-2 mb-3">{product.name}</h1>

          <div className="flex items-center gap-2 mb-4">
            <span className="text-gold text-sm">★ {parseFloat(product.rating).toFixed(1)}</span>
            <span className="text-ink/40 text-sm">({product.review_count} reviews)</span>
          </div>

          <div className="price-tag pl-4 text-2xl font-semibold mb-6">
            ₹{parseFloat(product.price).toLocaleString('en-IN')}
            {hasDiscount && (
              <span className="text-ink/40 font-normal line-through ml-3 text-base">
                ₹{parseFloat(product.original_price).toLocaleString('en-IN')}
              </span>
            )}
          </div>

          <p className="text-ink/70 text-sm leading-relaxed mb-6">{product.description}</p>

          <p className="text-sm mb-6">
            {product.stock > 0 ? (
              <span className="text-emerald">In stock — {product.stock} available</span>
            ) : (
              <span className="text-coral">Out of stock</span>
            )}
          </p>

          <div className="flex items-center gap-4">
            <input
              type="number"
              min="1"
              max={product.stock}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="input-field w-20"
            />
            <button
              onClick={handleAddToCart}
              disabled={product.stock === 0}
              className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {added ? 'Added ✓' : 'Add to cart'}
            </button>
            {user && (
              <button
                onClick={toggleWishlist}
                className="w-11 h-11 rounded-sm border border-ink/20 flex items-center justify-center hover:border-coral transition-colors"
              >
                <span className={inWishlist ? 'text-coral' : 'text-ink/40'}>
                  {inWishlist ? '♥' : '♡'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      <section className="mb-16">
        <h2 className="text-xl font-display font-semibold mb-6">Reviews</h2>
        {reviews.length === 0 ? (
          <p className="text-ink/40 text-sm">No reviews yet.</p>
        ) : (
          <div className="space-y-6">
            {reviews.map((r) => (
              <div key={r.id} className="border-b border-line pb-6">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-gold text-sm">{'★'.repeat(r.rating)}</span>
                  <span className="font-medium text-sm">{r.title}</span>
                </div>
                <p className="text-ink/60 text-sm mb-1">{r.body}</p>
                <p className="text-ink/30 text-xs">— {r.user_name}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {related.length > 0 && (
        <section>
          <h2 className="text-xl font-display font-semibold mb-6">You may also like</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-10">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}