import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../../services/api';
import { fmtINR } from '../../utils/money';

// Revenue over time (Indian time): per hour today, or per day for the last
// 7 / 30 days, with the previous period as a dashed comparison line and sale
// periods shaded. Data: GET /api/admin/revenue-series?range=day|week|month.

const RANGES = [
  { key: 'day', label: 'Daily', current: 'Today', previous: 'Yesterday' },
  { key: 'week', label: 'Weekly', current: 'Last 7 days', previous: 'Previous 7 days' },
  { key: 'month', label: 'Monthly', current: 'Last 30 days', previous: 'Previous 30 days' },
];
const BUCKETS = { day: 24, week: 7, month: 30 };

// When the realistic traffic generator (v3) went live — older data came from
// the earlier, unrealistic bots, so it's marked on the chart.
const TRAFFIC_V3_SINCE = Date.parse('2026-10-06T16:55:00Z');

const COLORS = {
  current: '#2563eb',
  previous: '#6b7280',
  grid: '#eef0f3',
  axis: '#9ca3af',
  text: '#6b7280',
  sale: 'rgba(192, 138, 46, 0.12)',
  saleText: '#92651f',
};

const H = 260;
const M = { top: 22, right: 16, bottom: 28, left: 60 };
const IST = { timeZone: 'Asia/Kolkata' };

// ₹ axis labels in Indian units: ₹950, ₹12K, ₹1.2L, ₹3.4Cr
function compactINR(n) {
  if (n >= 1e7) return `₹${+(n / 1e7).toFixed(1)}Cr`;
  if (n >= 1e5) return `₹${+(n / 1e5).toFixed(1)}L`;
  if (n >= 1e3) return `₹${+(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K`;
  return `₹${Math.round(n)}`;
}

function niceMax(v) {
  if (v <= 0) return 1000;
  const p = 10 ** Math.floor(Math.log10(v));
  const f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}

function hourLabel(t) {
  return new Date(t).toLocaleTimeString('en-IN', { ...IST, hour: 'numeric', hour12: true }).replace(' ', ' ');
}
function dayLabel(t, withWeekday) {
  return new Date(t).toLocaleDateString('en-IN', {
    ...IST,
    ...(withWeekday ? { weekday: 'short' } : {}),
    day: 'numeric',
    month: 'short',
  });
}

