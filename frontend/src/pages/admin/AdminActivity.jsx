import { useEffect, useState } from 'react';
import api from '../../services/api';

// How each visit ended (see traffic-generator/bot.js)
const OUTCOMES = {
  purchase: { label: 'Purchase', cls: 'bg-[#ecfdf5] text-[#047857]' },
  abandoned_cart: { label: 'Abandoned cart', cls: 'bg-[#fffbeb] text-[#b45309]' },
  abandoned_checkout: { label: 'Abandoned checkout', cls: 'bg-[#fffbeb] text-[#b45309]' },
  payment_failed: { label: 'Payment failed', cls: 'bg-[#fef2f2] text-[#b91c1c]' },
  order_failed: { label: 'Order failed', cls: 'bg-[#fef2f2] text-[#b91c1c]' },
  visit: { label: 'Browsed', cls: 'bg-[#f3f4f6] text-[#4b5563]' },
};

function timeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

export default function AdminActivity() {
  const [activity, setActivity] = useState([]);
  const [activeBots, setActiveBots] = useState(0);
  const [summary, setSummary] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [feed, sum] = await Promise.all([
          api.get('/bot-activity/recent?limit=40'),
          api.get('/bot-activity/summary?minutes=60'),
        ]);
        setActivity(feed.data.activity);
        setActiveBots(feed.data.activeBots);
        setSummary(sum.data.outcomes);
        setError('');
      } catch {
        setError('Could not load bot activity');
      }
    }
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const visits = Object.values(summary).reduce((a, b) => a + b, 0);
  const purchases = summary.purchase || 0;
  const carts = purchases + (summary.abandoned_cart || 0) + (summary.abandoned_checkout || 0) + (summary.payment_failed || 0) + (summary.order_failed || 0);
  const checkouts = purchases + (summary.abandoned_checkout || 0) + (summary.payment_failed || 0) + (summary.order_failed || 0);

  return (
    <div className="space-y-6">
      <p className="text-sm text-[#6b7280]">
        Synthetic shoppers from the traffic generator. Internal only — this traffic feeds the AI-SRE baseline and is
        never shown to customers. Their accounts use the <span className="font-mono">@shopsmart-synthetic.internal</span>{' '}
        email domain.
      </p>
      {error && <p className="text-xs text-[#dc2626]">{error}</p>}

      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-base font-semibold">Last hour</h2>
          <span className="flex items-center gap-2 text-xs text-[#6b7280]">
            <span className={`w-1.5 h-1.5 rounded-full ${activeBots > 0 ? 'bg-[#16a34a]' : 'bg-[#dc2626]'}`} />
            {activeBots} bot{activeBots === 1 ? '' : 's'} active now
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            ['Visits', visits],
            ['Added to cart', carts],
            ['Reached checkout', checkouts],
            ['Orders', purchases],
            ['Conversion', visits ? `${((purchases / visits) * 100).toFixed(1)}%` : '—'],
          ].map(([label, value]) => (
            <div key={label} className="bg-white border border-[#e5e7eb] rounded-xl px-4 py-3">
              <p className="text-xs text-[#6b7280]">{label}</p>
              <p className="text-xl font-semibold mt-1 tabular-nums">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-base font-semibold mb-3">Recent visits</h2>
        <div className="bg-white border border-[#e5e7eb] rounded-xl divide-y divide-[#f3f4f6] max-h-[560px] overflow-y-auto">
          {activity.length === 0 ? (
            <p className="text-[#6b7280] text-sm p-6">Waiting for activity…</p>
          ) : (
            activity.map((event, i) => {
              const o = OUTCOMES[event.action] || { label: event.action, cls: 'bg-[#f3f4f6] text-[#4b5563]' };
              return (
                <div key={i} className="flex items-start gap-3 px-4 py-3 text-sm">
                  <span className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full ${o.cls}`}>{o.label}</span>
                  <span className="flex-1 min-w-0 text-[#374151]">
                    <span className="font-mono text-xs text-[#6b7280] mr-2">bot {event.bot_id}</span>
                    {event.detail}
                  </span>
                  <span className="text-[#9ca3af] text-xs font-mono shrink-0">{timeAgo(event.created_at)}</span>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
