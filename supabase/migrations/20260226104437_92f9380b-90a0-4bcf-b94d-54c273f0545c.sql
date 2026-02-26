
-- Return cases table
CREATE TABLE public.return_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_order_id uuid NOT NULL REFERENCES public.orders(id),
  exchange_case_id uuid REFERENCES public.exchange_requests(id),
  status text NOT NULL DEFAULT 'pending_return' CHECK (status IN ('pending_return', 'received', 'cancelled')),
  expected_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  received_items jsonb DEFAULT '[]'::jsonb,
  return_type text,
  condition text,
  warehouse_location text,
  received_at timestamptz,
  received_by uuid,
  notes text,
  evidence_urls text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.return_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.return_cases FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Add return_pending flag and return_case_id to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS return_pending boolean NOT NULL DEFAULT false;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS return_case_id uuid REFERENCES public.return_cases(id);

-- Index for fast lookups
CREATE INDEX idx_return_cases_order ON public.return_cases(parent_order_id);
CREATE INDEX idx_return_cases_status ON public.return_cases(status);
CREATE INDEX idx_orders_return_pending ON public.orders(return_pending) WHERE return_pending = true;
