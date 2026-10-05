import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import DiscountProgress from '../components/DiscountProgress';

export default function Cart() {
  const { cart, subtotal, updateItem, removeItem } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  if (cart.items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <h1 className="text-3xl font-display font-semibold mb-3">Your cart is empty</h1>
        <p className="text-ink/60 mb-8">Browse the catalog and find something you like.</p>
        <Link to="/products" className="btn-primary inline-block">
          Browse products
        </Link>
      </div>
    );
  }

  function handleCheckout() {
    if (!user) {
      navigate('/login');
      return;
    }
    navigate('/checkout');
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-display font-semibold mb-6">Your cart</h1>

      <div className="mb-8">
        <DiscountProgress subtotal={subtotal} />
      </div>

      <div className="space-y-6 mb-10">
        {cart.items.map((item) => (
          <div key={`${item.productId}-${item.size || ''}`} className="flex items-center gap-4 border-b border-line pb-6">
            <img src={item.image} alt={item.name} className="w-20 h-20 object-cover rounded-sm bg-emerald-light" />

            <div className="flex-1">
              <p className="font-medium text-sm mb-1">{item.name}</p>
              {item.size && <p className="text-xs text-ink/50 mb-1">Size: {item.size}</p>}
              <p className="price-tag pl-3 text-sm">₹{item.price.toLocaleString('en-IN')}</p>
            </div>

            <input
              type="number"
              min="1"
              value={item.quantity}
              onChange={(e) => updateItem(item.productId, Math.max(1, parseInt(e.target.value, 10) || 1), item.size)}
              className="input-field w-16 text-center"
            />

            <p className="w-24 text-right font-mono text-sm">
              ₹{(item.price * item.quantity).toLocaleString('en-IN')}
            </p>

            <button
              onClick={() => removeItem(item.productId, item.size)}
              className="text-ink/40 hover:text-coral text-sm transition-colors"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <div className="w-64">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-ink/60">Subtotal</span>
            <span className="font-mono">₹{subtotal.toLocaleString('en-IN')}</span>
          </div>
          <p className="text-xs text-ink/40 mb-4">Final discount calculated at checkout.</p>
          <button onClick={handleCheckout} className="btn-primary w-full">
            Proceed to checkout
          </button>
        </div>
      </div>
    </div>
  );
}