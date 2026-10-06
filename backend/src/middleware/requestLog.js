// One JSON line per request on stdout (read with `docker compose logs app`),
// like a production Node service. Includes the full URL (so odd query strings
// show up), status, time taken, client IP and signed-in user.
const SKIP = /^\/health$/;

function requestLog(req, res, next) {
  if (SKIP.test(req.path)) return next();
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    const line = {
      time: new Date().toISOString(),
      level: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
      method: req.method,
      url: req.originalUrl.slice(0, 500),
      status: res.statusCode,
      ms: Math.round(ms * 10) / 10,
      ip: req.ip,
      user: req.user?.id ?? null,
    };
    process.stdout.write(`${JSON.stringify(line)}\n`);
  });
  next();
}

module.exports = { requestLog };
