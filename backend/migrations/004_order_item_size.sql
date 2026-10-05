-- Size chosen for clothing/footwear (e.g. 'M', 'UK 8'). NULL for products without sizes.
-- Additive: existing order items and queries are unaffected.
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS size VARCHAR(20);
