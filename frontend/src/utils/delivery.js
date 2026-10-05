// Delivery estimate from an Indian PIN code.
//
// The store ships from Mumbai (PIN 400xxx). The first digit of a PIN code is
// its postal region, so we estimate days by distance from Maharashtra.
// This is an estimate shown to shoppers, not a carrier quote.

const DAYS_BY_REGION = {
  1: [4, 5], // Delhi, Haryana, Punjab, HP, J&K
  2: [4, 5], // Uttar Pradesh, Uttarakhand
  3: [3, 4], // Rajasthan, Gujarat
  4: [2, 3], // Maharashtra, Goa, MP, Chhattisgarh
  5: [3, 4], // Telangana, Andhra Pradesh, Karnataka
  6: [4, 5], // Tamil Nadu, Kerala
  7: [5, 7], // West Bengal, Odisha, North-East
  8: [5, 6], // Bihar, Jharkhand
};

export function isValidPincode(pin) {
  return /^[1-8][0-9]{5}$/.test(pin);
}

// Returns { min, max, by: Date } or null for an invalid PIN.
export function estimateDelivery(pin, from = new Date()) {
  if (!isValidPincode(pin)) return null;
  let [min, max] = DAYS_BY_REGION[pin[0]];
  if (pin.startsWith('400') || pin.startsWith('401')) [min, max] = [1, 2]; // Mumbai & nearby
  const by = new Date(from);
  by.setDate(by.getDate() + max);
  return { min, max, by };
}

export function formatDeliveryDate(date) {
  return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

// Remember the shopper's PIN between visits (best effort; storage can be blocked).
const KEY = 'shopsmart_pincode';
export function savedPincode() {
  try {
    return localStorage.getItem(KEY) || '';
  } catch {
    return '';
  }
}
export function savePincode(pin) {
  try {
    localStorage.setItem(KEY, pin);
  } catch {
    // ignore
  }
}
