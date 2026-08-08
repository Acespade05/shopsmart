import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  function update(field) {
    return (e) => setForm({ ...form, [field]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form.name, form.email, form.password, form.phone);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto px-6 py-20">
      <h1 className="text-3xl font-display font-semibold mb-8 text-center">Create account</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p className="text-coral text-sm bg-coral/10 border border-coral/20 rounded-sm px-3 py-2">
            {error}
          </p>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Full name</label>
          <input type="text" required value={form.name} onChange={update('name')} className="input-field" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input type="email" required value={form.email} onChange={update('email')} className="input-field" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Phone (optional)</label>
          <input type="tel" value={form.phone} onChange={update('phone')} className="input-field" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <input
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={update('password')}
            className="input-field"
          />
          <p className="text-xs text-ink/40 mt-1">At least 8 characters</p>
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      <p className="text-center text-sm text-ink/60 mt-6">
        Already have an account?{' '}
        <Link to="/login" className="text-emerald hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}