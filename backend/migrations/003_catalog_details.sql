-- Richer product details for a realistic storefront.
-- Additive only: every new column is nullable or has a default, so existing
-- routes, queries, orders and the traffic bot are unaffected.

ALTER TABLE products ADD COLUMN IF NOT EXISTS brand          VARCHAR(100);
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku            VARCHAR(60);
ALTER TABLE products ADD COLUMN IF NOT EXISTS subcategory    VARCHAR(100);
ALTER TABLE products ADD COLUMN IF NOT EXISTS tags           TEXT[]  NOT NULL DEFAULT '{}';
ALTER TABLE products ADD COLUMN IF NOT EXISTS specs          JSONB   NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sizes          TEXT[]  NOT NULL DEFAULT '{}';
ALTER TABLE products ADD COLUMN IF NOT EXISTS warranty       VARCHAR(150);
ALTER TABLE products ADD COLUMN IF NOT EXISTS return_policy  VARCHAR(150);
ALTER TABLE products ADD COLUMN IF NOT EXISTS shipping_info  VARCHAR(150);

CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
CREATE INDEX IF NOT EXISTS idx_products_subcategory ON products(subcategory);
