
-- Add settlement tracking columns to orders (if not exist)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS settlement_batch_id uuid,
  ADD COLUMN IF NOT EXISTS settlement_posted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS legacy_invoice_no text;

-- Create index for legacy order queries
CREATE INDEX IF NOT EXISTS idx_orders_legacy ON public.orders (order_source) WHERE order_source = 'LEGACY';
CREATE INDEX IF NOT EXISTS idx_orders_legacy_invoice ON public.orders (legacy_invoice_no) WHERE legacy_invoice_no IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_settlement ON public.orders (settlement_posted) WHERE order_source = 'LEGACY';
