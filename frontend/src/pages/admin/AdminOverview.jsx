import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { fmtINR } from '../../utils/money';

const REFRESH_MS = 30000;

// Store health at a glance. "Today" and "Live now" read the same /api/metrics
// endpoints the AI-SRE collector uses, so the numbers here always match what
// AI-SRE sees. Trends and charts are left to AI-SRE's own dashboards.
export default function AdminOverview() {
  const [m, setM] = useState(null);
  const [attention, setAttention] = useState(null);
  const [bots, setBots] = useState(null);
  const [updated, setUpdated] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const get = (url) => api.get(url).then((r) => r.data);
      const [revenue, aov, conversion, sessions, checkouts, att, bot] = await Promise.all([
        get('/metrics/revenue-today'),
        get('/metrics/aov'),
        get('/metrics/conversion-rate'),
        get('/metrics/active-sessions'),
        get('/metrics/active-checkouts'),
        get('/admin/attention'),
        get('/bot-activity/recent?limit=1').catch(() => null),
      ]);
      setM({ revenue, aov, conversion, sessions, checkouts });
      setAttention(att);
      setBots(bot?.activeBots ?? null);
      setUpdated(new Date());
      setError('');
    } catch {
      setError('Could not load store metrics. Retrying…');
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  if (!m || !attention) {
    return <p className="text-sm text-[#f3eee3]/40">{error || 'Loading…'}</p>;
  }

  const attentionCount =
    attention.waitingToShip.length + attention.outOfStock.length + attention.lowStock.length + attention.pendingReturns.length;

  return (
    <div className="space-y-10">
      {/* ---------- Today ---------- */}
      <section>
        <SectionTitle title="Today" note="Same definitions as /api/metrics (what AI-SRE collects)" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-[#f3eee3]/10 border border-[#f3eee3]/10 rounded-sm overflow-hidden">
          <Stat label="Revenue today" value={`₹${fmtINR(m.revenue.revenue)}`} sub="Paid orders since midnight" />
          <Stat label="Orders today" value={m.revenue.orderCount} sub="Paid" />
          <Stat label="Avg. order value" value={`₹${fmtINR(m.aov.averageOrderValue)}`} sub="Last 7 days" />
          <Stat
            label="Conversion rate"
            value={`${m.conversion.conversionRate}%`}
            sub={`${m.conversion.orders} orders / ${m.conversion.sessions.toLocaleString('en-IN')} sessions · 7 days`}
          />
        </div>
      </section>

      {/* ---------- Live ---------- */}
      <section>
        <SectionTitle title="Live now" note={updated ? `Updated ${updated.toLocaleTimeString('en-IN')} · refreshes every 30 s` : ''} />
        <div className="grid grid-cols-3 gap-px bg-[#f3eee3]/10 border border-[#f3eee3]/10 rounded-sm overflow-hidden">
          <Stat label="Active shoppers" value={m.sessions.activeSessions} sub="Sessions in last 5 min" live />
          <Stat label="In checkout" value={m.checkouts.activeCheckouts} sub="Last 10 min" live />
          <Stat
            label="Traffic bots"
            value={bots ?? '—'}
            sub={bots === 0 ? 'None active — check the traffic generator' : 'Active in last 60 s'}
            warn={bots === 0}
            live
          />
        </div>
      </section>

      {/* ---------- Needs attention ---------- */}
      <section>
        <SectionTitle title="Needs attention" note={attentionCount === 0 ? 'Nothing to do right now' : `${attentionCount} item${attentionCount > 1 ? 's' : ''}`} />
        {attentionCount === 0 ? (
          <div className="border border-[#f3eee3]/10 rounded-sm px-5 py-8 text-center text-sm text-[#f3eee3]/45">
            All clear — no late orders, stock problems or pending returns.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            <AttentionCard
              title="Orders waiting to ship"
              hint="Placed over 24 hours ago, not yet shipped"
              items={attention.waitingToShip}
              to="/admin?tab=orders"
              action="Open orders"
              render={(o) => (
                <>
                  <span className="font-mono">#{o.id}</span> · {o.customer_name}
                  <span className="text-[#f3eee3]/35"> · {new Date(o.created_at).toLocaleDateString('en-IN')}</span>
                </>
              )}
            />
            <AttentionCard
              title="Return requests"
              hint="Waiting for approval"
              items={attention.pendingReturns}
              to="/admin?tab=orders#returns"
              action="Review returns"
              render={(r) => (
                <>
                  Order <span className="font-mono">#{r.order_id}</span> · {r.reason}
                </>
              )}
            />
            <AttentionCard
              title="Out of stock"
              hint="Shoppers can't buy these"
              items={attention.outOfStock}
              to="/admin?tab=inventory&filter=out"
              action="Restock"
              danger
              render={(p) => p.name}
            />
            <AttentionCard
              title="Low stock"
              hint="Fewer than 10 left"
              items={attention.lowStock}
              to="/admin?tab=inventory&filter=low"
              action="Manage stock"
              render={(p) => (
                <>
                  {p.name} <span className="text-[#e3a857] font-mono">· {p.stock} left</span>
                </>
              )}
            />
          </div>
        )}
      </section>
    </div>
  );
}

function SectionTitle({ title, note }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
      <h2 className="font-display text-xl font-semibold text-[#f3eee3]">{title}</h2>
      {note && <p className="text-[11px] text-[#f3eee3]/35">{note}</p>}
    </div>
  );
}

function Stat({ label, value, sub, live, warn }) {
  return (
    <div className="bg-[#0b0a08] px-5 py-5">
      <p className="text-[11px] text-[#f3eee3]/45 flex items-center gap-2">
        {live && <span className={`w-1.5 h-1.5 rounded-full ${warn ? 'bg-[#e8604c]' : 'bg-[#5fb8a6]'}`} />}
        {label}
      </p>
      <p className={`font-display text-3xl font-semibold mt-2 ${warn ? 'text-[#e8604c]' : 'text-[#f3eee3]'}`}>{value}</p>
      {sub && <p className="text-[11px] text-[#f3eee3]/35 mt-1">{sub}</p>}
    </div>
  );
}

function AttentionCard({ title, hint, items, to, action, render, danger }) {
  if (items.length === 0) return null;
  const shown = items.slice(0, 5);
  return (
    <div className={`border rounded-sm p-5 ${danger ? 'border-[#e8604c]/35' : 'border-[#f3eee3]/10'}`}>
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <p className="text-sm font-medium text-[#f3eee3]">
          {title} <span className={`font-mono ${danger ? 'text-[#e8604c]' : 'text-[#e3a857]'}`}>{items.length}</span>
        </p>
        <Link to={to} className="text-[11px] text-[#e3a857] hover:text-[#f0c07f] shrink-0">
          {action} →
        </Link>
      </div>
      <p className="text-[11px] text-[#f3eee3]/35 mb-3">{hint}</p>
      <ul className="space-y-1.5 text-xs text-[#f3eee3]/70">
        {shown.map((item) => (
          <li key={item.id} className="line-clamp-1">
            {render(item)}
          </li>
        ))}
        {items.length > shown.length && <li className="text-[#f3eee3]/35">+ {items.length - shown.length} more</li>}
      </ul>
    </div>
  );
}
