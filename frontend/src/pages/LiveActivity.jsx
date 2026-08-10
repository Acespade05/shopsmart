import { useEffect, useState, useRef } from 'react';
import api from '../services/api';

const actionLabels = {
  browse_home: 'browsed top rated products',
  browse_category: 'browsed',
  view_product: 'viewed',
  search: 'searched for',
  add_to_cart: 'added to cart',
  view_cart: 'viewed their cart',
};

function timeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}

export default function LiveActivity() {
  const [activity, setActivity] = useState([]);
  const [activeBots, setActiveBots] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    async function fetchActivity() {
      try {
        const res = await api.get('/bot-activity/recent?limit=40');
        setActivity(res.data.activity);
        setActiveBots(res.data.activeBots);
      } catch (err) {
        console.error('Failed to fetch bot activity:', err);
      }
    }

    fetchActivity();
    intervalRef.current = setInterval(fetchActivity, 3000);
    return () => clearInterval(intervalRef.current);
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <p className="font-mono text-xs tracking-widest text-emerald uppercase mb-2">Live</p>
      <div className="flex items-baseline justify-between mb-2">
        <h1 className="text-3xl font-display font-semibold">Simulated shopper activity</h1>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald animate-pulse" />
          <span className="text-sm font-mono text-emerald">{activeBots} active</span>
        </div>
      </div>
      <p className="text-ink/50 text-sm mb-8">
        This page shows synthetic shopper bots browsing ShopSmart in real time — generating the
        baseline traffic data used to train the AI-SRE anomaly detection system. No real accounts
        or orders are created by these bots.
      </p>

      <div className="border border-line rounded-sm divide-y divide-line">
        {activity.length === 0 ? (
          <p className="text-ink/40 text-sm p-6">Waiting for activity...</p>
        ) : (
          activity.map((event, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3 text-sm">
              <span>
                <span className="font-mono text-emerald">Bot #{event.bot_id}</span>{' '}
                <span className="text-ink/70">{actionLabels[event.action] || event.action}</span>{' '}
                {event.detail && <span className="font-medium">{event.detail}</span>}
              </span>
              <span className="text-ink/30 text-xs font-mono shrink-0 ml-4">
                {timeAgo(event.created_at)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}