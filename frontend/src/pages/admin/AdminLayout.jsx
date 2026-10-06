import { useEffect, useState } from 'react';
import { Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AdminOverview from './AdminOverview';
import AdminOrders from './AdminOrders';
import AdminInventory from './AdminInventory';
import AdminUsers from './AdminUsers';
import AdminDiscounts from './AdminDiscounts';
import AdminActivity from './AdminActivity';
import usePageTitle from '../../hooks/usePageTitle';

// Simple line icons (24×24, stroke = currentColor)
const ICONS = {
  overview: 'M3 13h8V3H3zm10 8h8V11h-8zM3 21h8v-6H3zm10-18v6h8V3z',
  orders: 'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0',
  inventory: 'M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
  discounts: 'M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm14 10v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  activity: 'M22 12h-4l-3 9L9 3l-3 9H2',
};

const tabs = [
  { key: 'overview', label: 'Overview', Component: AdminOverview },
  { key: 'orders', label: 'Orders & returns', Component: AdminOrders },
  { key: 'inventory', label: 'Products & stock', Component: AdminInventory },
  { key: 'discounts', label: 'Discounts', Component: AdminDiscounts },
  { key: 'users', label: 'Customers', Component: AdminUsers },
  { key: 'activity', label: 'Bot activity', Component: AdminActivity },
];

// Old links (?tab=returns) now live inside the Orders tab.
const ALIASES = { returns: 'orders' };

function Icon({ name }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

export default function AdminLayout() {
  const { user, loading, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const params = new URLSearchParams(location.search);
  const requested = params.get('tab') || 'overview';
  const activeKey = ALIASES[requested] || requested;
  const active = tabs.find((t) => t.key === activeKey) || tabs[0];
  usePageTitle(`${active.label} · Admin`);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.search]);

  // The admin chunk loaded fine, so allow one auto-reload again after the next deploy.
  useEffect(() => {
    try {
      sessionStorage.removeItem('admin_chunk_reloaded');
    } catch {
      // ignore
    }
  }, []);

  if (loading) return <div className="min-h-screen bg-[#f5f6f8]" />;
  if (!user) return <Navigate to="/login?next=/admin" replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;

  const Page = active.Component;

  const nav = (
    <nav aria-label="Admin sections" className="space-y-1">
      {tabs.map((tab) => {
        const current = tab.key === active.key;
        return (
          <Link
            key={tab.key}
            to={`/admin?tab=${tab.key}`}
            aria-current={current ? 'page' : undefined}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              current ? 'bg-[#eff6ff] text-[#1d4ed8] font-medium' : 'text-[#4b5563] hover:bg-[#f3f4f6] hover:text-[#111827]'
            }`}
          >
            <Icon name={tab.key} />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="space-y-3 text-sm">
      <a href="/" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[#4b5563] hover:text-[#1d4ed8]">
        View store ↗
      </a>
      <div className="pt-3 border-t border-[#e5e7eb]">
        <p className="text-xs text-[#6b7280] truncate" title={user.email}>
          {user.email}
        </p>
        <button
          onClick={() => {
            logout();
            navigate('/login');
          }}
          className="mt-1 text-xs text-[#6b7280] hover:text-[#dc2626]"
        >
          Log out
        </button>
      </div>
    </div>
  );

  const brand = (
    <Link to="/admin" className="flex items-center gap-2">
      <span className="w-8 h-8 rounded-lg bg-[#2563eb] text-white flex items-center justify-center text-sm font-bold">S</span>
      <span className="font-semibold text-[#111827]">ShopSmart</span>
      <span className="text-[10px] font-medium uppercase tracking-wider text-[#2563eb] bg-[#eff6ff] px-1.5 py-0.5 rounded">Admin</span>
    </Link>
  );

  return (
    <div className="theme-admin flex">
      {/* Sidebar (desktop) */}
      <aside className="hidden lg:flex lg:flex-col w-60 shrink-0 h-screen sticky top-0 bg-white border-r border-[#e5e7eb] px-4 py-5">
        <div className="px-2 mb-8">{brand}</div>
        <div className="flex-1">{nav}</div>
        <div className="px-2">{footer}</div>
      </aside>

      <div className="flex-1 min-w-0">
        {/* Top bar (phones/tablets) */}
        <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-[#e5e7eb]">
          <div className="flex items-center justify-between px-4 h-14">
            {brand}
            <button
              onClick={() => setMenuOpen((o) => !o)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              className="w-10 h-10 flex items-center justify-center text-[#4b5563] text-xl"
            >
              {menuOpen ? '✕' : '☰'}
            </button>
          </div>
          {menuOpen && (
            <div className="px-4 pb-4 space-y-4">
              {nav}
              {footer}
            </div>
          )}
        </header>

        <main className="px-4 sm:px-8 py-8 max-w-6xl">
          <h1 className="text-2xl font-semibold text-[#111827] mb-6">{active.label}</h1>
          <Page />
        </main>
      </div>
    </div>
  );
}
