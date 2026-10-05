import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import usePageTitle from '../hooks/usePageTitle';

export default function Profile() {
  usePageTitle('Your profile');
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <h1 className="text-3xl font-display font-semibold mb-3">Sign in to view your profile</h1>
        <Link to="/login" className="btn-primary inline-block mt-4">
          Sign in
        </Link>
      </div>
    );
  }

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    setSaved(false);
    setSaving(true);
    try {
      await api.put('/auth/me', { name, phone });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto px-6 py-16">
      <h1 className="text-3xl font-display font-semibold mb-8">Your profile</h1>

      <form onSubmit={handleSave} className="space-y-4">
        {error && (
          <p className="text-coral text-sm bg-coral/10 border border-coral/20 rounded-sm px-3 py-2">
            {error}
          </p>
        )}
        {saved && (
          <p className="text-emerald text-sm bg-emerald-light rounded-sm px-3 py-2">
            Profile updated
          </p>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input type="email" value={user.email} disabled className="input-field bg-ink/5 text-ink/40" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Full name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-field"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Phone</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="input-field"
          />
        </div>

        <button type="submit" disabled={saving} className="btn-primary w-full disabled:opacity-50">
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </form>

      <div className="mt-8 pt-8 border-t border-line space-y-3">
        <Link to="/orders" className="block text-sm text-emerald hover:underline">
          View order history →
        </Link>
        <Link to="/wishlist" className="block text-sm text-emerald hover:underline">
          View wishlist →
        </Link>
        <button
          onClick={() => {
            logout();
            navigate('/');
          }}
          className="text-sm text-coral hover:underline"
        >
          Log out
        </button>
      </div>
    </div>
  );
}