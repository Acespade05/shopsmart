-- Store-wide or category sales, scheduled by the admin (Admin → Sales).
-- Product prices are never edited: while a sale is live the API works out the
-- sale price on the fly (src/services/pricing.js), and orders record what was
-- actually paid. Times are stored in UTC like every other timestamp here.
CREATE TABLE IF NOT EXISTS sales (
    id SERIAL PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    discount_percent INTEGER NOT NULL CHECK (discount_percent BETWEEN 5 AND 80),
    category_slugs TEXT[], -- NULL = whole store
    starts_at TIMESTAMP NOT NULL,
    ends_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_sales_window ON sales(starts_at, ends_at);

-- Which sale an order was placed in, and each item's price before the sale
ALTER TABLE orders ADD COLUMN IF NOT EXISTS sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS list_price DECIMAL(10,2);

-- A starting calendar of Indian sale events (dates in IST). The admin can
-- edit or delete these and add more.
INSERT INTO sales (name, discount_percent, category_slugs, starts_at, ends_at)
SELECT s.name, s.pct, s.cats,
       (s.start_ist::timestamptz AT TIME ZONE 'UTC'),
       (s.end_ist::timestamptz AT TIME ZONE 'UTC')
FROM (VALUES
    ('Festive Weekend Sale', 20, NULL::text[], '2026-10-17 00:00+05:30', '2026-10-19 00:00+05:30'),
    ('Diwali Dhamaka', 30, NULL::text[], '2026-11-03 00:00+05:30', '2026-11-09 00:00+05:30'),
    ('Black Friday Tech Sale', 25, ARRAY['electronics', 'accessories'], '2026-11-27 00:00+05:30', '2026-11-30 00:00+05:30'),
    ('Payday Sale', 15, NULL::text[], '2026-12-01 00:00+05:30', '2026-12-04 00:00+05:30'),
    ('Year-End Fashion Sale', 25, ARRAY['clothing', 'beauty', 'accessories'], '2026-12-25 00:00+05:30', '2027-01-01 00:00+05:30'),
    ('New Year Payday Sale', 15, NULL::text[], '2027-01-01 00:00+05:30', '2027-01-04 00:00+05:30'),
    ('Republic Day Sale', 30, NULL::text[], '2027-01-23 00:00+05:30', '2027-01-27 00:00+05:30'),
    ('Payday Sale', 15, NULL::text[], '2027-02-01 00:00+05:30', '2027-02-04 00:00+05:30')
) AS s(name, pct, cats, start_ist, end_ist)
WHERE NOT EXISTS (SELECT 1 FROM sales);
