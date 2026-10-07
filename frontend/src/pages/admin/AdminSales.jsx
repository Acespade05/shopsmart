import { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import { fmtINR } from '../../utils/money';
import { CATEGORY_LABEL, sortCategories } from '../../utils/categories';

// Admin → Sales. Schedule store-wide or category sales; they start and end
// on their own. Product prices are never edited — the store applies the sale
// price while it's live. One sale runs at a time.

const STATUS = {
  live: { label: 'Live', cls: 'bg-[#ecfdf5] text-[#047857]' },
  scheduled: { label: 'Scheduled', cls: 'bg-[#eff6ff] text-[#1d4ed8]' },
  ended: { label: 'Ended', cls: 'bg-[#f3f4f6] text-[#6b7280]' },
};

const when = (d) =>
  new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

// <input type="datetime-local"> wants local "YYYY-MM-DDTHH:MM"
function toLocalInput(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function scope(categories) {
  if (!categories) return 'Whole store';
  return categories.map((s) => CATEGORY_LABEL[s] || s).join(', ');
}

function timeLeft(end) {
  const m = Math.max(0, Math.round((new Date(end) - Date.now()) / 60000));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  return d ? `${d}d ${h}h left` : h ? `${h}h ${m % 60}m left` : `${m}m left`;
}

const emptyForm = () => ({
  name: '',
  discountPercent: 20,
  wholeStore: true,
  categories: [],
  startNow: false,
  startsAt: toLocalInput(Date.now() + 86400e3),
  endsAt: toLocalInput(Date.now() + 3 * 86400e3),
});

export default function AdminSales() {
  const [sales, setSales] = useState(null);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(null); // null = form closed
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(() => {
    api
      .get('/admin/sales')
      .then((res) => setSales(res.data.sales))
      .catch(() => setError('Could not load sales'));
  }, []);

  useEffect(() => {
    load();
    api.get('/categories').then((res) => setCategories(sortCategories(res.data.categories))).catch(() => {});
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  async function act(fn, done) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await fn();
      if (done) setMessage(done);
      load();
      return true;
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    const body = {
      name: form.name,
      discountPercent: Number(form.discountPercent),
      categories: form.wholeStore ? null : form.categories,
      ...(form.startNow ? { startNow: true } : { startsAt: new Date(form.startsAt).toISOString() }),
      endsAt: new Date(form.endsAt).toISOString(),
    };
    const ok = await act(
      () => api.post('/admin/sales', body),
      form.startNow ? `"${form.name}" is live — the store is showing sale prices now.` : `"${form.name}" scheduled.`
    );
    if (ok) setForm(null);
  }

  const live = sales?.find((s) => s.status === 'live');
  const upcoming = sales?.filter((s) => s.status === 'scheduled') || [];
  const past = sales?.filter((s) => s.status === 'ended') || [];

  return (
    <div className="space-y-8">
      <p className="text-sm text-[#6b7280] max-w-3xl">
        Sales start and end on their own at the scheduled times. Prices aren't edited: while a sale is live, the store
        shows and charges the sale price (MRP struck through), and coupons still work on top. Shoppers — and the traffic
        bots — see a banner, and more of them come.
      </p>

      {message && <p className="text-sm text-[#047857] bg-[#ecfdf5] border border-[#a7f3d0] rounded-lg px-4 py-2">{message}</p>}
      {error && <p className="text-sm text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] rounded-lg px-4 py-2">{error}</p>}

      {/* ---------- Live now ---------- */}
      <section>
        <h2 className="text-base font-semibold text-[#111827] mb-3">Running now</h2>
        {live ? (
          <div className="bg-white border-2 border-[#a7f3d0] rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-xs font-medium text-[#047857]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a]" /> Live · {timeLeft(live.endsAt)}
              </p>
              <p className="text-xl font-semibold text-[#111827] mt-1">
                {live.name} · {live.discountPercent}% off
              </p>
              <p className="text-xs text-[#6b7280] mt-1">
                {scope(live.categories)} · until {when(live.endsAt)} · so far {live.orders} orders, ₹{fmtINR(live.revenue)}
              </p>
            </div>
            <button
              disabled={busy}
              onClick={() => {
                if (window.confirm(`End "${live.name}" now? Prices go back to normal immediately.`)) {
                  act(() => api.post(`/admin/sales/${live.id}/end-now`), `"${live.name}" ended.`);
                }
              }}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-[#fecaca] text-[#b91c1c] hover:bg-[#fef2f2] disabled:opacity-50"
            >
              End now
            </button>
          </div>
        ) : (
          <div className="bg-white border border-[#e5e7eb] rounded-xl px-5 py-6 text-sm text-[#6b7280]">
            No sale is running. Prices are normal.
          </div>
        )}
      </section>

      {/* ---------- New sale ---------- */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-[#111827]">Schedule a sale</h2>
          {!form && (
            <button
              onClick={() => setForm(emptyForm())}
              className="px-3 py-1.5 text-sm font-medium rounded-lg bg-[#2563eb] text-white hover:bg-[#1d4ed8]"
            >
              + New sale
            </button>
          )}
        </div>
        {form && (
          <form onSubmit={submit} className="bg-white border border-[#e5e7eb] rounded-xl p-5 space-y-4">
            <div className="grid sm:grid-cols-[1fr_140px] gap-4">
              <label className="block">
                <span className="text-xs font-medium text-[#374151]">Name shoppers see</span>
                <input
                  required
                  maxLength={80}
                  placeholder="e.g. Diwali Dhamaka"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="mt-1 w-full border border-[#d1d5db] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-[#374151]">Discount (%)</span>
                <input
                  required
                  type="number"
                  min={5}
                  max={80}
                  value={form.discountPercent}
                  onChange={(e) => setForm({ ...form, discountPercent: e.target.value })}
                  className="mt-1 w-full border border-[#d1d5db] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30"
                />
              </label>
            </div>

            <fieldset>
              <legend className="text-xs font-medium text-[#374151] mb-2">Applies to</legend>
              <div className="flex flex-wrap gap-2">
                <label className={`px-3 py-1.5 rounded-full border text-xs cursor-pointer ${form.wholeStore ? 'bg-[#eff6ff] border-[#93c5fd] text-[#1d4ed8]' : 'border-[#d1d5db] text-[#4b5563]'}`}>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={form.wholeStore}
                    onChange={() => setForm({ ...form, wholeStore: !form.wholeStore })}
                  />
                  Whole store
                </label>
                {!form.wholeStore &&
                  categories.map((c) => {
                    const on = form.categories.includes(c.slug);
                    return (
                      <label
                        key={c.slug}
                        className={`px-3 py-1.5 rounded-full border text-xs cursor-pointer ${on ? 'bg-[#eff6ff] border-[#93c5fd] text-[#1d4ed8]' : 'border-[#d1d5db] text-[#4b5563]'}`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={on}
                          onChange={() =>
                            setForm({
                              ...form,
                              categories: on ? form.categories.filter((s) => s !== c.slug) : [...form.categories, c.slug],
                            })
                          }
                        />
                        {c.name}
                      </label>
                    );
                  })}
              </div>
            </fieldset>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <span className="text-xs font-medium text-[#374151]">Starts</span>
                <label className="flex items-center gap-2 mt-1 text-sm text-[#374151]">
                  <input type="checkbox" checked={form.startNow} onChange={() => setForm({ ...form, startNow: !form.startNow })} />
                  Start right now
                </label>
                {!form.startNow && (
                  <input
                    required
                    type="datetime-local"
                    value={form.startsAt}
                    onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                    className="mt-2 w-full border border-[#d1d5db] rounded-lg px-3 py-2 text-sm"
                  />
                )}
              </div>
              <label className="block">
                <span className="text-xs font-medium text-[#374151]">Ends</span>
                <input
                  required
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                  className="mt-1 w-full border border-[#d1d5db] rounded-lg px-3 py-2 text-sm"
                />
                <span className="block text-[11px] text-[#9ca3af] mt-1">Times are in your browser's time zone (IST)</span>
              </label>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={busy || (!form.wholeStore && form.categories.length === 0)}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-[#2563eb] text-white hover:bg-[#1d4ed8] disabled:opacity-50"
              >
                {form.startNow ? 'Start sale now' : 'Schedule sale'}
              </button>
              <button type="button" onClick={() => setForm(null)} className="px-4 py-2 text-sm text-[#4b5563] hover:text-[#111827]">
                Cancel
              </button>
            </div>
          </form>
        )}
      </section>

      {/* ---------- Calendar ---------- */}
      <section>
        <h2 className="text-base font-semibold text-[#111827] mb-3">Calendar</h2>
        {!sales ? (
          <p className="text-sm text-[#6b7280]">Loading…</p>
        ) : (
          <div className="bg-white border border-[#e5e7eb] rounded-xl overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-[#f9fafb] text-xs text-[#6b7280]">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5">Sale</th>
                  <th className="text-left font-medium px-4 py-2.5">Applies to</th>
                  <th className="text-left font-medium px-4 py-2.5">When</th>
                  <th className="text-left font-medium px-4 py-2.5">Status</th>
                  <th className="text-right font-medium px-4 py-2.5">Orders · revenue</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {[...(live ? [live] : []), ...upcoming, ...past].map((s) => (
                  <tr key={s.id} className="border-t border-[#f3f4f6]">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#111827]">{s.name}</p>
                      <p className="text-xs text-[#6b7280]">{s.discountPercent}% off</p>
                    </td>
                    <td className="px-4 py-3 text-[#374151]">{scope(s.categories)}</td>
                    <td className="px-4 py-3 text-xs text-[#374151] whitespace-nowrap">
                      {when(s.startsAt)}
                      <br />→ {when(s.endsAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS[s.status].cls}`}>
                        {STATUS[s.status].label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-[#374151] tabular-nums whitespace-nowrap">
                      {s.status === 'scheduled' ? '—' : `${s.orders} · ₹${fmtINR(s.revenue)}`}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {s.status === 'scheduled' && (
                        <>
                          <button
                            disabled={busy || !!live}
                            title={live ? 'End the running sale first' : ''}
                            onClick={() => act(() => api.post(`/admin/sales/${s.id}/start-now`), `"${s.name}" is live.`)}
                            className="text-xs font-medium text-[#2563eb] hover:text-[#1d4ed8] disabled:text-[#9ca3af] mr-3"
                          >
                            Start now
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => {
                              if (window.confirm(`Delete "${s.name}"?`)) act(() => api.delete(`/admin/sales/${s.id}`), 'Sale deleted.');
                            }}
                            className="text-xs text-[#6b7280] hover:text-[#b91c1c]"
                          >
                            Delete
                          </button>
                        </>
                      )}
                      {s.status === 'live' && (
                        <button
                          disabled={busy}
                          onClick={() => {
                            if (window.confirm(`End "${s.name}" now?`)) act(() => api.post(`/admin/sales/${s.id}/end-now`), `"${s.name}" ended.`);
                          }}
                          className="text-xs font-medium text-[#b91c1c] hover:underline"
                        >
                          End now
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {sales.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[#6b7280]">
                      No sales yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
