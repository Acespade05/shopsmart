import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { CATEGORY_LABEL } from '../utils/categories';

// Strip above the header: the live sale with a countdown, or a heads-up for a
// sale starting within the next 3 days. Sales are scheduled in Admin → Sales.
const SOON_MS = 3 * 86400e3;

function countdown(ms) {
  if (ms <= 0) return 'ending now';
  const m = Math.floor(ms / 60000);
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const min = m % 60;
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${min}m left`;
  return `${Math.max(min, 1)}m left`;
}

function scope(sale) {
  if (!sale.categories) return 'everything';
  const names = sale.categories.map((s) => CATEGORY_LABEL[s] || s);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}` : names[0];
}

function startsLabel(date) {
  return new Date(date).toLocaleString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function SaleBanner() {
  const [state, setState] = useState(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let alive = true;
    const load = () =>
      api
        .get('/sales/active')
        .then((res) => alive && setState(res.data))
        .catch(() => {});
    load();
    const poll = setInterval(load, 60000);
    const tick = setInterval(() => setNow(Date.now()), 30000);
    return () => {
      alive = false;
      clearInterval(poll);
      clearInterval(tick);
    };
  }, []);

  const live = state?.sale && new Date(state.sale.endsAt).getTime() > now ? state.sale : null;
  const next = !live && state?.next && new Date(state.next.startsAt).getTime() - now < SOON_MS ? state.next : null;
  if (!live && !next) return null;

  if (live) {
    const to = live.categories?.length === 1 ? `/category/${live.categories[0]}` : '/products?sort=discount';
    return (
      <div className="relative z-50 bg-gradient-to-r from-[#7a4e12] via-[#C08A2E] to-[#7a4e12] text-[#0b0a08]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm">
          <span className="font-display font-semibold tracking-wide">{live.name}</span>
          <span className="font-medium">
            {live.discountPercent}% off {scope(live)}
          </span>
          <span className="font-mono text-xs bg-[#0b0a08]/15 rounded px-2 py-0.5">
            {countdown(new Date(live.endsAt).getTime() - now)}
          </span>
          <Link to={to} className="font-semibold underline underline-offset-2 hover:no-underline">
            Shop the sale →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-50 bg-[#14120e] border-b border-[#C08A2E]/30 text-[#f3eee3]/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 text-center text-xs sm:text-sm">
        <span className="text-[#C08A2E] font-semibold">{next.name}</span> starts {startsLabel(next.startsAt)} —{' '}
        {next.discountPercent}% off {scope(next)}
      </div>
    </div>
  );
}
