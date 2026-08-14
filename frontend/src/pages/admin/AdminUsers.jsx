import { useEffect, useState } from 'react';
import api from '../../services/api';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api
      .get('/admin/users')
      .then((res) => setUsers(res.data.users))
      .catch((err) => console.error('Failed to load users:', err))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function toggleBlock(userId, currentlyBlocked) {
    try {
      await api.put(`/admin/users/${userId}/block`, { blocked: !currentlyBlocked });
      load();
    } catch (err) {
      console.error('Failed to update user:', err);
    }
  }

  if (loading) return <p className="text-ink/40 text-sm">Loading...</p>;

  const realUsers = users.filter((u) => !u.email.endsWith('@shopsmart-synthetic.internal'));
  const botUsers = users.filter((u) => u.email.endsWith('@shopsmart-synthetic.internal'));

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display font-semibold text-lg mb-4">Customers ({realUsers.length})</h2>
        <div className="border border-line rounded-sm divide-y divide-line">
          {realUsers.map((u) => (
            <div key={u.id} className="flex items-center justify-between px-4 py-3 text-sm gap-4">
              <span className="flex-1">
                {u.name} <span className="text-ink/40">({u.email})</span>
              </span>
              <span className="text-xs px-2 py-0.5 rounded-sm bg-emerald-light text-emerald capitalize">
                {u.role}
              </span>
              {u.is_blocked ? (
                <button onClick={() => toggleBlock(u.id, true)} className="text-emerald text-xs">
                  Unblock
                </button>
              ) : (
                <button onClick={() => toggleBlock(u.id, false)} className="text-coral text-xs">
                  Block
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-display font-semibold text-lg mb-2">Synthetic bot accounts ({botUsers.length})</h2>
        <p className="text-ink/40 text-xs mb-4">
          Tagged by email domain — used by the traffic generator for calibrated real checkouts.
        </p>
        <div className="border border-line rounded-sm divide-y divide-line opacity-60">
          {botUsers.map((u) => (
            <div key={u.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <span>{u.name}</span>
              <span className="text-ink/40 text-xs font-mono">{u.email}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}