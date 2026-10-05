import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

function Stars({ value, size = 'text-sm' }) {
  return (
    <span className={`${size} tracking-[0.1em]`} aria-label={`${value} out of 5 stars`}>
      <span className="text-[#e3a857]">{'★'.repeat(Math.round(value))}</span>
      <span className="text-[#f3eee3]/15">{'★'.repeat(5 - Math.round(value))}</span>
    </span>
  );
}

function ReviewForm({ productId, onDone }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!rating) {
      setError('Please choose a star rating');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.post(`/reviews/${productId}`, { rating, title: title.trim(), body: body.trim() });
      setRating(0);
      setTitle('');
      setBody('');
      onDone();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save your review');
    } finally {
      setSaving(false);
    }
  }

  const field =
    'w-full bg-transparent border border-[#f3eee3]/15 px-3 py-2.5 text-sm text-[#f3eee3] placeholder:text-[#f3eee3]/25 outline-none focus:border-[#e3a857]/60 rounded-sm';

  return (
    <form onSubmit={submit} className="border border-[#f3eee3]/10 rounded-sm p-6 space-y-4">
      <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-[#e3a857]">Write a review</p>
      <div className="flex gap-1" onMouseLeave={() => setHover(0)} role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            onMouseEnter={() => setHover(n)}
            onClick={() => setRating(n)}
            className={`text-2xl leading-none ${(hover || rating) >= n ? 'text-[#e3a857]' : 'text-[#f3eee3]/15'}`}
          >
            ★
          </button>
        ))}
      </div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Title (optional)" className={field} />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        placeholder="What did you like or dislike?"
        className={field}
      />
      {error && <p className="text-xs text-[#e8604c]">{error}</p>}
      <button
        disabled={saving}
        className="px-6 py-2.5 rounded-sm text-sm font-medium text-[#0b0a08] bg-gradient-to-r from-[#f0c07f] to-[#e3a857] disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Submit review'}
      </button>
      <p className="text-[11px] text-[#f3eee3]/30">Submitting again updates your earlier review.</p>
    </form>
  );
}

export default function Reviews({ product, reviews, onChange }) {
  const { user } = useAuth();
  const rating = parseFloat(product.rating) || 0;

  // Star breakdown from the written reviews shown on this page.
  const counts = [5, 4, 3, 2, 1].map((n) => reviews.filter((r) => r.rating === n).length);

  return (
    <section id="reviews" className="mt-20 pt-12 border-t border-[#f3eee3]/10 scroll-mt-32">
      <h2 className="font-display text-2xl font-semibold mb-8">Customer reviews</h2>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-12">
        <div className="space-y-8">
          <div>
            <div className="flex items-baseline gap-3">
              <span className="font-display text-5xl font-semibold">{rating.toFixed(1)}</span>
              <span className="text-sm text-[#f3eee3]/40">out of 5</span>
            </div>
            <Stars value={rating} size="text-lg" />
            <p className="text-xs text-[#f3eee3]/40 mt-1">
              {Number(product.review_count).toLocaleString('en-IN')} rating{Number(product.review_count) === 1 ? '' : 's'}
            </p>
          </div>

          {reviews.length > 0 && (
            <div className="space-y-1.5">
              {[5, 4, 3, 2, 1].map((n, i) => (
                <div key={n} className="flex items-center gap-3 text-xs">
                  <span className="w-8 text-[#f3eee3]/50">{n} ★</span>
                  <div className="flex-1 h-1.5 bg-[#f3eee3]/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#e3a857]"
                      style={{ width: `${(counts[i] / reviews.length) * 100}%` }}
                    />
                  </div>
                  <span className="w-6 text-right text-[#f3eee3]/40">{counts[i]}</span>
                </div>
              ))}
              <p className="text-[11px] text-[#f3eee3]/30 pt-1">From {reviews.length} written review{reviews.length > 1 ? 's' : ''}</p>
            </div>
          )}

          {user ? (
            <ReviewForm productId={product.id} onDone={onChange} />
          ) : (
            <div className="border border-[#f3eee3]/10 rounded-sm p-6">
              <p className="text-sm text-[#f3eee3]/70">Bought this product?</p>
              <Link to="/login" className="inline-block mt-3 text-sm text-[#e3a857] hover:text-[#f0c07f]">
                Sign in to write a review →
              </Link>
            </div>
          )}
        </div>

        <div>
          {reviews.length === 0 ? (
            <p className="text-sm text-[#f3eee3]/40 py-6">No written reviews yet. Be the first to share your thoughts.</p>
          ) : (
            <ul className="divide-y divide-[#f3eee3]/[0.07]">
              {reviews.map((r) => (
                <li key={r.id} className="py-6 first:pt-0">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-[#e3a857]/15 text-[#e3a857] text-xs flex items-center justify-center font-medium">
                      {(r.user_name || '?').charAt(0).toUpperCase()}
                    </span>
                    <span className="text-sm text-[#f3eee3]/80">{r.user_name}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-3">
                    <Stars value={r.rating} />
                    {r.title && <span className="text-sm font-medium">{r.title}</span>}
                  </div>
                  <p className="text-[11px] text-[#f3eee3]/35 mt-1">
                    Reviewed on{' '}
                    {new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                  {/* Rendered as plain text (React escapes it). */}
                  {r.body && <p className="text-sm leading-relaxed text-[#f3eee3]/65 mt-3 whitespace-pre-line">{r.body}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
