// Indian-format rupee amounts: whole numbers stay whole (₹1,299), others get two decimals (₹31.80).
export function fmtINR(value) {
  const n = Number(value) || 0;
  const decimals = Number.isInteger(Math.round(n * 100) / 100) ? 0 : 2;
  return n.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: 2 });
}
