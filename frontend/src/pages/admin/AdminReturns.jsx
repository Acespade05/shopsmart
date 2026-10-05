import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { fmtINR } from '../../utils/money';

const statuses = ['requested', 'approved', 'rejected', 'refunded'];

export default function AdminReturns() {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api
      .get('/admin/returns')
      .then((res) => setReturns(res.data.returns))
      .catch((err) => console.error('Failed to load returns:', err))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function updateStatus(id, status) {
    try {
      await api.put(`/admin/returns/${id}`, { status });
      load();
    } catch (err) {
      console.error('Failed to update return:', err);
    }
  }

  if (loading) return <p className="text-ink/40 text-sm">Loading...</p>;
  if (returns.length === 0) return <p className="text-ink/40 text-sm">No return requests yet.</p>;

  return (
    <div className="border border-line rounded-sm divide-y divide-line">
      {returns.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center justify-between px-4 py-3 text-sm gap-4">
          <span className="font-mono w-16">#{r.order_id}</span>
          <span className="flex-1 min-w-[200px]">
            {r.customer_name} <span className="text-ink/40">({r.customer_email})</span>
            <span className="block text-xs text-ink/60 mt-1">
              {r.reason}
              {r.details ? ` — ${r.details}` : ''}
            </span>
          </span>
          <span className="text-xs text-ink/40">{new Date(r.created_at).toLocaleDateString('en-IN')}</span>
          <span className="font-mono">₹{fmtINR(parseFloat(r.total))}</span>
          <select value={r.status} onChange={(e) => updateStatus(r.id, e.target.value)} className="input-field w-32 text-xs">
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      ))}
      <p className="px-4 py-3 text-[11px] text-ink/40">
        Approving a return doesn&apos;t change stock or the order; mark it refunded once the money is returned.{' '}
        <Link to="/admin?tab=orders" className="text-emerald hover:underline">
          View orders →
        </Link>
      </p>
    </div>
  );
}
