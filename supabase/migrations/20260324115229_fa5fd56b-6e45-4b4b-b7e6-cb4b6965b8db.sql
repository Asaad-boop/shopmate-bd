-- Performance indexes for common queries

-- Orders table
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_web_status ON orders(web_order_status) WHERE web_order_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_channel ON orders(channel);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);

-- Order items
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- Customer QC cache
CREATE INDEX IF NOT EXISTS idx_qc_cache_phone ON customer_qc_cache(phone);

-- Shipments
CREATE INDEX IF NOT EXISTS idx_shipments_order_id ON shipments(order_id);

-- Journal lines
CREATE INDEX IF NOT EXISTS idx_journal_lines_journal ON journal_lines(journal_id);

-- Customers
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);