import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { fallbackTo } from '../utils/images';

export default function ProductCard({ product }) {
  const { cart, addItem, updateItem } = useCart();
  const { user } = useAuth();
  const [inWishlist, setInWishlist] = useState(false);

  // Clothing/footwear need a size, so the card links to the product page instead of adding directly.
  const needsSize = product.sizes?.length > 0;
  const cartItem = needsSize ? null : cart.items.find((i) => i.productId === product.id && !i.size);

  const hasDiscount = product.original_price && parseFloat(product.original_price) > parseFloat(product.price);
  const discountPct = hasDiscount
    ? Math.round((1 - product.price / product.original_price) * 100)
    : null;

  async function handleAddToCart(e) {
    e.preventDefault();
    e.stopPropagation();
    await addItem(product.id, 1);
  }

  async function handleQuantityChange(e, delta) {
    e.preventDefault();
    e.stopPropagation();
    const newQty = cartItem.quantity + delta;
    await updateItem(product.id, Math.max(0, newQty));
  }

  async function toggleWishlist(e) {
    e.preventDefault();
    e.stopPropagation();
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
    <Link to={`/products/${product.slug}`} className="group block">
      <div className="relative aspect-square bg-emerald-light overflow-hidden rounded-sm mb-3">
        {user && (
          <button
            onClick={toggleWishlist}
            className="absolute top-3 right-3 z-10 w-7 h-7 rounded-full bg-[#0b0a08]/70 flex items-center justify-center hover:scale-110 transition-transform"
          >
            <span className={inWishlist ? 'text-coral' : 'text-ink/30'}>
              {inWishlist ? '♥' : '♡'}
            </span>
          </button>
        )}
        <img
          src={product.images?.[0]}
          alt={product.name}
          loading="lazy"
          className={`w-full h-full object-contain p-4 transition-all duration-300 group-hover:scale-105 ${
            product.images?.length > 1 ? 'group-hover:opacity-0' : ''
          }`}
          onError={fallbackTo(product.name)}
        />
        {product.images?.length > 1 && (
          <img
            src={product.images[1]}
            alt=""
            aria-hidden="true"
            loading="lazy"
            className="absolute inset-0 w-full h-full object-contain p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        )}
        {(hasDiscount || product.sale) && (
          <span className="absolute top-3 left-3 flex flex-col items-start gap-1">
            {hasDiscount && (
              <span className="bg-coral text-paper text-xs font-mono px-2 py-1 rounded-sm">-{discountPct}%</span>
            )}
            {product.sale && (
              <span className="bg-gold text-ink text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-sm">
                Sale
              </span>
            )}
          </span>
        )}
      </div>

      {product.brand && (
        <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink/40 mb-1 line-clamp-1">{product.brand}</p>
      )}
      <h3 className="font-medium text-sm mb-1 line-clamp-2 min-h-[2.5rem]" title={product.name}>{product.name}</h3>

      <div className="flex items-center gap-2 mb-2">
        <span className="text-gold text-xs">★ {parseFloat(product.rating).toFixed(1)}</span>
        {product.review_count != null && (
          <span className="text-ink/40 text-xs">({Number(product.review_count).toLocaleString('en-IN')})</span>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2">
        <div className="price-tag pl-3 text-sm font-semibold">
          ₹{parseFloat(product.price).toLocaleString('en-IN')}
          {hasDiscount && (
            <span className="text-ink/40 font-normal line-through ml-2 text-xs">
              ₹{parseFloat(product.original_price).toLocaleString('en-IN')}
            </span>
          )}
        </div>

        {needsSize ? (
          <span className="text-xs border border-ink/20 rounded-sm px-2 py-1 group-hover:border-emerald transition-colors">
            Select size
          </span>
        ) : cartItem ? (
          <div className="flex items-center gap-2 border border-emerald rounded-sm">
            <button
              onClick={(e) => handleQuantityChange(e, -1)}
              className="w-6 h-6 flex items-center justify-center text-emerald hover:bg-emerald-light transition-colors"
            >
              −
            </button>
            <span className="text-xs font-mono w-4 text-center">{cartItem.quantity}</span>
            <button
              onClick={(e) => handleQuantityChange(e, 1)}
              className="w-6 h-6 flex items-center justify-center text-emerald hover:bg-emerald-light transition-colors"
            >
              +
            </button>
          </div>
        ) : (
          <button
            onClick={handleAddToCart}
            className="text-xs border border-ink/20 rounded-sm px-2 py-1 hover:bg-emerald hover:text-paper hover:border-emerald transition-colors"
          >
            Add
          </button>
        )}
      </div>
    </Link>
  );
}