export default function RevenueChart() {
  const [range, setRange] = useState('day');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [hover, setHover] = useState(null);
  const [width, setWidth] = useState(720);
  const [showTable, setShowTable] = useState(false);
  const wrapRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/admin/revenue-series?range=${range}`, { timeout: 20000 });
      setData(res.data);
      setError('');
    } catch (err) {
      setError(err?.response?.status ? `HTTP ${err.response.status}` : 'network error');
    }
  }, [range]);

  useEffect(() => {
    setHover(null);
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!wrapRef.current) return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(320, entry.contentRect.width)));
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const meta = RANGES.find((r) => r.key === range);
  const ready = data && data.range === range;
  const n = BUCKETS[range];
  const step = range === 'day' ? 3600e3 : 86400e3;
  const W = width - M.left - M.right;
  const PH = H - M.top - M.bottom;

  const chart = useMemo(() => {
    if (!ready) return null;
    const { points, previous, periodStart } = data;
    const yMax = niceMax(Math.max(1, ...points.map((p) => p.revenue), ...previous.map((p) => p.revenue)));
    const x = (i) => (n === 1 ? 0 : (i / (n - 1)) * W);
    const xt = (t) => ((t - periodStart) / step / (n - 1)) * W;
    const y = (v) => PH - (v / yMax) * PH;
    const path = (arr) => arr.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.revenue).toFixed(1)}`).join('');
    // Previous period: full length (it's complete), aligned bucket-by-bucket
    const prevFull = Array.from({ length: n }, (_, i) => previous[i] || null).filter(Boolean);
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * yMax);
    const xTicks = [];
    const every = range === 'day' ? 3 : range === 'week' ? 1 : 5;
    for (let i = 0; i < n; i += every) xTicks.push(i);
    // Sale bands. Hourly view: exact times. Daily views: whole days, so a sale
    // running today still shows on today's point.
    const half = n > 1 ? W / (n - 1) / 2 : 0;
    const bucketOf = (t) => Math.floor((t - periodStart) / step);
    const sales = (data.sales || [])
      .map((s) => {
        const start = new Date(s.startsAt).getTime();
        const end = new Date(s.endsAt).getTime();
        let x0;
        let x1;
        if (range === 'day') {
          x0 = xt(start);
          x1 = xt(end);
        } else {
          x0 = x(bucketOf(start)) - half;
          x1 = x(bucketOf(end - 1)) + half;
        }
        x0 = Math.max(0, x0);
        x1 = Math.min(W, Math.max(x1, x0 + 3));
        return x0 < W && x1 > 0 ? { ...s, x0, x1 } : null;
      })
      .filter(Boolean);
    // Labels above the bands: widest band first; a label that would overlap one
    // already placed is dropped (the tooltip still names the sale).
    const placed = [];
    [...sales]
      .sort((a, b) => b.x1 - b.x0 - (a.x1 - a.x0) || new Date(b.startsAt) - new Date(a.startsAt))
      .forEach((s) => {
        const text = `${s.name} · ${s.discountPercent}% off`;
        const w = text.length * 5.6;
        const lx = Math.max(0, Math.min(s.x0 + 4, W - w));
        if (placed.some((p) => lx < p.end + 8 && lx + w + 8 > p.start)) return;
        placed.push({ start: lx, end: lx + w });
        s.label = text;
        s.lx = lx;
      });
    const v3 = xt(TRAFFIC_V3_SINCE);
    return { points, prevFull, x, y, yMax, ticks, xTicks, sales, v3, path };
  }, [ready, data, n, W, PH, range, step]);

  function onMove(e) {
    if (!chart || chart.points.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left - M.left;
    const i = Math.max(0, Math.min(n - 1, Math.round((px / W) * (n - 1))));
    setHover(i);
  }

  function onKey(e) {
    if (!chart) return;
    if (e.key === 'ArrowRight') setHover((h) => Math.min(n - 1, (h ?? -1) + 1));
    if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? n) - 1));
    if (e.key === 'Escape') setHover(null);
  }

  const bucketLabel = (t) =>
    range === 'day'
      ? `${dayLabel(t, true)}, ${hourLabel(t)}–${hourLabel(t + 3600e3)}`
      : dayLabel(t, true);

  // Headline: this period vs the previous one (for today: vs the same time yesterday)
  const total = ready ? data.totals.revenue : 0;
  const compare = ready ? (range === 'day' ? data.previousSoFar.revenue : data.previousTotals.revenue) : 0;
  const change = compare > 0 ? ((total - compare) / compare) * 100 : null;

  const hp = chart && hover !== null ? chart.points[hover] : null;
  const hprev = chart && hover !== null ? chart.prevFull[hover] : null;

  return (
    <section className="bg-white border border-[#e5e7eb] rounded-xl p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-xs font-medium text-[#6b7280]">Revenue · {meta.current}</p>
          <p className="text-2xl font-semibold text-[#111827] tabular-nums mt-1">₹{fmtINR(total)}</p>
          {ready && (
            <p className="text-xs text-[#6b7280] mt-1">
              {data.totals.orders.toLocaleString('en-IN')} orders
              {change !== null && (
                <>
                  {' · '}
                  <span className={change >= 0 ? 'text-[#047857]' : 'text-[#b91c1c]'}>
                    {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(1)}%
                  </span>{' '}
                  vs {range === 'day' ? 'same time yesterday' : meta.previous.toLowerCase()}
                </>
              )}
            </p>
          )}
        </div>
        <div role="tablist" aria-label="Time range" className="inline-flex rounded-lg border border-[#e5e7eb] p-0.5 bg-[#f9fafb]">
          {RANGES.map((r) => (
            <button
              key={r.key}
              role="tab"
              aria-selected={range === r.key}
              onClick={() => setRange(r.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                range === r.key ? 'bg-white text-[#111827] shadow-sm' : 'text-[#6b7280] hover:text-[#111827]'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-[#4b5563] mb-2">
        <span className="flex items-center gap-2">
          <svg width="18" height="6" aria-hidden="true"><line x1="0" y1="3" x2="18" y2="3" stroke={COLORS.current} strokeWidth="2" /></svg>
          {meta.current}
        </span>
        <span className="flex items-center gap-2">
          <svg width="18" height="6" aria-hidden="true"><line x1="0" y1="3" x2="18" y2="3" stroke={COLORS.previous} strokeWidth="2" strokeDasharray="4 3" /></svg>
          {meta.previous}
        </span>
        {chart?.sales.length > 0 && (
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm" style={{ background: 'rgba(192,138,46,0.25)' }} />
            Sale running
          </span>
        )}
      </div>

      <div ref={wrapRef} className="relative">
        {error && !ready && <p className="text-sm text-[#b91c1c] py-10 text-center">Couldn't load revenue ({error}).</p>}
        {!error && !ready && <p className="text-sm text-[#6b7280] py-10 text-center">Loading…</p>}
        {chart && (
          <svg
            width={width}
            height={H}
            role="img"
            aria-label={`Revenue ${meta.current.toLowerCase()} by ${range === 'day' ? 'hour' : 'day'}, compared with ${meta.previous.toLowerCase()}`}
            tabIndex={0}
            onKeyDown={onKey}
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
            className="block outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]/40 rounded"
          >
            <g transform={`translate(${M.left},${M.top})`}>
              {/* Sale periods */}
              {chart.sales.map((s) => (
                <g key={s.id}>
                  <rect x={s.x0} y={0} width={s.x1 - s.x0} height={PH} fill={COLORS.sale} />
                  {s.label && (
                    <text x={s.lx} y={-8} fontSize="10" fill={COLORS.saleText}>
                      {s.label}
                    </text>
                  )}
                </g>
              ))}
              {/* Grid + y labels */}
              {chart.ticks.map((v) => (
                <g key={v}>
                  <line x1={0} x2={W} y1={chart.y(v)} y2={chart.y(v)} stroke={COLORS.grid} />
                  <text x={-8} y={chart.y(v)} dy="0.32em" textAnchor="end" fontSize="10" fill={COLORS.text}>
                    {compactINR(v)}
                  </text>
                </g>
              ))}
              {/* X labels */}
              {chart.xTicks.map((i) => {
                const t = data.periodStart + i * step;
                return (
                  <text
                    key={i}
                    x={chart.x(i)}
                    y={PH + 18}
                    textAnchor={chart.x(i) > W - 30 ? 'end' : 'middle'}
                    fontSize="10"
                    fill={COLORS.text}
                  >
                    {range === 'day' ? hourLabel(t) : dayLabel(t, range === 'week')}
                  </text>
                );
              })}
              {/* When the realistic bots started */}
              {chart.v3 > 0 && chart.v3 < W && (
                <g>
                  <line x1={chart.v3} x2={chart.v3} y1={0} y2={PH} stroke={COLORS.axis} strokeDasharray="2 3" />
                  <text
                    x={chart.v3 > W - 120 ? chart.v3 - 4 : chart.v3 + 4}
                    textAnchor={chart.v3 > W - 120 ? 'end' : 'start'}
                    y={PH - 6}
                    fontSize="10"
                    fill={COLORS.text}
                  >
                    realistic bots start
                  </text>
                </g>
              )}
              {/* Lines */}
              {chart.prevFull.length > 1 && (
                <path d={chart.path(chart.prevFull)} fill="none" stroke={COLORS.previous} strokeWidth="2" strokeDasharray="5 4" strokeLinejoin="round" />
              )}
              {chart.points.length > 1 && (
                <path d={chart.path(chart.points)} fill="none" stroke={COLORS.current} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              )}
              {chart.points.length === 1 && (
                <circle cx={chart.x(0)} cy={chart.y(chart.points[0].revenue)} r="4" fill={COLORS.current} />
              )}
              {/* Latest value, labelled */}
              {chart.points.length > 0 && hover === null && (() => {
                const i = chart.points.length - 1;
                const p = chart.points[i];
                return (
                  <g>
                    <circle cx={chart.x(i)} cy={chart.y(p.revenue)} r="4" fill={COLORS.current} stroke="#fff" strokeWidth="2" />
                    <text
                      x={chart.x(i) + (i > n * 0.8 ? -8 : 8)}
                      y={chart.y(p.revenue) - 8}
                      textAnchor={i > n * 0.8 ? 'end' : 'start'}
                      fontSize="11"
                      fontWeight="600"
                      fill="#111827"
                    >
                      {compactINR(p.revenue)}
                    </text>
                  </g>
                );
              })()}
              {/* Crosshair */}
              {hover !== null && (
                <g>
                  <line x1={chart.x(hover)} x2={chart.x(hover)} y1={0} y2={PH} stroke={COLORS.axis} />
                  {hprev && <circle cx={chart.x(hover)} cy={chart.y(hprev.revenue)} r="4" fill={COLORS.previous} stroke="#fff" strokeWidth="2" />}
                  {hp && <circle cx={chart.x(hover)} cy={chart.y(hp.revenue)} r="4.5" fill={COLORS.current} stroke="#fff" strokeWidth="2" />}
                </g>
              )}
              {/* Hit area covering the whole plot */}
              <rect x={-M.left} y={0} width={W + M.left + M.right} height={PH} fill="transparent" />
            </g>
          </svg>
        )}

        {/* Tooltip */}
        {chart && hover !== null && (hp || hprev) && (
          <div
            className="pointer-events-none absolute z-10 bg-white border border-[#e5e7eb] rounded-lg shadow-lg px-3 py-2 text-xs min-w-[190px]"
            style={{
              top: 4,
              left: Math.min(Math.max(M.left + chart.x(hover) + 12, 0), width - 210),
            }}
          >
            <p className="text-[#6b7280] mb-1.5">{bucketLabel(data.periodStart + hover * step)}</p>
            {(() => {
              const t0 = data.periodStart + hover * step;
              const s = (data.sales || []).find(
                (x) => new Date(x.startsAt).getTime() < t0 + step && new Date(x.endsAt).getTime() > t0
              );
              return s ? (
                <p className="text-[11px] font-medium mb-1.5" style={{ color: COLORS.saleText }}>
                  {s.name} · {s.discountPercent}% off
                </p>
              ) : null;
            })()}
            <div className="flex items-center gap-2">
              <svg width="14" height="6" aria-hidden="true"><line x1="0" y1="3" x2="14" y2="3" stroke={COLORS.current} strokeWidth="2" /></svg>
              <span className="font-semibold text-[#111827] tabular-nums">{hp ? `₹${fmtINR(hp.revenue)}` : '—'}</span>
              <span className="text-[#6b7280]">{meta.current}</span>
            </div>
            {hp && (
              <p className="text-[#6b7280] pl-[22px] tabular-nums">
                {hp.orders} order{hp.orders === 1 ? '' : 's'} · {hp.orders - hp.botOrders} real · {hp.botOrders} bot
              </p>
            )}
            <div className="flex items-center gap-2 mt-1">
              <svg width="14" height="6" aria-hidden="true"><line x1="0" y1="3" x2="14" y2="3" stroke={COLORS.previous} strokeWidth="2" strokeDasharray="4 3" /></svg>
              <span className="font-semibold text-[#111827] tabular-nums">{hprev ? `₹${fmtINR(hprev.revenue)}` : '—'}</span>
              <span className="text-[#6b7280]">{meta.previous}</span>
            </div>
          </div>
        )}
      </div>

      {chart && (
        <div className="mt-2">
          <button onClick={() => setShowTable((s) => !s)} className="text-xs text-[#2563eb] hover:text-[#1d4ed8]">
            {showTable ? 'Hide' : 'Show'} as table
          </button>
          {showTable && (
            <div className="mt-2 max-h-64 overflow-auto border border-[#f3f4f6] rounded-lg">
              <table className="w-full text-xs tabular-nums">
                <thead className="bg-[#f9fafb] text-[#6b7280] sticky top-0">
                  <tr>
                    <th className="text-left font-medium px-3 py-2">{range === 'day' ? 'Hour' : 'Day'}</th>
                    <th className="text-right font-medium px-3 py-2">Revenue</th>
                    <th className="text-right font-medium px-3 py-2">Orders</th>
                    <th className="text-right font-medium px-3 py-2">{meta.previous}</th>
                  </tr>
                </thead>
                <tbody>
                  {chart.points.map((p, i) => (
                    <tr key={p.t} className="border-t border-[#f3f4f6]">
                      <td className="px-3 py-1.5 text-[#374151]">{bucketLabel(p.t)}</td>
                      <td className="px-3 py-1.5 text-right text-[#111827]">₹{fmtINR(p.revenue)}</td>
                      <td className="px-3 py-1.5 text-right text-[#374151]">{p.orders}</td>
                      <td className="px-3 py-1.5 text-right text-[#6b7280]">₹{fmtINR(chart.prevFull[i]?.revenue || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
