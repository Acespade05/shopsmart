-- One-time stock top-up. The first catalog seed gave products a minimum of 8
-- units, which sits under the admin "low stock" line (<10) and flagged ~25
-- products as low from day one. Products still at exactly that seeded 8 are
-- raised to the new catalog minimum of 25. Products whose stock has changed
-- (sales or manual edits) are left alone.
UPDATE products
SET stock = 25, updated_at = now()
WHERE is_active = true AND stock = 8 AND sku IS NOT NULL;
