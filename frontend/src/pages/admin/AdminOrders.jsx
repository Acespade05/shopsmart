import { useEffect, useState } from 'react';
import api from '../../services/api';
import AdminReturns from './AdminReturns';
import { fmtINR } from '../../utils/money';

const statuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api
      .get('/admin/orders', { params: filter ? { status: filter } : {} })
      .then((res) => setOrders(res.data.orders))
      .catch((err) => console.error('Failed to load orders:', err))
      .finally(() => setLoading(false));
  }

  useEffect(load, [filter]);

  async function updateStatus(orderId, status) {
    try {
      await api.put(`/admin/orders/${orderId}/status`, { status });
      load();
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <span className="text-sm text-ink/50">Filter:</span>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="input-field w-40 text-sm">
          <option value="">All</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-ink/40 text-sm">Loading...</p>
      ) : (
        <div className="border border-line rounded-sm divide-y divide-line">
          {orders.map((order) => (
            <div key={order.id} className="flex flex-wrap items-center justify-between px-4 py-3 text-sm gap-x-4 gap-y-2">
              <span className="font-mono w-16">#{order.id}</span>
              <span className="flex-1 min-w-[180px]">
                {order.customer_name} <span className="text-ink/40">({order.customer_email})</span>
              </span>
              <span className="text-xs text-ink/40 hidden sm:inline">
                {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </span>
              <span className="font-mono">₹{fmtINR(order.total)}</span>
              <select
                value={order.status}
                onChange={(e) => updateStatus(order.id, e.target.value)}
                className="input-field w-32 text-xs"
              >
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          ))}
          {orders.length === 0 && <p className="text-ink/40 text-sm p-4">No orders found.</p>}
        </div>
      )}

      <section id="returns" className="mt-14 scroll-mt-32">
        <h2 className="font-display text-xl font-semibold mb-1">Returns</h2>
        <p className="text-xs text-ink/40 mb-4">Customers can request a return within 10 days of delivery.</p>
        <AdminReturns />
      </section>
    </div>
  );
}