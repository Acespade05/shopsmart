import { useState } from 'react';
import api from '../services/api';
import { estimateDelivery, formatDeliveryDate } from '../utils/delivery';

const STEPS = [
  { key: 'placed', label: 'Ordered' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
];
const STEP_INDEX = { pending: 0, confirmed: 1, shipped: 2, delivered: 3 };

const fmt = (d) =>
  new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

// Ordered → Confirmed → Shipped → Delivered, with the time of each step
// (from order_status_history) and an expected delivery date.
export function OrderTimeline({ order, history = [], address }) {
  const when = { placed: order.created_at };
  history.forEach((h) => {
    when[h.status] = h.changed_at; // latest change per status wins
  });

  if (order.status === 'cancelled') {
    return (
      <div className="border border-coral/20 bg-coral/10 rounded-sm p-5 text-sm">
        <p className="text-coral font-medium">This order was cancelled</p>
        {when.cancelled && <p className="text-ink/50 text-xs mt-1">on {fmt(when.cancelled)}</p>}
      </div>
    );
  }

  const current = STEP_INDEX[order.status] ?? 0;
  const eta = address?.pincode ? estimateDelivery(address.pincode, new Date(order.created_at)) : null;

  return (
    <div className="border border-line rounded-sm p-6">
      <div className="flex items-baseline justify-between mb-6 gap-4 flex-wrap">
        <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-emerald">Tracking</p>
        {order.status !== 'delivered' && eta && (
          <p className="text-xs text-ink/60">
            Expected by <span className="text-ink font-medium">{formatDeliveryDate(eta.by)}</span>
          </p>
        )}
      </div>

      <ol className="grid grid-cols-4">
        {STEPS.map((step, i) => {
          const done = i <= current;
          return (
            <li key={step.key} className="relative flex flex-col items-center text-center">
              {i > 0 && (
                <span
                  aria-hidden="true"
                  className={`absolute top-[7px] right-1/2 w-full h-[2px] ${i <= current ? 'bg-[#e3a857]' : 'bg-[#f3eee3]/10'}`}
                />
              )}
              <span
                className={`relative z-10 w-4 h-4 rounded-full border-2 ${
                  done ? 'bg-[#e3a857] border-[#e3a857]' : 'bg-[#0b0a08] border-[#f3eee3]/20'
                } ${i === current ? 'ring-4 ring-[#e3a857]/20' : ''}`}
              />
              <span className={`mt-3 text-xs ${done ? 'text-ink' : 'text-ink/40'}`}>{step.label}</span>
              <span className="mt-1 text-[10px] text-ink/40 min-h-[14px]">
                {done && when[step.key === 'placed' ? 'placed' : step.key] ? fmt(when[step.key]) : ''}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

const REASONS = ['Damaged or defective', 'Wrong item received', 'Size or fit issue', 'Not as described', 'No longer needed'];
const RETURN_STATUS = {
  requested: 'Return requested — we will review it shortly.',
  approved: 'Return approved — pickup will be arranged.',
  rejected: 'Return request was not approved.',
  refunded: 'Return complete — refund issued.',
};

// Cancel (before shipping) or request a return (after delivery).
export function OrderActions({ order, returnRequest, onChange }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function cancel() {
    if (!window.confirm('Cancel this order?')) return;
    setBusy(true);
    try {
      await api.put(`/orders/${order.id}/cancel`);
      onChange();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not cancel the order');
    } finally {
      setBusy(false);
    }
  }

  async function requestReturn(e) {
    e.preventDefault();
    if (!reason) {
      setError('Please choose a reason');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.post(`/orders/${order.id}/return`, { reason, details });
      setOpen(false);
      onChange();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not request a return');
    } finally {
      setBusy(false);
    }
  }

  if (returnRequest) {
    return (
      <div className="border border-line rounded-sm p-5 text-sm">
        <p className="text-emerald font-medium">{RETURN_STATUS[returnRequest.status]}</p>
        <p className="text-ink/50 text-xs mt-1">Reason: {returnRequest.reason}</p>
      </div>
    );
  }

  if (['pending', 'confirmed'].includes(order.status)) {
    return (
      <div>
        <button onClick={cancel} disabled={busy} className="btn-secondary disabled:opacity-50">
          Cancel order
        </button>
        {error && <p className="text-coral text-xs mt-2">{error}</p>}
      </div>
    );
  }

  if (order.status !== 'delivered') return null;

  return (
    <div>
      {!open ? (
        <button onClick={() => setOpen(true)} className="btn-secondary">
          Return items
        </button>
      ) : (
        <form onSubmit={requestReturn} className="border border-line rounded-sm p-5 space-y-3">
          <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-emerald">Request a return</p>
          <select value={reason} onChange={(e) => setReason(e.target.value)} className="input-field" aria-label="Reason">
            <option value="">Why are you returning this?</option>
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={3}
            placeholder="Anything else we should know? (optional)"
            className="input-field"
          />
          {error && <p className="text-coral text-xs">{error}</p>}
          <div className="flex gap-3">
            <button disabled={busy} className="btn-primary disabled:opacity-50">
              Submit request
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary">
              Cancel
            </button>
          </div>
          <p className="text-[11px] text-ink/40">Returns are accepted within 10 days of delivery.</p>
        </form>
      )}
    </div>
  );
}
