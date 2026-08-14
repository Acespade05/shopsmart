import { useEffect, useState } from 'react';
import api from '../services/api';

// Zepto/Zomato-style progressive discount bar: shows current unlocked
// discount and how much more to spend to unlock the next tier.
export default function DiscountProgress({ subtotal }) {
  const [tiers, setTiers] = useState([]);

  useEffect(() => {
    api
      .get('/checkout/tiers')
      .then((res) => setTiers(res.data.tiers))
      .catch((err) => console.error('Failed to load discount tiers:', err));
  }, []);

  if (tiers.length === 0) return null;

  const unlockedTier = [...tiers].reverse().find((t) => subtotal >= t.minOrderValue);
  const nextTier = tiers.find((t) => subtotal < t.minOrderValue);

  const progressTarget = nextTier ? nextTier.minOrderValue : tiers[tiers.length - 1].minOrderValue;
  const progressPercent = Math.min((subtotal / progressTarget) * 100, 100);

  return (
    <div className="bg-emerald-light border border-emerald/20 rounded-sm p-4">
      {unlockedTier && (
        <p className="text-emerald text-sm font-medium mb-2">
          🎉 You've unlocked {unlockedTier.discountPercent}% off
        </p>
      )}

      {nextTier ? (
        <>
          <p className="text-ink/70 text-sm mb-2">
            Add ₹{(nextTier.minOrderValue - subtotal).toLocaleString('en-IN')} more to unlock{' '}
            <span className="font-semibold">{nextTier.discountPercent}% off</span>
          </p>
          <div className="w-full h-2 bg-paper rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </>
      ) : (
        <p className="text-ink/70 text-sm">You've unlocked our best discount available 🎉</p>
      )}
    </div>
  );
}