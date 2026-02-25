
-- Add preorder_flag to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS preorder_flag boolean NOT NULL DEFAULT false;

-- Index for fast preorder queries
CREATE INDEX IF NOT EXISTS idx_orders_preorder_flag ON public.orders (preorder_flag) WHERE preorder_flag = true AND status = 'pending';

-- Preorder batches
CREATE TABLE IF NOT EXISTS public.preorder_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  scheduled_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

-- Preorder batch items (junction)
CREATE TABLE IF NOT EXISTS public.preorder_batch_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.preorder_batches(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_preorder_batch_items_batch ON public.preorder_batch_items (batch_id);
CREATE INDEX IF NOT EXISTS idx_preorder_batch_items_order ON public.preorder_batch_items (order_id);

-- Permissive RLS for now (matches project pattern)
ALTER TABLE public.preorder_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preorder_batch_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to preorder_batches" ON public.preorder_batches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to preorder_batch_items" ON public.preorder_batch_items FOR ALL USING (true) WITH CHECK (true);
