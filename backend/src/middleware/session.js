const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');

// Ensures every request has a session row, and keeps last_active fresh.
// This is what the Doctor's business-metrics "active_sessions" query reads from.
// Monitoring and logging endpoints are not shopper activity. Polling them
// (AI-SRE, uptime checks, the bot's own log calls) must not create sessions,
// otherwise watching the active-sessions metric would inflate it.
const NOT_SHOPPING = [/^\/api\/metrics(\/|$)/, /^\/api\/bot-activity(\/|$)/, /^\/health$/];

async function trackSession(req, res, next) {
  if (NOT_SHOPPING.some((re) => re.test(req.path))) {
    req.sessionId = req.cookies?.session_id || null;
    return next();
  }
  try {
    let sessionId = req.cookies?.session_id;

    if (!sessionId) {
      sessionId = uuidv4();
      res.cookie('session_id', sessionId, {
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
        sameSite: 'lax',
      });
    }

    const userId = req.user?.id || null;
    const ip = req.ip;

    await pool.query(
      `INSERT INTO sessions (id, user_id, last_active, status, ip_address)
       VALUES ($1, $2, now(), 'active', $3)
       ON CONFLICT (id) DO UPDATE
         SET last_active = now(),
             user_id = COALESCE(EXCLUDED.user_id, sessions.user_id)`,
      [sessionId, userId, ip]
    );

    req.sessionId = sessionId;
    next();
  } catch (err) {
    // Session tracking should never block the request itself
    console.error('Session tracking failed', err);
    req.sessionId = req.sessionId || null;
    next();
  }
}

module.exports = { trackSession };