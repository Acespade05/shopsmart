import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import ProductCard, { placeholder } from '../components/ProductCard';

export default function ProductDetail() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [inWishlist, setInWishlist] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const { addItem } = useCart();
  const { user } = useAuth();

  useEffect(() => {
    setData(null);
    setActiveImage(0);
    api.get(`/products/${slug}`).then((res) => setData(res.data));
  }, [slug]);

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0b0a08]">
        <div className="max-w-6xl mx-auto px-6 py-20 text-[#f3eee3]/40 text-sm">Loading...</div>
      </div>
    );
  }

  const { product, reviews, related } = data;
  const images = product.images?.length ? product.images : [placeholder(product.name)];
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
    <div className="min-h-screen bg-[#0b0a08] text-[#f3eee3] [&_.bg-emerald-light]:!bg-[#14120f] [&_.text-ink]:!text-[#f3eee3] [&_.text-ink\/80]:!text-[#f3eee3]/80 [&_.text-ink\/70]:!text-[#f3eee3]/70 [&_.text-ink\/60]:!text-[#f3eee3]/60 [&_.text-ink\/50]:!text-[#f3eee3]/50 [&_.text-ink\/40]:!text-[#f3eee3]/40 [&_.text-ink\/20]:!text-[#f3eee3]/20 [&_.border-ink\/20]:!border-[#f3eee3]/20 [&_.text-emerald]:!text-[#5fb8a6] [&_.border-emerald]:!border-[#e3a857]">
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="grid md:grid-cols-2 gap-12 mb-16">
        <div>
          <div className="aspect-square bg-emerald-light rounded-sm overflow-hidden">
            <img
              src={images[activeImage] || images[0]}
              alt={product.name}
              className="w-full h-full object-contain p-6"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = placeholder(product.name);
              }}
            />
          </div>
          {images.length > 1 && (
            <div className="flex gap-3 mt-4">
              {images.map((src, i) => (
                <button
                  key={src}
                  onClick={() => setActiveImage(i)}
                  onMouseEnter={() => setActiveImage(i)}
                  className={`w-16 h-16 rounded-sm overflow-hidden bg-emerald-light border-2 transition-colors ${
                    i === activeImage ? 'border-emerald' : 'border-transparent hover:border-ink/20'
                  }`}
                  aria-label={`View image ${i + 1}`}
                >
                  <img src={src} alt="" className="w-full h-full object-contain p-1" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <Link to={`/category/${product.category_slug}`} className="text-xs text-emerald font-mono uppercase">
            {product.category_name}
          </Link>
          {product.brand && (
            <p className="text-sm text-ink/50 mt-2">
              Brand: <span className="text-ink/80">{product.brand}</span>
            </p>
          )}
          <h1 className="text-3xl font-display font-semibold mt-2 mb-3">{product.name}</h1>

          <div className="flex items-center gap-2 mb-4">
            <span className="text-gold text-sm">★ {parseFloat(product.rating).toFixed(1)}</span>
            <span className="text-ink/40 text-sm">({Number(product.review_count).toLocaleString('en-IN')} ratings)</span>
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

          {(product.shipping_info || product.return_policy || product.warranty) && (
            <ul className="text-xs text-ink/60 space-y-1.5 mb-6">
              {product.shipping_info && <li>🚚 {product.shipping_info}</li>}
              {product.return_policy && <li>↩ {product.return_policy}</li>}
              {product.warranty && <li>🛡 {product.warranty}</li>}
            </ul>
          )}

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
              className="input-field w-20 !bg-transparent !text-[#f3eee3] !border-[#f3eee3]/20"
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
    </div>
  );
}
