// Set (or reset) the admin account's password.
//
//   docker compose exec app npm run admin:password
//       → generates a strong random password, saves it, prints it ONCE
//
//   docker compose exec -e ADMIN_PASSWORD='your-own-long-password' app npm run admin:password
//       → uses the password you give (min 12 characters)
//
// The admin email is ADMIN_EMAIL (default admin@shopsmart.com). If that user
// doesn't exist yet it is created; if it exists, only its password changes.
// Signed-in admin sessions keep working until their token expires.
require('dotenv').config();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pool = require('../src/config/database');

async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin@shopsmart.com';
  const given = process.env.ADMIN_PASSWORD;
  if (given && given.length < 12) {
    throw new Error('ADMIN_PASSWORD must be at least 12 characters');
  }
  // 18 random bytes → 24 URL-safe characters
  const password = given || crypto.randomBytes(18).toString('base64url');
  const hash = await bcrypt.hash(password, 10);

  const res = await pool.query(
    `INSERT INTO users (name, email, password, role)
     VALUES ('Admin', $1, $2, 'admin')
     ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password, role = 'admin', updated_at = now()
     RETURNING id`,
    [email, hash]
  );

  console.log(`Admin password updated for ${email} (user id ${res.rows[0].id}).`);
  if (!given) {
    console.log('');
    console.log(`  New password: ${password}`);
    console.log('');
    console.log('Save it in a password manager now — it is not stored anywhere in plain text.');
  }
}

main()
  .catch((err) => {
    console.error('Failed to set admin password:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
