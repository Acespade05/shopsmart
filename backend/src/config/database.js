const { Pool, types } = require('pg');

// The schema uses TIMESTAMP (without time zone) columns filled by now() on a
// UTC database. By default the driver reads those as the Node process's local
// time, which shifts every date if the server isn't on UTC. Read them as UTC.
const TIMESTAMP_WITHOUT_TZ = 1114;
types.setTypeParser(TIMESTAMP_WITHOUT_TZ, (value) => (value === null ? null : new Date(`${value.replace(' ', 'T')}Z`)));

// NOTE for config-driven adapter layer: connection details come entirely
// from environment variables so this file never needs to change per client.
const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

pool.on('error', (err) => {
  console.error('Unexpected Postgres pool error', err);
});

module.exports = pool;
