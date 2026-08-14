import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../../services/api';

export default function AdminOverview() {
  const [dashboard, setDashboard] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/admin/dashboard'), api.get('/admin/analytics')])
      .then(([dashRes, anaRes]) => {
        setDashboard(dashRes.data);
        setAnalytics(anaRes.data);
      })
      .catch((err) => console.error('Failed to load overview:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-ink/40 text-sm">Loading...</p>;
  if (!dashboard) return <p className="text-coral text-sm">Failed to load dashboard data.</p>;

  const chartData = (analytics?.revenueByDay || []).map((d) => ({
    day: new Date(d.day).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
    revenue: parseFloat(d.revenue),
  }));

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Revenue today" value={`₹${parseFloat(dashboard.revenueToday).toLocaleString('en-IN')}`} />
        <StatCard label="Orders today" value={dashboard.ordersToday} />
        <StatCard label="Active sessions" value={dashboard.activeSessions} />
        <StatCard label="Top product" value={dashboard.topProducts[0]?.name || '—'} small />
      </div>

      <div>
        <h2 className="font-display font-semibold text-lg mb-4">Revenue — last 30 days</h2>
        <div className="h-64 border border-line rounded-sm p-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="day" fontSize={11} stroke="#171512" opacity={0.4} />
              <YAxis fontSize={11} stroke="#171512" opacity={0.4} />
              <Tooltip formatter={(v) => `₹${v.toLocaleString('en-IN')}`} />
              <Bar dataKey="revenue" fill="#0B6E4F" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h2 className="font-display font-semibold text-lg mb-4">Top products by revenue</h2>
        <div className="border border-line rounded-sm divide-y divide-line">
          {(analytics?.topProducts || []).slice(0, 8).map((p, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3 text-sm">
              <span>{p.name}</span>
              <span className="text-ink/40 font-mono text-xs">{p.units_sold} sold</span>
              <span className="font-mono">₹{parseFloat(p.revenue).toLocaleString('en-IN')}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, small }) {
  return (
    <div className="border border-line rounded-sm p-4">
      <p className="text-ink/40 text-xs mb-1">{label}</p>
      <p className={small ? 'font-medium text-sm line-clamp-1' : 'text-2xl font-display font-semibold'}>{value}</p>
    </div>
  );
}