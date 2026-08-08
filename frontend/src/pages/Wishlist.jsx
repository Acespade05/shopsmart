import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

export default function Wishlist() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { addItem } = useCart();

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    api
      .get('/wishlist')
      .then((res) => setItems(res.data.wishlist))
      .catch((err) => console.error('Failed to load wishlist:', err))
      .finally(() => setLoading(false));
  }, [user]);

  async function handleRemove(productId) {
    await api.delete(`/wishlist/${productId}`);
    setItems(items.filter((i) => i.id !== productId));
  }

  async function handleMoveToCart(productId) {
    await addItem(productId, 1);
    await handleRemove(productId);
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <h1 className="text-3xl font-display font-semibold mb-3">Sign in to view your wishlist</h1>
        <Link to="/login" className="btn-primary inline-block mt-4">
          Sign in
        </Link>
      </div>
    );
  }

  if (loading) return <div className="max-w-6xl mx-auto px-6 py-20 text-ink/40 text-sm">Loading...</div>;

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-display font-semibold mb-8">Your wishlist</h1>

      {items.length === 0 ? (
        <p className="text-ink/40 text-sm">Nothing saved yet. Browse products and tap the heart to save items here.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-10">
          {items.map((item) => (
            <div key={item.wishlist_id}>
              <Link to={`/products/${item.slug}`} className="block">
                <div className="aspect-square bg-emerald-light rounded-sm overflow-hidden mb-3">
                  <img
                    src={item.images?.[0]}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = `https://placehold.co/500x500/0B6E4F/FAFAF7?text=${encodeURIComponent(item.name)}&font=roboto`;
                    }}
                  />
                </div>
                <p className="font-medium text-sm mb-1">{item.name}</p>
                <p className="price-tag pl-3 text-sm font-semibold mb-3">
                  ₹{parseFloat(item.price).toLocaleString('en-IN')}
                </p>
              </Link>
              <div className="flex gap-2">
                <button
                  onClick={() => handleMoveToCart(item.id)}
                  className="btn-secondary text-xs flex-1 py-1.5"
                >
                  Move to cart
                </button>
                <button
                  onClick={() => handleRemove(item.id)}
                  className="text-ink/40 hover:text-coral text-xs px-2"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}