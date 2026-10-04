import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import api from '../services/api';
import { sortCategories, shortName } from '../utils/categories';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { itemCount } = useCart();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    api
      .get('/categories')
      .then((res) => setCategories(sortCategories(res.data.categories)))
      .catch(() => {});
  }, []);

  function handleSearch(e) {
    e.preventDefault();

    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  }

  return (
    <header
      className="
        sticky
        top-0
        z-40
        bg-[#0b0a08]/95
        backdrop-blur-md
        border-b
        border-[#f3eee3]/10
      "
    >
      <div
        className="
          max-w-7xl
          mx-auto
          px-6
          py-4
          flex
          items-center
          gap-8
        "
      >

        {/* =================================================
            LOGO
        ================================================== */}

        <Link
          to="/"
          className="
            shrink-0
            font-display
            text-2xl
            md:text-3xl
            font-semibold
            tracking-[-0.04em]
            text-[#f3eee3]
            hover:text-[#e3a857]
            transition-colors
          "
        >
          Shop<span className="text-[#e3a857]">Smart</span>
        </Link>


        {/* =================================================
            SEARCH
        ================================================== */}

        <form
          onSubmit={handleSearch}
          className="
            flex-1
            max-w-md
            hidden
            md:block
          "
        >
          <div className="relative">

            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products..."
              className="
                w-full
                bg-[#14120f]
                border
                border-[#f3eee3]/10
                text-[#f3eee3]
                placeholder:text-[#f3eee3]/25
                text-xs
                px-4
                py-3
                outline-none
                transition-all
                focus:border-[#e3a857]/50
              "
            />

          </div>
        </form>


        {/* =================================================
            NAVIGATION
        ================================================== */}

        <nav
          className="
            flex
            items-center
            gap-5
            md:gap-7
            text-xs
            font-medium
            ml-auto
            text-[#f3eee3]/60
          "
        >

          <Link
            to="/products"
            className="
              hover:text-[#e3a857]
              transition-colors
            "
          >
            Shop
          </Link>


          <Link
            to="/wishlist"
            className="
              hidden
              md:block
              hover:text-[#e3a857]
              transition-colors
            "
          >
            Wishlist
          </Link>


          <Link
            to="/activity"
            className="
              hidden
              md:block
              hover:text-[#e3a857]
              transition-colors
            "
          >
            Live
          </Link>


          {/* =================================================
              CART
          ================================================== */}

          <Link
            to="/cart"
            className="
              relative
              hover:text-[#e3a857]
              transition-colors
            "
          >
            Cart

            {itemCount > 0 && (
              <span
                className="
                  absolute
                  -top-2
                  -right-3
                  bg-[#e3a857]
                  text-[#0b0a08]
                  text-[9px]
                  font-mono
                  rounded-full
                  w-4
                  h-4
                  flex
                  items-center
                  justify-center
                "
              >
                {itemCount}
              </span>
            )}
          </Link>


          {/* =================================================
              LOGGED-IN USER
          ================================================== */}

          {user ? (

            <div className="flex items-center gap-5">

              <Link
                to="/orders"
                className="
                  hidden
                  md:block
                  hover:text-[#e3a857]
                  transition-colors
                "
              >
                Orders
              </Link>


              <Link
                to="/profile"
                className="
                  hidden
                  md:block
                  hover:text-[#e3a857]
                  transition-colors
                "
              >
                Profile
              </Link>


              {user.role === 'admin' && (
                <Link
                  to="/admin"
                  className="
                    hidden
                    md:block
                    hover:text-[#e3a857]
                    transition-colors
                  "
                >
                  Admin
                </Link>
              )}


              <button
                onClick={() => {
                  logout();
                  navigate('/');
                }}
                className="
                  text-[#f3eee3]/40
                  hover:text-[#f3eee3]
                  transition-colors
                "
              >
                Log out
              </button>

            </div>

          ) : (

            /* =================================================
                SIGN IN
            ================================================== */

            <Link
              to="/login"
              className="
                border
                border-[#f3eee3]/20
                px-4
                py-2
                text-[10px]
                tracking-[0.15em]
                uppercase
                text-[#f3eee3]/70
                hover:bg-[#f3eee3]
                hover:text-[#0b0a08]
                hover:border-[#f3eee3]
                transition-all
              "
            >
              Sign in
            </Link>

          )}

        </nav>

      </div>


      {/* =================================================
          MOBILE SEARCH
      ================================================== */}

      <form onSubmit={handleSearch} className="md:hidden px-6 pb-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products..."
          className="w-full bg-[#14120f] border border-[#f3eee3]/10 text-[#f3eee3] placeholder:text-[#f3eee3]/25 text-xs px-4 py-3 outline-none focus:border-[#e3a857]/50"
        />
      </form>


      {/* =================================================
          CATEGORY MENU
          Hover a category (desktop) to see its subcategories.
      ================================================== */}

      {categories.length > 0 && (
        <div className="border-t border-[#f3eee3]/[0.06]">
          <nav
            aria-label="Categories"
            className="max-w-7xl mx-auto px-6 flex items-center gap-7 overflow-x-auto md:overflow-visible text-[11px] tracking-[0.08em] text-[#f3eee3]/55 [scrollbar-width:none]"
          >
            {categories.map((cat) => (
              <div key={cat.slug} className="relative group shrink-0">
                <NavLink
                  to={`/category/${cat.slug}`}
                  className={({ isActive }) =>
                    `block py-3 whitespace-nowrap border-b transition-colors ${
                      isActive
                        ? 'text-[#e3a857] border-[#e3a857]'
                        : 'border-transparent hover:text-[#f3eee3]'
                    }`
                  }
                >
                  {shortName(cat)}
                </NavLink>

                {cat.subcategories?.length > 0 && (
                  <div className="absolute left-0 top-full z-50 hidden md:group-hover:block pt-px">
                    <div className="min-w-[230px] bg-[#14120f] border border-[#f3eee3]/10 shadow-[0_20px_40px_rgba(0,0,0,0.5)] py-3">
                      <p className="px-5 pb-2 font-mono text-[9px] tracking-[0.25em] uppercase text-[#e3a857]/80">
                        {cat.name}
                      </p>
                      {cat.subcategories.map((sub) => (
                        <Link
                          key={sub}
                          to={`/category/${cat.slug}?sub=${encodeURIComponent(sub)}`}
                          className="block px-5 py-2 text-xs tracking-normal text-[#f3eee3]/60 hover:text-[#e3a857] hover:bg-[#f3eee3]/[0.03] transition-colors"
                        >
                          {sub}
                        </Link>
                      ))}
                      <Link
                        to={`/category/${cat.slug}`}
                        className="block px-5 pt-3 mt-2 border-t border-[#f3eee3]/[0.06] text-[11px] text-[#f3eee3]/40 hover:text-[#e3a857] transition-colors"
                      >
                        View all {shortName(cat).toLowerCase()} →
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            ))}

            <Link
              to="/products?sort=discount"
              className="shrink-0 ml-auto py-3 whitespace-nowrap text-[#e3a857] hover:text-[#f0c07f] transition-colors"
            >
              Today&apos;s deals
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
