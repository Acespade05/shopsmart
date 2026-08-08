import { useEffect, useState } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import api from '../services/api';

export default function OrderDetail() {
  const { id } = useParams();
  const location = useLocation();
  const [data, setData] = useState(null);
  const justPlaced = location.state?.justPlaced;

  useEffect(() => {
    api.get(`/orders/${id}`).then((res) => setData(res.data));
  }, [id]);

  if (!data) return <div className="max-w-3xl mx-auto px-6 py-20 text-ink/40 text-sm">Loading...</div>;

  const { order, items, address } = data;

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      {justPlaced && (
        <div className="bg-emerald-light border border-emerald/30 rounded-sm p-6 mb-8 text-center">
          <p className="text-emerald font-display text-2xl font-semibold mb-1">Order confirmed</p>
          <p className="text-ink/60 text-sm">Thanks for your order — a confirmation has been recorded.</p>
        </div>
      )}

      <div className="flex items-baseline justify-between mb-8">
        <h1 className="text-2xl font-display font-semibold">Order #{order.id}</h1>
        <span className="text-sm px-3 py-1 rounded-sm bg-emerald-light text-emerald capitalize">
          {order.status}
        </span>
      </div>

      <section className="mb-8">
        <h2 className="font-medium text-sm text-ink/60 mb-3">Items</h2>
        <div className="space-y-3">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-line pb-3">
              <img src={item.images?.[0]} alt={item.name} className="w-14 h-14 object-cover rounded-sm bg-emerald-light" />
              <div className="flex-1">
                <p className="text-sm font-medium">{item.name}</p>
                <p className="text-xs text-ink/40">Qty {item.quantity}</p>
              </div>
              <p className="font-mono text-sm">₹{(item.price * item.quantity).toLocaleString('en-IN')}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid md:grid-cols-2 gap-8 mb-8">
        <section>
          <h2 className="font-medium text-sm text-ink/60 mb-2">Delivery address</h2>
          {address && (
            <p className="text-sm text-ink/70">
              {address.name}<br />
              {address.line1}, {address.city}, {address.state} {address.pincode}<br />
              {address.phone}
            </p>
          )}
        </section>

        <section>
          <h2 className="font-medium text-sm text-ink/60 mb-2">Payment</h2>
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-ink/60">Subtotal</span>
              <span className="font-mono">₹{parseFloat(order.subtotal).toLocaleString('en-IN')}</span>
            </div>
            {parseFloat(order.discount) > 0 && (
              <div className="flex justify-between text-emerald">
                <span>Discount</span>
                <span className="font-mono">−₹{parseFloat(order.discount).toLocaleString('en-IN')}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold pt-1 border-t border-line">
              <span>Total</span>
              <span className="font-mono">₹{parseFloat(order.total).toLocaleString('en-IN')}</span>
            </div>
          </div>
        </section>
      </div>

      <Link to="/orders" className="text-emerald text-sm hover:underline">
        ← Back to order history
      </Link>
    </div>
  );
}