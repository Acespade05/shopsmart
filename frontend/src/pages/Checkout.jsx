import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import DiscountProgress from '../components/DiscountProgress';

export default function Checkout() {
  const { cart, subtotal, refreshCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [showNewAddress, setShowNewAddress] = useState(false);
  const [newAddress, setNewAddress] = useState({
    name: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '',
  });

  const [couponCode, setCouponCode] = useState('');
  const [couponResult, setCouponResult] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [autoTier, setAutoTier] = useState(null);

  const [paymentMethod, setPaymentMethod] = useState('card');
  const [error, setError] = useState('');
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (cart.items.length === 0) {
      navigate('/cart');
      return;
    }
    api.get('/addresses').then((res) => {
      setAddresses(res.data.addresses);
      const def = res.data.addresses.find((a) => a.is_default);
      if (def) setSelectedAddressId(def.id);
      else if (res.data.addresses.length > 0) setSelectedAddressId(res.data.addresses[0].id);
      else setShowNewAddress(true);
    });
    api.post('/checkout/start', {}).then((res) => {
      setAutoTier(res.data.autoTier);
    });
  }, [user]);

  async function handleSaveAddress(e) {
    e.preventDefault();
    try {
      const res = await api.post('/addresses', { ...newAddress, isDefault: addresses.length === 0 });
      setAddresses([...addresses, res.data.address]);
      setSelectedAddressId(res.data.address.id);
      setShowNewAddress(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save address');
    }
  }

  async function handleApplyCoupon() {
    setCouponError('');
    try {
      const res = await api.post('/checkout/apply-coupon', { code: couponCode });
      setCouponResult(res.data);
    } catch (err) {
      setCouponResult(null);
      setCouponError(err.response?.data?.error || 'Invalid coupon');
    }
  }

  // Effective discount: manual coupon if applied, otherwise automatic tier
  const effectiveDiscount = couponResult
    ? couponResult.discount
    : autoTier
    ? subtotal * (autoTier.discountPercent / 100)
    : 0;
  const total = subtotal - effectiveDiscount;

  async function handlePlaceOrder() {
    setError('');
    setPlacing(true);
    try {
      const paymentRes = await api.post('/checkout/payment', {
        amount: total,
        method: paymentMethod,
      });

      const orderRes = await api.post('/checkout/confirm', {
        addressId: selectedAddressId,
        paymentMethod,
        transactionId: paymentRes.data.payment.transactionId,
        discountCode: couponResult ? couponCode : undefined,
      });

      await refreshCart();
      navigate(`/orders/${orderRes.data.order.id}`, { state: { justPlaced: true } });
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong placing your order. Please try again.');
      setPlacing(false);
    }
  }

  if (!user || cart.items.length === 0) return null;

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-display font-semibold mb-6">Checkout</h1>

      <div className="mb-10">
        <DiscountProgress subtotal={subtotal} />
      </div>

      <div className="grid md:grid-cols-3 gap-10">
        <div className="md:col-span-2 space-y-10">
          <section>
            <h2 className="text-lg font-display font-semibold mb-4">1. Delivery address</h2>

            {addresses.length > 0 && !showNewAddress && (
              <div className="space-y-3 mb-4">
                {addresses.map((addr) => (
                  <label
                    key={addr.id}
                    className={`block border rounded-sm p-4 cursor-pointer transition-colors ${
                      selectedAddressId === addr.id ? 'border-emerald bg-emerald-light' : 'border-line'
                    }`}
                  >
                    <input
                      type="radio"
                      name="address"
                      className="mr-2"
                      checked={selectedAddressId === addr.id}
                      onChange={() => setSelectedAddressId(addr.id)}
                    />
                    <span className="font-medium text-sm">{addr.name}</span>
                    <p className="text-sm text-ink/60 mt-1 ml-5">
                      {addr.line1}, {addr.line2 ? `${addr.line2}, ` : ''}
                      {addr.city}, {addr.state} {addr.pincode}
                    </p>
                    <p className="text-sm text-ink/40 ml-5">{addr.phone}</p>
                  </label>
                ))}
                <button
                  onClick={() => setShowNewAddress(true)}
                  className="text-sm text-emerald hover:underline"
                >
                  + Add a new address
                </button>
              </div>
            )}

            {showNewAddress && (
              <form onSubmit={handleSaveAddress} className="space-y-3 border border-line rounded-sm p-4">
                <div className="grid grid-cols-2 gap-3">
                  <input
                    placeholder="Full name"
                    required
                    value={newAddress.name}
                    onChange={(e) => setNewAddress({ ...newAddress, name: e.target.value })}
                    className="input-field"
                  />
                  <input
                    placeholder="Phone"
                    required
                    value={newAddress.phone}
                    onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })}
                    className="input-field"
                  />
                </div>
                <input
                  placeholder="Address line 1"
                  required
                  value={newAddress.line1}
                  onChange={(e) => setNewAddress({ ...newAddress, line1: e.target.value })}
                  className="input-field"
                />
                <input
                  placeholder="Address line 2 (optional)"
                  value={newAddress.line2}
                  onChange={(e) => setNewAddress({ ...newAddress, line2: e.target.value })}
                  className="input-field"
                />
                <div className="grid grid-cols-3 gap-3">
                  <input
                    placeholder="City"
                    required
                    value={newAddress.city}
                    onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                    className="input-field"
                  />
                  <input
                    placeholder="State"
                    required
                    value={newAddress.state}
                    onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })}
                    className="input-field"
                  />
                  <input
                    placeholder="Pincode"
                    required
                    value={newAddress.pincode}
                    onChange={(e) => setNewAddress({ ...newAddress, pincode: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div className="flex gap-3">
                  <button type="submit" className="btn-primary">Save address</button>
                  {addresses.length > 0 && (
                    <button type="button" onClick={() => setShowNewAddress(false)} className="btn-secondary">
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            )}
          </section>

          <section>
            <h2 className="text-lg font-display font-semibold mb-4">2. Have a code?</h2>
            <p className="text-xs text-ink/40 mb-3">
              Optional — your best available discount is already applied automatically above.
            </p>
            <div className="flex gap-3">
              <input
                placeholder="Enter code"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                className="input-field flex-1"
              />
              <button onClick={handleApplyCoupon} className="btn-secondary">
                Apply
              </button>
            </div>
            {couponError && <p className="text-coral text-sm mt-2">{couponError}</p>}
            {couponResult && (
              <p className="text-emerald text-sm mt-2">
                "{couponResult.code}" applied — you saved ₹{couponResult.discount.toLocaleString('en-IN')}
              </p>
            )}
          </section>

          <section>
            <h2 className="text-lg font-display font-semibold mb-4">3. Payment method</h2>
            <div className="space-y-2">
              {['card', 'upi', 'netbanking'].map((method) => (
                <label
                  key={method}
                  className={`block border rounded-sm p-3 cursor-pointer capitalize text-sm transition-colors ${
                    paymentMethod === method ? 'border-emerald bg-emerald-light' : 'border-line'
                  }`}
                >
                  <input
                    type="radio"
                    name="payment"
                    className="mr-2"
                    checked={paymentMethod === method}
                    onChange={() => setPaymentMethod(method)}
                  />
                  {method === 'upi' ? 'UPI' : method}
                </label>
              ))}
            </div>
            <p className="text-xs text-ink/40 mt-2">
              This is a mock payment for demo purposes — no real charge will be made.
            </p>
          </section>
        </div>

        <div>
          <div className="border border-line rounded-sm p-6 sticky top-24">
            <h2 className="font-display font-semibold text-lg mb-4">Order summary</h2>

            <div className="space-y-2 mb-4 text-sm">
              {cart.items.map((item) => (
                <div key={item.productId} className="flex justify-between">
                  <span className="text-ink/60 line-clamp-1 pr-2">
                    {item.name} × {item.quantity}
                  </span>
                  <span className="font-mono shrink-0">₹{(item.price * item.quantity).toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-line pt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-ink/60">Subtotal</span>
                <span className="font-mono">₹{subtotal.toLocaleString('en-IN')}</span>
              </div>
              {effectiveDiscount > 0 && (
                <div className="flex justify-between text-emerald">
                  <span>Discount</span>
                  <span className="font-mono">−₹{effectiveDiscount.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-base pt-2 border-t border-line">
                <span>Total</span>
                <span className="font-mono">₹{total.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {error && (
              <p className="text-coral text-sm bg-coral/10 border border-coral/20 rounded-sm px-3 py-2 mt-4">
                {error}
              </p>
            )}

            <button
              onClick={handlePlaceOrder}
              disabled={!selectedAddressId || placing}
              className="btn-primary w-full mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {placing ? 'Placing order...' : `Place order — ₹${total.toLocaleString('en-IN')}`}
            </button>

            {!selectedAddressId && (
              <p className="text-xs text-ink/40 mt-2 text-center">Select or add a delivery address to continue.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}