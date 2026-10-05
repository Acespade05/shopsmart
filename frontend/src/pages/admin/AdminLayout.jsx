import { Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AdminOverview from './AdminOverview';
import AdminOrders from './AdminOrders';
import AdminInventory from './AdminInventory';
import AdminUsers from './AdminUsers';
import AdminDiscounts from './AdminDiscounts';
import AdminActivity from './AdminActivity';
import usePageTitle from '../../hooks/usePageTitle';

const tabs = [
  { key: 'overview', label: 'Overview' },
  { key: 'orders', label: 'Orders & returns' },
  { key: 'inventory', label: 'Products & stock' },
  { key: 'discounts', label: 'Discounts' },
  { key: 'users', label: 'Customers' },
  { key: 'activity', label: 'Bot activity' },
];

// Old links (?tab=returns) now live inside the Orders tab.
const ALIASES = { returns: 'orders' };

export default function AdminLayout() {
  usePageTitle('Admin');
  const { user, loading } = useAuth();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const requested = params.get('tab') || 'overview';
  const activeTab = ALIASES[requested] || requested;

  if (loading) return null;
  if (!user || user.role !== 'admin') return <Navigate to="/" replace />;

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-8">
        <div>
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#e3a857] mb-2">Store admin</p>
          <h1 className="text-3xl font-display font-semibold text-[#f3eee3]">
            {tabs.find((t) => t.key === activeTab)?.label || 'Admin'}
          </h1>
        </div>
        <span className="text-xs font-mono text-[#f3eee3]/35">signed in as {user.email}</span>
      </div>

      <nav aria-label="Admin sections" className="flex gap-1 border-b border-[#f3eee3]/10 mb-8 overflow-x-auto">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            to={`/admin?tab=${tab.key}`}
            aria-current={activeTab === tab.key ? 'page' : undefined}
            className={`px-4 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
              activeTab === tab.key
                ? 'border-[#e3a857] text-[#e3a857]'
                : 'border-transparent text-[#f3eee3]/50 hover:text-[#f3eee3]'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {activeTab === 'overview' && <AdminOverview />}
      {activeTab === 'orders' && <AdminOrders />}
      {activeTab === 'inventory' && <AdminInventory />}
      {activeTab === 'users' && <AdminUsers />}
      {activeTab === 'discounts' && <AdminDiscounts />}
      {activeTab === 'activity' && <AdminActivity />}
    </div>
  );
}
