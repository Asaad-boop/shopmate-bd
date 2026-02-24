
-- Legacy import columns on orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS legacy_order_id text,
  ADD COLUMN IF NOT EXISTS legacy_import_batch_id uuid,
  ADD COLUMN IF NOT EXISTS posting_mode text DEFAULT 'ENABLED',
  ADD COLUMN IF NOT EXISTS inventory_mode text DEFAULT 'ENABLED',
  ADD COLUMN IF NOT EXISTS courier_mode text DEFAULT 'ENABLED',
  ADD COLUMN IF NOT EXISTS legacy_finalized boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS legacy_finalized_at timestamptz,
  ADD COLUMN IF NOT EXISTS legacy_courier_name text,
  ADD COLUMN IF NOT EXISTS legacy_tracking_id text,
  ADD COLUMN IF NOT EXISTS legacy_courier_status text,
  ADD COLUMN IF NOT EXISTS legacy_delivered_date date,
  ADD COLUMN IF NOT EXISTS legacy_returned_date date;

-- Legacy import batches table
CREATE TABLE IF NOT EXISTS public.legacy_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  total_rows integer DEFAULT 0,
  imported_count integer DEFAULT 0,
  failed_count integer DEFAULT 0,
  duplicate_count integer DEFAULT 0,
  status text DEFAULT 'completed',
  errors jsonb DEFAULT '[]'::jsonb,
  created_by text,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_orders_legacy_batch ON public.orders (legacy_import_batch_id) WHERE legacy_import_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_order_source ON public.orders (order_source) WHERE order_source = 'LEGACY';
