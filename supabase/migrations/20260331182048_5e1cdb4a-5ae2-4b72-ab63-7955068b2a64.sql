
ALTER TABLE orders ADD COLUMN IF NOT EXISTS web_order_id uuid;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_booked_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS return_reason text;

CREATE INDEX IF NOT EXISTS idx_orders_web_order_id ON orders(web_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_source ON orders(order_source);
