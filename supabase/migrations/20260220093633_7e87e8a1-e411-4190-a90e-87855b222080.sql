
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS product_name_fallback VARCHAR(255);

-- Fix existing orphan order_items by matching sku
UPDATE order_items oi
SET product_id = p.id
FROM products p
WHERE p.sku = (SELECT sku FROM products WHERE id = oi.product_id LIMIT 1)
AND oi.product_id IS NULL;
