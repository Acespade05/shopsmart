const { getRedisClient } = require('../config/redis');

const CART_TTL_SECONDS = 60 * 60 * 24 * 7; // cart persists 7 days

function cartKey(cartOwnerId) {
  return `cart:${cartOwnerId}`;
}

// cartOwnerId = userId if logged in, else sessionId — keeps cart consistent
// across login/logout for the same browser session.
async function getCart(cartOwnerId) {
  const client = await getRedisClient();
  const raw = await client.get(cartKey(cartOwnerId));
  return raw ? JSON.parse(raw) : { items: [] };
}

async function saveCart(cartOwnerId, cart) {
  const client = await getRedisClient();
  await client.set(cartKey(cartOwnerId), JSON.stringify(cart), { EX: CART_TTL_SECONDS });
}

async function clearCart(cartOwnerId) {
  const client = await getRedisClient();
  await client.del(cartKey(cartOwnerId));
}

module.exports = { getCart, saveCart, clearCart };