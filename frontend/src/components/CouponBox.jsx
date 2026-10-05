import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { savedCoupon, saveCoupon } from '../utils/coupon';

const inr = (n) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

function describe(o) {
  const off = o.type === 'percentage' ? `${o.value}% off` : `${inr(o.value)} off`;
  return o.minOrderValue > 0 ? `${off} on orders above ${inr(o.minOrderValue)}` : `${off} on any order`;
}

// Cart-page coupons: lists the store's offers and lets a signed-in shopper apply one.
// The chosen code is carried to checkout, which applies it again server-side.
export default function CouponBox({ subtotal }) {
  const { user } = useAuth();
  const [offers, setOffers] = useState([]);
  const [code, setCode] = useState(savedCoupon());
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/checkout/offers').then((res) => setOffers(res.data.offers)).catch(() => {});
  }, []);

  async function apply(c = code) {
    const value = c.trim().toUpperCase();
    if (!value) return;
    setError('');
    try {
      const res = await api.post('/checkout/apply-coupon', { code: value });
      setResult(res.data);
      setCode(value);
      saveCoupon(value);
    } catch (err) {
      setResult(null);
      saveCoupon('');
      setError(err.response?.data?.error || 'Invalid coupon');
    }
  }

  // Re-check a previously applied code when the cart total changes.
  useEffect(() => {
    if (user && savedCoupon()) apply(savedCoupon());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, subtotal]);

  return (
    <div className="border border-line rounded-sm p-5">
      <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-emerald mb-3">Offers & coupons</p>

      {offers.length > 0 && (
        <ul className="space-y-2 mb-4">
          {offers.map((o) => (
            <li key={o.code} className="flex items-center justify-between gap-3 text-xs">
              <span className="text-ink/60">
                <span className="font-mono text-ink">{o.code}</span> · {describe(o)}
              </span>
              {user && subtotal >= o.minOrderValue && (
                <button onClick={() => apply(o.code)} className="text-emerald hover:underline shrink-0">
                  Apply
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {user ? (
        <>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Enter code"
              aria-label="Coupon code"
              className="input-field flex-1"
            />
            <button onClick={() => apply()} className="btn-secondary">
              Apply
            </button>
          </div>
          {error && <p className="text-coral text-xs mt-2">{error}</p>}
          {result && (
            <p className="text-emerald text-xs mt-2">
              {result.code.startsWith('TIER')
                ? `Your automatic discount saves more: ${inr(result.discount)} off.`
                : `"${result.code}" applied — you save ${inr(result.discount)}.`}
            </p>
          )}
        </>
      ) : (
        <Link to="/login?next=/cart" className="text-xs text-emerald hover:underline">
          Sign in to apply a coupon →
        </Link>
      )}
    </div>
  );
}
