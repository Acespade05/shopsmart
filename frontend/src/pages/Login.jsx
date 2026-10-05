import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Return to the page that sent the shopper here (e.g. checkout). Only local paths.
  const next = (searchParams.get('next') || '').startsWith('/') && !(searchParams.get('next') || '').startsWith('//')
    ? searchParams.get('next')
    : '/';

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate(next);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto px-6 py-20">
      <h1 className="text-3xl font-display font-semibold mb-8 text-center">Sign in</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p className="text-coral text-sm bg-coral/10 border border-coral/20 rounded-sm px-3 py-2">
            {error}
          </p>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-field"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-field"
          />
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <p className="text-center text-sm text-ink/60 mt-6">
        Don't have an account?{' '}
        <Link to={next === '/' ? '/register' : `/register?next=${encodeURIComponent(next)}`} className="text-emerald hover:underline">
          Register
        </Link>
      </p>
    </div>
  );
}