
-- ═══════════════════════════════════════════════════════════════
-- Phase 2: Courier & COD Reconciliation Tables
-- ═══════════════════════════════════════════════════════════════

-- 1) couriers
CREATE TABLE IF NOT EXISTS public.couriers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.couriers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access on couriers" ON public.couriers FOR ALL USING (true) WITH CHECK (true);

-- 2) courier_shipments
CREATE TABLE IF NOT EXISTS public.courier_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL UNIQUE,
  courier_id uuid NOT NULL REFERENCES public.couriers(id),
  tracking_id text,
  booking_status text NOT NULL DEFAULT 'created'
    CHECK (booking_status IN ('created','handed_over','accepted','in_transit','delivered','partial_delivered','returned','exchanged')),
  customer_total_amount numeric(12,2) NOT NULL DEFAULT 0,
  product_amount numeric(12,2) NOT NULL DEFAULT 0,
  customer_shipping_amount numeric(12,2) NOT NULL DEFAULT 0,
  in_transit_at timestamptz,
  delivered_at timestamptz,
  returned_at timestamptz,
  courier_delivery_fee numeric(12,2) NOT NULL DEFAULT 0,
  courier_cod_fee numeric(12,2) NOT NULL DEFAULT 0,
  courier_discount numeric(12,2) NOT NULL DEFAULT 0,
  courier_total_cost numeric(12,2) NOT NULL DEFAULT 0,
  courier_return_cost numeric(12,2) NOT NULL DEFAULT 0,
  courier_net_payable numeric(12,2) NOT NULL DEFAULT 0,
  delivered_amount numeric(12,2),
  returned_amount numeric(12,2),
  last_cost_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_courier_shipments_tracking ON public.courier_shipments(tracking_id);
CREATE INDEX idx_courier_shipments_courier ON public.courier_shipments(courier_id);
CREATE INDEX idx_courier_shipments_status ON public.courier_shipments(booking_status);
ALTER TABLE public.courier_shipments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access on courier_shipments" ON public.courier_shipments FOR ALL USING (true) WITH CHECK (true);

-- 3) courier_cost_events
CREATE TABLE IF NOT EXISTS public.courier_cost_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES public.courier_shipments(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('in_transit_cost_set','delivered_finalized','return_cost_set','manual_adjust')),
  delivery_fee numeric(12,2) DEFAULT 0,
  cod_fee numeric(12,2) DEFAULT 0,
  discount numeric(12,2) DEFAULT 0,
  total_cost numeric(12,2) DEFAULT 0,
  return_cost numeric(12,2) DEFAULT 0,
  source text DEFAULT 'manual' CHECK (source IN ('api','statement_import','manual')),
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.courier_cost_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access on courier_cost_events" ON public.courier_cost_events FOR ALL USING (true) WITH CHECK (true);

-- 4) courier_statements (header)
CREATE TABLE IF NOT EXISTS public.courier_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id uuid NOT NULL REFERENCES public.couriers(id),
  statement_date_from date NOT NULL,
  statement_date_to date NOT NULL,
  statement_ref text,
  currency text NOT NULL DEFAULT 'BDT',
  imported_at timestamptz NOT NULL DEFAULT now(),
  imported_by text,
  status text NOT NULL DEFAULT 'imported' CHECK (status IN ('imported','matched','partially_matched','closed'))
);
ALTER TABLE public.courier_statements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access on courier_statements" ON public.courier_statements FOR ALL USING (true) WITH CHECK (true);

-- 5) courier_statement_lines
CREATE TABLE IF NOT EXISTS public.courier_statement_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id uuid NOT NULL REFERENCES public.courier_statements(id) ON DELETE CASCADE,
  tracking_id text,
  order_id text,
  delivery_status text,
  customer_total_amount numeric(12,2),
  delivery_fee numeric(12,2),
  cod_fee numeric(12,2),
  discount numeric(12,2),
  total_cost numeric(12,2),
  net_payable numeric(12,2),
  return_cost numeric(12,2),
  payout_amount numeric(12,2),
  raw_json jsonb,
  match_status text NOT NULL DEFAULT 'unmatched' CHECK (match_status IN ('unmatched','matched','mismatch')),
  mismatch_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_csl_tracking ON public.courier_statement_lines(tracking_id);
CREATE INDEX idx_csl_statement ON public.courier_statement_lines(statement_id);
ALTER TABLE public.courier_statement_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access on courier_statement_lines" ON public.courier_statement_lines FOR ALL USING (true) WITH CHECK (true);

-- 6) courier_settlements_v2 (distinct from old cod_settlements)
CREATE TABLE IF NOT EXISTS public.courier_settlements_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id uuid NOT NULL REFERENCES public.couriers(id),
  settlement_date date NOT NULL,
  settlement_ref text,
  received_account text,
  amount_received numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  journal_id uuid REFERENCES public.journal_entries(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text
);
ALTER TABLE public.courier_settlements_v2 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access on courier_settlements_v2" ON public.courier_settlements_v2 FOR ALL USING (true) WITH CHECK (true);

-- 7) courier_settlement_allocations
CREATE TABLE IF NOT EXISTS public.courier_settlement_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id uuid NOT NULL REFERENCES public.courier_settlements_v2(id) ON DELETE CASCADE,
  shipment_id uuid NOT NULL REFERENCES public.courier_shipments(id),
  allocated_amount numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.courier_settlement_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access on courier_settlement_allocations" ON public.courier_settlement_allocations FOR ALL USING (true) WITH CHECK (true);

-- 8) reconciliation_exceptions
CREATE TABLE IF NOT EXISTS public.reconciliation_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('cost_missing','cost_mismatch','short_payment','unknown_tracking','status_mismatch')),
  courier_id uuid REFERENCES public.couriers(id),
  shipment_id uuid REFERENCES public.courier_shipments(id),
  statement_line_id uuid REFERENCES public.courier_statement_lines(id),
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high')),
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by text,
  resolve_note text
);
ALTER TABLE public.reconciliation_exceptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access on reconciliation_exceptions" ON public.reconciliation_exceptions FOR ALL USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════
-- Add new account mappings for courier module
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.account_mappings (mapping_key, description)
VALUES
  ('delivery_expense', 'Delivery Expense Account'),
  ('cod_fee_expense', 'COD Fee Expense Account'),
  ('return_delivery_expense', 'Return Delivery Expense Account')
ON CONFLICT (mapping_key) DO NOTHING;

-- Seed default couriers
INSERT INTO public.couriers (name) VALUES
  ('Pathao'), ('Steadfast'), ('RedX'), ('eCourier'), ('Paperfly'), ('Sundarban')
ON CONFLICT (name) DO NOTHING;
