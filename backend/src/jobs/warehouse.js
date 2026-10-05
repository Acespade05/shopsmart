// Simulated warehouse for SYNTHETIC orders only (customers with an
// @shopsmart-synthetic.internal email). Real customers' orders are never
// touched — those stay manual in the admin panel.
//
// Every few minutes it:
//   1. ships synthetic orders 6–24 h after they were placed,
//   2. delivers them 1–3 days after shipping,
//   3. marks checkouts idle for 30+ min as abandoned (any session),
//   4. restocks products that SALES ran down to under 5 units.
//      Products an admin set low by hand (e.g. to simulate a stock-out
//      incident) are left alone: their last inventory change is an
//      'adjustment', not a 'sale'.
//
// Turned on with SIMULATE_WAREHOUSE=true (production docker-compose.yml).
const pool = require('../config/database');

const SYNTHETIC = `u.email LIKE '%@shopsmart-synthetic.internal'`;
const RESTOCK_BELOW = 5;
const RESTOCK_TO = 40;

async function tick() {
  // 1. Ship: each order gets its own delay (6–23 h) derived from its id.
  const shipped = await pool.query(
    `UPDATE orders o SET status = 'shipped'
     FROM users u
     WHERE u.id = o.user_id AND ${SYNTHETIC}
       AND o.status = 'confirmed'
       AND o.created_at < now() - make_interval(hours => 6 + (o.id % 18))
     RETURNING o.id`
  );
  // Record shipping before the delivery check, so an order can't ship and
  // deliver in the same run.
  for (const r of shipped.rows) {
    await pool.query(`INSERT INTO order_status_history (order_id, status) VALUES ($1, 'shipped')`, [r.id]);
  }

  // 2. Deliver: 24–71 h after it shipped.
  const delivered = await pool.query(
    `UPDATE orders o SET status = 'delivered'
     FROM users u
     WHERE u.id = o.user_id AND ${SYNTHETIC}
       AND o.status = 'shipped'
       AND COALESCE(
             (SELECT MAX(h.changed_at) FROM order_status_history h WHERE h.order_id = o.id AND h.status = 'shipped'),
             o.created_at
           ) < now() - make_interval(hours => 24 + (o.id % 48))
     RETURNING o.id`
  );

  for (const r of delivered.rows) {
    await pool.query(`INSERT INTO order_status_history (order_id, status) VALUES ($1, 'delivered')`, [r.id]);
  }

  // 3. Abandoned checkouts.
  const abandoned = await pool.query(
    `UPDATE carts SET status = 'abandoned', updated_at = now()
     WHERE status = 'checkout' AND updated_at < now() - INTERVAL '30 minutes'`
  );

  // 4. Restock products sold down to < RESTOCK_BELOW (not ones an admin set low).
  const restocked = await pool.query(
    `WITH last_change AS (
       SELECT DISTINCT ON (product_id) product_id, reason
       FROM inventory_log ORDER BY product_id, created_at DESC, id DESC
     )
     UPDATE products p SET stock = $2, updated_at = now()
     FROM last_change l
     WHERE l.product_id = p.id AND l.reason = 'sale'
       AND p.is_active = true AND p.stock < $1
     RETURNING p.id, $2 - p.stock AS added`,
    [RESTOCK_BELOW, RESTOCK_TO]
  );
  for (const r of restocked.rows) {
    await pool.query(`INSERT INTO inventory_log (product_id, change, reason) VALUES ($1, $2, 'restock')`, [r.id, r.added]);
  }

  const n = shipped.rowCount + delivered.rowCount + abandoned.rowCount + restocked.rowCount;
  if (n > 0) {
    console.log(
      `[warehouse] shipped ${shipped.rowCount}, delivered ${delivered.rowCount}, ` +
        `abandoned checkouts ${abandoned.rowCount}, restocked ${restocked.rowCount}`
    );
  }
}

function startWarehouse() {
  const every = parseInt(process.env.WAREHOUSE_INTERVAL_MS, 10) || 5 * 60 * 1000;
  console.log(`[warehouse] simulated warehouse on (every ${Math.round(every / 1000)} s, synthetic orders only)`);
  const run = () => tick().catch((err) => console.error('[warehouse] tick failed:', err.message));
  setTimeout(run, 10 * 1000);
  setInterval(run, every);
}

module.exports = { startWarehouse, tick };
