import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { itemCount } = useCart();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  function handleSearch(e) {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  }

  return (
    <header className="border-b border-line bg-paper sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-8">
        <Link to="/" className="font-display text-2xl font-semibold tracking-tight shrink-0">
          Shop<span className="text-emerald">Smart</span>
        </Link>

        <form onSubmit={handleSearch} className="flex-1 max-w-md">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products..."
            className="input-field"
          />
        </form>

        <nav className="flex items-center gap-6 text-sm font-medium ml-auto">
          <Link to="/products" className="hover:text-emerald transition-colors">
            Shop
          </Link>
          <Link to="/wishlist" className="hover:text-emerald transition-colors">
            Wishlist
          </Link>
          <Link to="/activity" className="hover:text-emerald transition-colors">
            Live
          </Link>
          <Link to="/cart" className="relative hover:text-emerald transition-colors">
            Cart
            {itemCount > 0 && (
              <span className="absolute -top-2 -right-3 bg-coral text-paper text-[10px] font-mono rounded-full w-4 h-4 flex items-center justify-center">
                {itemCount}
              </span>
            )}
          </Link>

          {user ? (
  <div className="flex items-center gap-4">
    <Link to="/orders" className="hover:text-emerald transition-colors">
      Orders
    </Link>
    <Link to="/profile" className="hover:text-emerald transition-colors">
      Profile
    </Link>
    {user.role === 'admin' && (
      <Link to="/admin" className="hover:text-emerald transition-colors">
        Admin
      </Link>
    )}
    <button
      onClick={() => {
        logout();
        navigate('/');
      }}
      className="text-ink/60 hover:text-ink transition-colors"
    >
      Log out
    </button>
  </div>
) : (
            <Link to="/login" className="btn-primary">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}