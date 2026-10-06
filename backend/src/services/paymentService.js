// Mock payment gateway — no real gateway account needed. Behaves like an
// Indian gateway: UPI is the fastest and most reliable, net banking the
// slowest and the most failure-prone, and a small share of calls hit a slow
// bank (multi-second responses). Overall about 5% of payments are declined.

// Decline rate and reasons per method
const METHODS = {
  upi: {
    declineRate: 0.04,
    latencyMs: [250, 900],
    reasons: [
      ['upi_pin_incorrect', 'Incorrect UPI PIN entered.'],
      ['upi_request_expired', 'The UPI collect request expired before it was approved.'],
      ['bank_unavailable', 'The remitter bank is not available right now.'],
    ],
  },
  card: {
    declineRate: 0.06,
    latencyMs: [400, 1300],
    reasons: [
      ['card_declined', 'The card was declined by the issuing bank.'],
      ['insufficient_funds', 'The card has insufficient funds.'],
      ['authentication_failed', 'OTP / 3-D Secure authentication failed.'],
    ],
  },
  netbanking: {
    declineRate: 0.08,
    latencyMs: [700, 2200],
    reasons: [
      ['bank_timeout', 'The bank did not respond in time.'],
      ['user_cancelled', 'The payment was cancelled on the bank page.'],
    ],
  },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const between = ([min, max]) => min + Math.random() * (max - min);

async function processPayment({ amount, method }) {
  const m = METHODS[method] || METHODS.card;

  // Network + bank latency; ~2% of calls are slow (2–5 s), as with real banks
  const slow = Math.random() < 0.02;
  await sleep(slow ? between([2000, 5000]) : between(m.latencyMs));

  if (Math.random() < m.declineRate) {
    const [error, message] = m.reasons[Math.floor(Math.random() * m.reasons.length)];
    return { success: false, error, message };
  }

  return {
    success: true,
    transactionId: 'mock_txn_' + Math.random().toString(36).slice(2, 12),
    amount,
    method,
    processedAt: new Date().toISOString(),
  };
}

module.exports = { processPayment };
