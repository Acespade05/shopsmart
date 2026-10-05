import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { fallbackTo } from '../utils/images';

// Header search with suggestions as you type (products + matching categories).
export default function SearchBox({ className = '' }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1); // keyboard-highlighted suggestion
  const boxRef = useRef(null);

  // Debounced lookup: wait 200 ms after the last keystroke.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setProducts([]);
      return undefined;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      api
        .get('/products/search', { params: { q } })
        .then((res) => {
          if (!cancelled) {
            setProducts(res.data.products.slice(0, 6));
            setActive(-1);
          }
        })
        .catch(() => {});
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  // Close when clicking outside.
  useEffect(() => {
    function onDown(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  function goSearch() {
    const q = query.trim();
    if (!q) return;
    setOpen(false);
    navigate(`/search?q=${encodeURIComponent(q)}`);
  }

  function goProduct(p) {
    setOpen(false);
    setQuery('');
    navigate(`/products/${p.slug}`);
  }

  function onKeyDown(e) {
    if (!open || products.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(products.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(-1, i - 1));
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  const showPanel = open && query.trim().length >= 2;

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (active >= 0 && products[active]) goProduct(products[active]);
          else goSearch();
        }}
      >
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search products…"
          aria-label="Search products"
          aria-expanded={showPanel}
          aria-autocomplete="list"
          className="w-full bg-[#14120f] border border-[#f3eee3]/10 text-[#f3eee3] placeholder:text-[#f3eee3]/25 text-xs px-4 py-3 outline-none transition-all focus:border-[#e3a857]/50"
        />
      </form>

      {showPanel && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-[#14120f] border border-[#f3eee3]/10 shadow-[0_20px_40px_rgba(0,0,0,0.55)]">
          {products.length === 0 ? (
            <p className="px-4 py-4 text-xs text-[#f3eee3]/40">No matching products. Press Enter to search anyway.</p>
          ) : (
            <ul role="listbox">
              {products.map((p, i) => (
                <li key={p.id} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => goProduct(p)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      i === active ? 'bg-[#f3eee3]/[0.05]' : ''
                    }`}
                  >
                    <img
                      src={p.images?.[0]}
                      alt=""
                      className="w-9 h-9 object-contain bg-[#0b0a08] rounded-sm shrink-0"
                      onError={fallbackTo(p.name)}
                    />
                    <span className="flex-1 min-w-0 text-xs text-[#f3eee3]/80 line-clamp-1">{p.name}</span>
                    <span className="text-xs font-mono text-[#e3a857] shrink-0">
                      ₹{parseFloat(p.price).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={goSearch}
            className="w-full text-left px-4 py-3 border-t border-[#f3eee3]/[0.06] text-[11px] text-[#e3a857] hover:text-[#f0c07f]"
          >
            See all results for “{query.trim()}” →
          </button>
        </div>
      )}
    </div>
  );
}
