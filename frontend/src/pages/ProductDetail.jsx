import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import ProductRow from '../components/ProductRow';
import ImageGallery from '../components/ImageGallery';
import Reviews from '../components/Reviews';
import { estimateDelivery, formatDeliveryDate, isValidPincode, savedPincode, savePincode } from '../utils/delivery';

const inr = (n) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

function DeliveryCheck({ shippingInfo }) {
  const [pin, setPin] = useState(savedPincode());
  const [checked, setChecked] = useState(isValidPincode(savedPincode()) ? savedPincode() : '');
  const [error, setError] = useState('');
  const estimate = checked ? estimateDelivery(checked) : null;

  function check(e) {
    e.preventDefault();
    if (!isValidPincode(pin)) {
      setError('Enter a valid 6-digit PIN code');
      setChecked('');
      return;
    }
    setError('');
    setChecked(pin);
    savePincode(pin);
  }

  return (
    <div className="border border-[#f3eee3]/10 rounded-sm p-5">
      <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-[#e3a857] mb-3">Delivery</p>
      <form onSubmit={check} className="flex gap-2">
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          placeholder="Enter PIN code"
          aria-label="PIN code"
          className="flex-1 bg-transparent border border-[#f3eee3]/15 px-3 py-2.5 text-sm text-[#f3eee3] placeholder:text-[#f3eee3]/25 outline-none focus:border-[#e3a857]/60 rounded-sm"
        />
        <button className="px-4 text-xs tracking-[0.15em] uppercase text-[#e3a857] border border-[#e3a857]/40 hover:bg-[#e3a857] hover:text-[#0b0a08] transition-colors rounded-sm">
          Check
        </button>
      </form>
      {error && <p className="text-xs text-[#e8604c] mt-2">{error}</p>}
      {estimate && (
        <p className="text-sm mt-3 text-[#f3eee3]/80">
          Free delivery by <span className="text-[#f3eee3] font-medium">{formatDeliveryDate(estimate.by)}</span>
          <span className="text-[#f3eee3]/40"> to {checked} · {estimate.min}–{estimate.max} days</span>
        </p>
      )}
      {!estimate && !error && shippingInfo && <p className="text-xs mt-3 text-[#f3eee3]/40">{shippingInfo}</p>}
    </div>
  );
}

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { user } = useAuth();

  const [data, setData] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [size, setSize] = useState('');
  const [sizeError, setSizeError] = useState(false);
  const [added, setAdded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [inWishlist, setInWishlist] = useState(false);

  const load = useCallback(() => {
    return api
      .get(`/products/${slug}`)
      .then((res) => setData(res.data))
      .catch(() => setNotFound(true));
  }, [slug]);

  useEffect(() => {
    setData(null);
    setNotFound(false);
    setQuantity(1);
    setSize('');
    setSizeError(false);
    load();
    window.scrollTo(0, 0);
  }, [load]);

  // Is this product already in the shopper's wishlist?
  useEffect(() => {
    if (!user || !data) return;
    api
      .get('/wishlist')
      .then((res) => setInWishlist(res.data.wishlist.some((w) => w.id === data.product.id)))
      .catch(() => {});
  }, [user, data]);

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#0b0a08] text-[#f3eee3]">
        <div className="max-w-6xl mx-auto px-6 py-24 text-center">
          <p className="font-display text-3xl">Product not found.</p>
          <Link to="/products" className="inline-block mt-6 text-sm text-[#e3a857]">
            Browse all products →
          </Link>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0b0a08]">
        <div className="max-w-6xl mx-auto px-6 py-20 text-[#f3eee3]/40 text-sm">Loading…</div>
      </div>
    );
  }

  const { product, reviews, related } = data;
  const price = parseFloat(product.price);
  const mrp = product.original_price ? parseFloat(product.original_price) : null;
  const hasDiscount = mrp && mrp > price;
  const discountPct = hasDiscount ? Math.round((1 - price / mrp) * 100) : 0;
  const sizes = product.sizes || [];
  const needsSize = sizes.length > 0;
  const maxQty = Math.max(1, Math.min(product.stock, 10));
  const specs = {
    ...(product.specs || {}),
    Category: product.category_name,
    ...(product.return_policy ? { Returns: product.return_policy } : {}),
  };

  async function addToCart() {
    if (needsSize && !size) {
      setSizeError(true);
      return false;
    }
    setBusy(true);
    try {
      await addItem(product.id, quantity, needsSize ? size : undefined);
      setAdded(true);
      setTimeout(() => setAdded(false), 1800);
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function buyNow() {
    if (await addToCart()) navigate(user ? '/checkout' : '/cart');
  }

  async function toggleWishlist() {
    if (!user) {
      navigate('/login');
      return;
    }
    if (inWishlist) {
      await api.delete(`/wishlist/${product.id}`);
      setInWishlist(false);
    } else {
      await api.post(`/wishlist/${product.id}`);
      setInWishlist(true);
    }
  }

  return (
    <div className="min-h-screen bg-[#0b0a08] text-[#f3eee3]">
      <div className="max-w-7xl mx-auto px-6 pt-8 pb-4">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="text-[11px] text-[#f3eee3]/40 mb-8 flex flex-wrap gap-x-2 gap-y-1">
          <Link to="/" className="hover:text-[#e3a857]">Home</Link>
          <span>/</span>
          <Link to={`/category/${product.category_slug}`} className="hover:text-[#e3a857]">
            {product.category_name}
          </Link>
          {product.subcategory && (
            <>
              <span>/</span>
              <Link
                to={`/category/${product.category_slug}?sub=${encodeURIComponent(product.subcategory)}`}
                className="hover:text-[#e3a857]"
              >
                {product.subcategory}
              </Link>
            </>
          )}
          <span>/</span>
          <span className="text-[#f3eee3]/60 line-clamp-1">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-10 lg:gap-14">
          {/* ---------------- Gallery ---------------- */}
          <ImageGallery images={product.images || []} name={product.name} />

          {/* ---------------- Buy box ---------------- */}
          <div>
            {product.brand && (
              <Link
                to={`/products?brand=${encodeURIComponent(product.brand)}`}
                className="font-mono text-[11px] tracking-[0.2em] uppercase text-[#e3a857] hover:text-[#f0c07f]"
              >
                {product.brand}
              </Link>
            )}
            <h1 className="font-display text-3xl md:text-4xl font-semibold leading-tight mt-2">{product.name}</h1>

            <a href="#reviews" className="inline-flex items-center gap-2 mt-4 text-sm">
              <span className="bg-[#e3a857] text-[#0b0a08] text-xs font-semibold px-2 py-0.5 rounded-sm">
                {parseFloat(product.rating).toFixed(1)} ★
              </span>
              <span className="text-[#f3eee3]/45 hover:text-[#f3eee3]">
                {Number(product.review_count).toLocaleString('en-IN')} rating{Number(product.review_count) === 1 ? '' : 's'}
              </span>
            </a>

            {/* Price */}
            <div className="mt-6 pb-6 border-b border-[#f3eee3]/10">
              <div className="flex items-baseline gap-3 flex-wrap">
                {hasDiscount && <span className="text-2xl text-[#e8604c] font-light">-{discountPct}%</span>}
                <span className="text-3xl font-semibold font-mono">{inr(price)}</span>
              </div>
              {hasDiscount && (
                <p className="text-xs text-[#f3eee3]/40 mt-1">
                  M.R.P.: <span className="line-through">{inr(mrp)}</span>
                </p>
              )}
              <p className="text-[11px] text-[#f3eee3]/35 mt-1">Inclusive of all taxes</p>
            </div>

            {/* Offers — the same real offers the checkout applies */}
            <div className="py-5 border-b border-[#f3eee3]/10 space-y-2 text-xs text-[#f3eee3]/60">
              <p>
                <span className="text-[#e3a857]">Automatic savings</span> · 5% off above ₹500, 10% above ₹1,000,
                15% above ₹2,000 at checkout
              </p>
              <p>
                <span className="text-[#e3a857]">Coupon</span> · 10% off with code WELCOME10
              </p>
            </div>

            {/* Size */}
            {needsSize && (
              <div className="pt-6">
                <div className="flex items-baseline justify-between mb-3">
                  <p className="text-sm">
                    Size{size && <span className="text-[#f3eee3]/50">: {size}</span>}
                  </p>
                  {sizeError && <p className="text-xs text-[#e8604c]">Please select a size</p>}
                </div>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Size">
                  {sizes.map((s) => (
                    <button
                      key={s}
                      role="radio"
                      aria-checked={size === s}
                      onClick={() => {
                        setSize(s);
                        setSizeError(false);
                      }}
                      className={`min-w-[52px] px-3 py-2.5 text-xs rounded-sm border transition-colors ${
                        size === s
                          ? 'border-[#e3a857] text-[#e3a857] bg-[#e3a857]/10'
                          : sizeError
                            ? 'border-[#e8604c]/60 text-[#f3eee3]/70'
                            : 'border-[#f3eee3]/15 text-[#f3eee3]/70 hover:border-[#f3eee3]/50'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Stock + quantity + buttons */}
            <div className="pt-6">
              <p className="text-sm mb-4">
                {product.stock <= 0 ? (
                  <span className="text-[#e8604c]">Out of stock</span>
                ) : product.stock < 10 ? (
                  <span className="text-[#e3a857]">Only {product.stock} left in stock</span>
                ) : (
                  <span className="text-[#5fb8a6]">In stock</span>
                )}
              </p>

              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center border border-[#f3eee3]/15 rounded-sm">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="w-10 h-11 text-[#f3eee3]/70 hover:text-[#e3a857]"
                    aria-label="Decrease quantity"
                  >
                    −
                  </button>
                  <span className="w-8 text-center font-mono text-sm" aria-live="polite">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                    className="w-10 h-11 text-[#f3eee3]/70 hover:text-[#e3a857]"
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>

                <button
                  onClick={addToCart}
                  disabled={product.stock <= 0 || busy}
                  className="flex-1 min-w-[140px] h-11 rounded-sm border border-[#e3a857] text-[#e3a857] text-sm font-medium hover:bg-[#e3a857]/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {added ? 'Added to cart ✓' : 'Add to cart'}
                </button>
                <button
                  onClick={buyNow}
                  disabled={product.stock <= 0 || busy}
                  className="flex-1 min-w-[140px] h-11 rounded-sm text-sm font-medium text-[#0b0a08] bg-gradient-to-r from-[#f0c07f] to-[#e3a857] hover:from-[#e3a857] hover:to-[#c98a34] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Buy now
                </button>
                <button
                  onClick={toggleWishlist}
                  aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
                  title={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
                  className="w-11 h-11 rounded-sm border border-[#f3eee3]/15 flex items-center justify-center hover:border-[#e8604c] transition-colors"
                >
                  <span className={inWishlist ? 'text-[#e8604c]' : 'text-[#f3eee3]/50'}>{inWishlist ? '♥' : '♡'}</span>
                </button>
              </div>
            </div>

            {/* Delivery + services */}
            <div className="mt-8 space-y-4">
              <DeliveryCheck shippingInfo={product.shipping_info} />
              <div className="grid grid-cols-3 gap-px bg-[#f3eee3]/10 border border-[#f3eee3]/10 rounded-sm overflow-hidden text-center">
                {[
                  ['Free delivery', 'On every order'],
                  [product.return_policy || 'Easy returns', 'Return policy'],
                  [product.warranty || 'Secure checkout', product.warranty ? 'Warranty' : 'UPI · Cards · Netbanking'],
                ].map(([title, sub]) => (
                  <div key={sub} className="bg-[#0b0a08] px-2 py-4">
                    <p className="text-[11px] text-[#f3eee3]/80 leading-snug">{title}</p>
                    <p className="text-[10px] text-[#f3eee3]/35 mt-1">{sub}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ---------------- Details ---------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mt-20 pt-12 border-t border-[#f3eee3]/10">
          <section>
            <h2 className="font-display text-2xl font-semibold mb-5">About this item</h2>
            <p className="text-sm leading-7 text-[#f3eee3]/65">{product.description}</p>
            {product.tags?.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-6">
                {product.tags.map((t) => (
                  <Link
                    key={t}
                    to={`/search?q=${encodeURIComponent(t)}`}
                    className="text-[11px] px-3 py-1 rounded-full border border-[#f3eee3]/10 text-[#f3eee3]/45 hover:text-[#e3a857] hover:border-[#e3a857]/40"
                  >
                    {t}
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold mb-5">Specifications</h2>
            <table className="w-full text-sm">
              <tbody>
                {Object.entries(specs)
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <tr key={k} className="border-b border-[#f3eee3]/[0.07]">
                      <th scope="row" className="text-left font-normal text-[#f3eee3]/45 py-3 pr-6 w-2/5 align-top">
                        {k}
                      </th>
                      <td className="py-3 text-[#f3eee3]/85">{v}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </section>
        </div>

        <Reviews product={product} reviews={reviews} onChange={load} />
      </div>

      {related?.length > 0 && (
        <ProductRow eyebrow="More like this" title="You may also like" products={related} loading={false} />
      )}
    </div>
  );
}
