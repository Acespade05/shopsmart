// Mock Stripe payment — no real Stripe account needed. Simulates realistic
// success/failure behavior for the AI Doctor's failure scenarios later.

async function processPayment({ amount, method }) {
  // Simulate network latency
  await new Promise((resolve) => setTimeout(resolve, 150 + Math.random() * 150));

  // ~95% success rate, mirrors realistic payment gateway behavior
  const success = Math.random() < 0.95;

  if (!success) {
    return {
      success: false,
      error: 'card_declined',
      message: 'The card was declined by the issuing bank.',
    };
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