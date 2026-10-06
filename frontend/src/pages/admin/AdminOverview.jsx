import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { fmtINR } from '../../utils/money';

const REFRESH_MS = 30000;

// Store health at a glance. "Today" and "Live now" read the same /api/metrics
// endpoints the AI-SRE collector uses, so the numbers here always match what
// AI-SRE sees. Trends and charts are left to AI-SRE's own dashboards.
// Every request the page makes. Each one loads on its own, so one slow or
// failing endpoint only blanks its own card instead of the whole page.
const SOURCES = {
  revenue: '/metrics/revenue-today',
  aov: '/metrics/aov',
  conversion: '/metrics/conversion-rate',
  sessions: '/metrics/active-sessions',
  checkouts: '/metrics/active-checkouts',
  attention: '/admin/attention',
  bots: '/bot-activity/recent?limit=1',
};

function describeError(err) {
  const status = err?.response?.status;
  if (status === 401 || status === 403) return 'session expired — log out and sign in again';
  if (status) return `HTTP ${status}`;
  if (err?.code === 'ECONNABORTED') return 'timed out';
  return 'network error';
}

export default function AdminOverview() {
  const [data, setData] = useState({});
  const [errors, setErrors] = useState({});
  const [updated, setUpdated] = useState(null);

  const load = useCallback(async () => {
    const keys = Object.keys(SOURCES);
    const results = await Promise.allSettled(keys.map((k) => api.get(SOURCES[k], { timeout: 20000 })));
    const nextErrors = {};
    const fresh = {};
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') fresh[keys[i]] = r.value.data;
      else nextErrors[keys[i]] = describeError(r.reason);
    });
    // Keep the last good value for anything that failed this round
    setData((prev) => ({ ...prev, ...fresh }));
    setErrors(nextErrors);
    setUpdated(new Date());
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  if (!updated) return <p className="text-sm text-[#6b7280]">Loading…</p>;

  const { revenue, aov, conversion, sessions, checkouts, attention, bots: botFeed } = data;
  const bots = botFeed ? botFeed.visitsLast5Min ?? botFeed.activeBots : null;
  const split = attention?.ordersToday || null;
  const list = (k) => (Array.isArray(attention?.[k]) ? attention[k] : []);
  const attentionCount =
    list('waitingToShip').length + list('outOfStock').length + list('lowStock').length + list('pendingReturns').length;
  const failed = Object.entries(errors);
  const num = (v) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('en-IN'));

  return (
    <div className="space-y-8">
      {failed.length > 0 && (
        <div className="bg-[#fef2f2] border border-[#fecaca] rounded-xl px-4 py-3 text-xs text-[#b91c1c]">
          <p className="font-medium mb-1">Some numbers couldn't be loaded — showing the last values we had. Retrying every 30 s.</p>
          <ul className="font-mono space-y-0.5">
            {failed.map(([k, why]) => (
              <li key={k}>
                /api{SOURCES[k]} — {why}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ---------- Today ---------- */}
      <section>
        <SectionTitle title="Today" note="Same definitions as /api/metrics — what AI-SRE collects" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat
            label="Revenue today"
            value={revenue ? `₹${fmtINR(revenue.revenue)}` : '—'}
            sub="Paid orders since midnight (UTC)"
          />
          <Stat
            label="Orders today"
            value={num(revenue?.orderCount)}
            sub={split ? `${split.total - split.synthetic} real · ${split.synthetic} from traffic bots` : ''}
          />
          <Stat label="Avg. order value" value={aov ? `₹${fmtINR(aov.averageOrderValue)}` : '—'} sub="Last 7 days" />
          <Stat
            label="Conversion rate"
            value={conversion ? `${conversion.conversionRate}%` : '—'}
            sub={conversion ? `${num(conversion.orders)} orders / ${num(conversion.sessions)} sessions · 7 days` : ''}
          />
        </div>
      </section>

      {/* ---------- Live ---------- */}
      <section>
        <SectionTitle title="Live now" note={`Updated ${updated.toLocaleTimeString('en-IN')} · refreshes every 30 s`} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Stat label="Active sessions" value={num(sessions?.activeSessions)} sub="Browsers active in last 5 min" live />
          <Stat label="In checkout" value={num(checkouts?.activeCheckouts)} sub="Started checkout in last 10 min" live />
          <Stat
            label="Synthetic visits"
            value={bots ?? '—'}
            sub={bots === 0 ? 'None in 5 min — check the traffic generator' : 'Bot visits finished in last 5 min'}
            warn={bots === 0}
            live
          />
        </div>
      </section>

      {/* ---------- Needs attention ---------- */}
      <section>
        <SectionTitle
          title="Needs attention"
          note={
            !attention
              ? ''
              : attentionCount === 0
                ? 'Nothing to do right now'
                : `${attentionCount} item${attentionCount > 1 ? 's' : ''}`
          }
        />
        {!attention ? (
          <div className="bg-white border border-[#e5e7eb] rounded-xl px-5 py-8 text-center text-sm text-[#6b7280]">
            Couldn't load this section ({errors.attention || 'no data'}).
          </div>
        ) : attentionCount === 0 ? (
          <div className="bg-white border border-[#e5e7eb] rounded-xl px-5 py-8 text-center text-sm text-[#6b7280]">
            All clear — no late orders, stock problems or pending returns.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            <AttentionCard
              title="Orders waiting to ship"
              hint="Placed over 24 hours ago, not yet shipped (bot orders are shipped automatically)"
              items={list('waitingToShip')}
              to="/admin?tab=orders"
              action="Open orders"
              render={(o) => (
                <>
                  <span className="font-mono">#{o.id}</span> · {o.customer_name}
                  <span className="text-[#9ca3af]"> · {new Date(o.created_at).toLocaleDateString('en-IN')}</span>
                </>
              )}
            />
            <AttentionCard
              title="Return requests"
              hint="Waiting for approval"
              items={list('pendingReturns')}
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
              items={list('outOfStock')}
              to="/admin?tab=inventory&filter=out"
              action="Restock"
              danger
              render={(p) => p.name}
            />
            <AttentionCard
              title="Low stock"
              hint="Fewer than 10 left"
              items={list('lowStock')}
              to="/admin?tab=inventory&filter=low"
              action="Manage stock"
              render={(p) => (
                <>
                  {p.name} <span className="text-[#d97706] font-mono">· {p.stock} left</span>
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
    <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
      <h2 className="text-base font-semibold text-[#111827]">{title}</h2>
      {note && <p className="text-xs text-[#6b7280]">{note}</p>}
    </div>
  );
}

function Stat({ label, value, sub, live, warn }) {
  return (
    <div className="bg-white border border-[#e5e7eb] rounded-xl px-5 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <p className="text-xs font-medium text-[#6b7280] flex items-center gap-2">
        {live && <span className={`w-1.5 h-1.5 rounded-full ${warn ? 'bg-[#dc2626]' : 'bg-[#16a34a]'}`} />}
        {label}
      </p>
      <p className={`text-2xl font-semibold mt-2 tabular-nums ${warn ? 'text-[#dc2626]' : 'text-[#111827]'}`}>{value}</p>
      {sub && <p className="text-xs text-[#6b7280] mt-1">{sub}</p>}
    </div>
  );
}

function AttentionCard({ title, hint, items, to, action, render, danger }) {
  if (items.length === 0) return null;
  const shown = items.slice(0, 5);
  return (
    <div className={`bg-white border rounded-xl p-5 ${danger ? 'border-[#fecaca]' : 'border-[#e5e7eb]'}`}>
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <p className="text-sm font-semibold text-[#111827]">
          {title}{' '}
          <span
            className={`ml-1 text-xs font-medium px-2 py-0.5 rounded-full ${
              danger ? 'bg-[#fef2f2] text-[#dc2626]' : 'bg-[#eff6ff] text-[#1d4ed8]'
            }`}
          >
            {items.length}
          </span>
        </p>
        <Link to={to} className="text-xs font-medium text-[#2563eb] hover:text-[#1d4ed8] shrink-0">
          {action} →
        </Link>
      </div>
      <p className="text-xs text-[#6b7280] mb-3">{hint}</p>
      <ul className="space-y-1.5 text-sm text-[#374151]">
        {shown.map((item) => (
          <li key={item.id} className="line-clamp-1">
            {render(item)}
          </li>
        ))}
        {items.length > shown.length && <li className="text-[#9ca3af] text-xs">+ {items.length - shown.length} more</li>}
      </ul>
    </div>
  );
}
