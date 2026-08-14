import { useEffect, useState } from 'react';
import api from '../../services/api';

export default function AdminDiscounts() {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: '', type: 'percentage', value: '', minOrderValue: '' });
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    api
      .get('/admin/discount-codes')
      .then((res) => setCodes(res.data.discountCodes))
      .catch((err) => console.error('Failed to load discount codes:', err))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/admin/discount-codes', {
        code: form.code,
        type: form.type,
        value: parseFloat(form.value),
        minOrderValue: parseFloat(form.minOrderValue) || 0,
      });
      setForm({ code: '', type: 'percentage', value: '', minOrderValue: '' });
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create code');
    }
  }

  const manualCodes = codes.filter((c) => !c.code.startsWith('TIER'));
  const tierCodes = codes.filter((c) => c.code.startsWith('TIER'));

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-lg">Manual codes</h2>
          <button onClick={() => setShowForm(!showForm)} className="text-emerald text-sm hover:underline">
            {showForm ? 'Cancel' : '+ New code'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="border border-line rounded-sm p-4 space-y-3 mb-4">
            {error && <p className="text-coral text-sm">{error}</p>}
            <div className="grid grid-cols-2 gap-3">
              <input
                placeholder="CODE"
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                className="input-field"
              />
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="input-field"
              >
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed amount</option>
              </select>
              <input
                type="number"
                placeholder="Value"
                required
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                className="input-field"
              />
              <input
                type="number"
                placeholder="Min order value"
                value={form.minOrderValue}
                onChange={(e) => setForm({ ...form, minOrderValue: e.target.value })}
                className="input-field"
              />
            </div>
            <button type="submit" className="btn-primary">
              Create
            </button>
          </form>
        )}

        {loading ? (
          <p className="text-ink/40 text-sm">Loading...</p>
        ) : (
          <div className="border border-line rounded-sm divide-y divide-line">
            {manualCodes.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="font-mono">{c.code}</span>
                <span>{c.type === 'percentage' ? `${c.value}%` : `₹${c.value}`} off</span>
                <span className="text-ink/40 text-xs">min ₹{c.min_order_value}</span>
                <span className="text-ink/40 text-xs">{c.used_count} used</span>
                <span className={c.is_active ? 'text-emerald text-xs' : 'text-ink/40 text-xs'}>
                  {c.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="font-display font-semibold text-lg mb-2">Automatic tiers</h2>
        <p className="text-ink/40 text-xs mb-4">
          Applied automatically at checkout based on cart subtotal — not user-entered.
        </p>
        <div className="border border-line rounded-sm divide-y divide-line">
          {tierCodes.map((c) => (
            <div key={c.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="font-mono">{c.code}</span>
              <span>{c.value}% off</span>
              <span className="text-ink/40 text-xs">spend ₹{c.min_order_value}+</span>
              <span className="text-ink/40 text-xs">{c.used_count} used</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}