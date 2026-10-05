import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { fmtINR } from '../utils/money';
import usePageTitle from '../hooks/usePageTitle';

export default function Orders() {
  usePageTitle('Your orders');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/orders').then((res) => setOrders(res.data.orders)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="max-w-4xl mx-auto px-6 py-20 text-ink/40 text-sm">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-display font-semibold mb-8">Your orders</h1>

      {orders.length === 0 ? (
        <p className="text-ink/40 text-sm">No orders yet.</p>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Link
              key={order.id}
              to={`/orders/${order.id}`}
              className="flex items-center justify-between border border-line rounded-sm p-4 hover:border-emerald transition-colors"
            >
              <div>
                <p className="font-medium text-sm">Order #{order.id}</p>
                <p className="text-xs text-ink/40">{new Date(order.created_at).toLocaleDateString()}</p>
              </div>
              <span className="text-xs px-2 py-1 rounded-sm bg-emerald-light text-emerald capitalize">
                {order.status}
              </span>
              <p className="font-mono text-sm">₹{fmtINR(parseFloat(order.total))}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}