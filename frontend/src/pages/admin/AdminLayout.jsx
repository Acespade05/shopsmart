import { useState } from 'react';
import { Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AdminOverview from './AdminOverview';
import AdminOrders from './AdminOrders';
import AdminInventory from './AdminInventory';
import AdminUsers from './AdminUsers';
import AdminDiscounts from './AdminDiscounts';
import AdminActivity from './AdminActivity';

const tabs = [
  { key: 'overview', label: 'Overview' },
  { key: 'orders', label: 'Orders' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'users', label: 'Users' },
  { key: 'discounts', label: 'Discounts' },
  { key: 'activity', label: 'Bot Activity' },
];

export default function AdminLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const activeTab = params.get('tab') || 'overview';

  if (loading) return null;
  if (!user || user.role !== 'admin') return <Navigate to="/" replace />;

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex items-baseline justify-between mb-8">
        <h1 className="text-3xl font-display font-semibold">Admin</h1>
        <span className="text-xs font-mono text-ink/40">signed in as {user.email}</span>
      </div>

      <div className="flex gap-1 border-b border-line mb-8 overflow-x-auto">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            to={`/admin?tab=${tab.key}`}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-emerald text-emerald'
                : 'border-transparent text-ink/50 hover:text-ink'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {activeTab === 'overview' && <AdminOverview />}
      {activeTab === 'orders' && <AdminOrders />}
      {activeTab === 'inventory' && <AdminInventory />}
      {activeTab === 'users' && <AdminUsers />}
      {activeTab === 'discounts' && <AdminDiscounts />}
      {activeTab === 'activity' && <AdminActivity />}
    </div>
  );
}