const { createClient } = require('redis');

const client = createClient({
  url: process.env.REDIS_URL || 'redis://redis:6379',
});

client.on('error', (err) => console.error('Redis client error', err));

let connected = false;
async function getRedisClient() {
  if (!connected) {
    await client.connect();
    connected = true;
  }
  return client;
}

module.exports = { getRedisClient };
