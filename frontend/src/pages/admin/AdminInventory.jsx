import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { fallbackTo } from '../../utils/images';
import { fmtINR } from '../../utils/money';

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'low', label: 'Low stock (<10)' },
  { key: 'out', label: 'Out of stock' },
];

export default function AdminInventory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = searchParams.get('filter') || '';
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    api
      .get('/admin/inventory')
      .then((res) => setInventory(res.data.inventory))
      .catch(() => setError('Failed to load inventory'))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function setFilter(key) {
    const next = new URLSearchParams(searchParams);
    if (key) next.set('filter', key);
    else next.delete('filter');
    setSearchParams(next, { replace: true });
  }

  async function saveStock(id) {
    const value = parseInt(editValue, 10);
    if (Number.isNaN(value) || value < 0) {
      setError('Stock must be 0 or more');
      return;
    }
    try {
      await api.put(`/admin/inventory/${id}`, { stock: value, reason: 'adjustment' });
      setEditingId(null);
      setError('');
      load();
    } catch {
      setError('Failed to update stock');
    }
  }

  const counts = useMemo(
    () => ({
      '': inventory.length,
      low: inventory.filter((i) => i.stock > 0 && i.stock < 10).length,
      out: inventory.filter((i) => i.stock <= 0).length,
    }),
    [inventory]
  );

  const shown = inventory.filter((item) => {
    if (filter === 'low' && !(item.stock > 0 && item.stock < 10)) return false;
    if (filter === 'out' && item.stock > 0) return false;
    if (query) {
      const q = query.toLowerCase();
      return [item.name, item.brand, item.category_name, item.sku].some((v) => v && v.toLowerCase().includes(q));
    }
    return true;
  });

  if (loading) return <p className="text-ink/40 text-sm">Loading...</p>;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, brand, category, SKU…"
          aria-label="Search products"
          className="input-field max-w-xs"
        />
        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key || 'all'}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 text-xs rounded-sm border transition-colors ${
                filter === f.key ? 'border-emerald text-emerald' : 'border-line text-ink/50 hover:text-ink'
              }`}
            >
              {f.label} <span className="font-mono opacity-60">{counts[f.key]}</span>
            </button>
          ))}
        </div>
      </div>
      {error && <p className="text-coral text-xs mb-4">{error}</p>}

      <div className="border border-line rounded-sm divide-y divide-line">
        {shown.map((item) => (
          <div key={item.id} className="flex flex-wrap items-center px-4 py-3 text-sm gap-x-4 gap-y-2">
            <img
              src={item.image}
              alt=""
              className="w-10 h-10 object-contain bg-emerald-light rounded-sm shrink-0"
              onError={fallbackTo(item.name)}
            />
            <div className="flex-1 min-w-[180px]">
              <Link to={`/products/${item.slug}`} className="hover:text-emerald line-clamp-1">
                {item.name}
              </Link>
              <p className="text-[11px] text-ink/40">
                {[item.brand, item.category_name, `₹${fmtINR(item.price)}`].filter(Boolean).join(' · ')}
              </p>
            </div>
            {item.stock <= 0 ? (
              <span className="text-xs bg-coral/10 text-coral px-2 py-0.5 rounded-sm">Out of stock</span>
            ) : item.low_stock ? (
              <span className="text-xs bg-coral/10 text-coral px-2 py-0.5 rounded-sm">Low stock</span>
            ) : null}
            {editingId === item.id ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveStock(item.id)}
                  className="input-field w-20 text-sm"
                  aria-label={`Stock for ${item.name}`}
                  autoFocus
                />
                <button onClick={() => saveStock(item.id)} className="text-emerald text-xs">
                  Save
                </button>
                <button onClick={() => setEditingId(null)} className="text-ink/40 text-xs">
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setEditingId(item.id);
                  setEditValue(item.stock);
                }}
                title="Click to change stock"
                className="font-mono text-sm hover:text-emerald w-16 text-right"
              >
                {item.stock}
              </button>
            )}
          </div>
        ))}
        {shown.length === 0 && <p className="text-ink/40 text-sm p-4">No products match.</p>}
      </div>
      <p className="text-[11px] text-ink/40 mt-3">Click a stock number to change it. Every change is recorded in the inventory log.</p>
    </div>
  );
}
