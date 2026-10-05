// Coupon chosen on the cart page, carried to checkout for this browser tab.
const KEY = 'shopsmart_coupon';

export function savedCoupon() {
  try {
    return sessionStorage.getItem(KEY) || '';
  } catch {
    return '';
  }
}
export function saveCoupon(code) {
  try {
    if (code) sessionStorage.setItem(KEY, code);
    else sessionStorage.removeItem(KEY);
  } catch {
    // storage blocked — the shopper can still type the code at checkout
  }
}
