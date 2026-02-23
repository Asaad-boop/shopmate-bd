
-- ============================================
-- PHASE 2: NEW ACCOUNTING-GRADE TABLES
-- ============================================

-- 2A: ACCOUNT LEDGER — Only way to change money
CREATE TABLE public.account_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_date date NOT NULL DEFAULT CURRENT_DATE,
  account_id uuid REFERENCES public.accounts(id) NOT NULL,
  direction varchar NOT NULL CHECK (direction IN ('in', 'out')),
  amount numeric NOT NULL CHECK (amount > 0),
  ref_type varchar NOT NULL,
  ref_id uuid DEFAULT NULL,
  note text DEFAULT NULL,
  created_by uuid DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  is_reversal boolean DEFAULT false,
  reversed_entry_id uuid REFERENCES public.account_ledger(id) DEFAULT NULL
);

-- 2B: ORDER COSTS — Per-order cost breakdown
CREATE TABLE public.order_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) NOT NULL UNIQUE,
  courier_expected_charge numeric DEFAULT 0,
  courier_actual_charge numeric DEFAULT NULL,
  packaging_cost numeric DEFAULT 0,
  payment_gateway_fee numeric DEFAULT 0,
  cod_fee numeric DEFAULT 0,
  return_handling_cost numeric DEFAULT 0,
  delivery_subsidy numeric GENERATED ALWAYS AS (
    COALESCE(courier_actual_charge, courier_expected_charge) - 0
  ) STORED,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2C: SHIPMENTS — Proper courier shipment tracking
CREATE TABLE public.shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) NOT NULL,
  courier_id uuid DEFAULT NULL,
  courier_name varchar DEFAULT NULL,
  consignment_id varchar DEFAULT NULL,
  tracking_code varchar DEFAULT NULL,
  shipped_at timestamptz DEFAULT NULL,
  delivered_at timestamptz DEFAULT NULL,
  courier_status varchar DEFAULT 'pending',
  last_tracking_at timestamptz DEFAULT NULL,
  expected_charge numeric DEFAULT 0,
  actual_charge numeric DEFAULT NULL,
  cod_expected_amount numeric DEFAULT NULL,
  service_area varchar DEFAULT NULL,
  weight_kg numeric DEFAULT NULL,
  created_by uuid DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2D: COD SETTLEMENTS — Courier payout statements
CREATE TABLE public.cod_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_name varchar NOT NULL,
  settlement_date date NOT NULL,
  settlement_ref varchar DEFAULT NULL,
  total_paid_amount numeric NOT NULL DEFAULT 0,
  total_orders integer DEFAULT 0,
  matched_count integer DEFAULT 0,
  unmatched_count integer DEFAULT 0,
  mismatch_count integer DEFAULT 0,
  statement_file_url text DEFAULT NULL,
  status varchar DEFAULT 'pending',
  created_by uuid DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2E: COD SETTLEMENT LINES — Individual line items
CREATE TABLE public.cod_settlement_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id uuid REFERENCES public.cod_settlements(id) NOT NULL,
  order_id uuid REFERENCES public.orders(id) DEFAULT NULL,
  consignment_id varchar DEFAULT NULL,
  paid_amount numeric NOT NULL DEFAULT 0,
  expected_amount numeric DEFAULT NULL,
  matched_status varchar DEFAULT 'unmatched' CHECK (matched_status IN ('matched', 'unmatched', 'mismatch')),
  mismatch_reason varchar DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2F: AUDIT LOGS — General audit trail for all entities
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type varchar NOT NULL,
  entity_id uuid NOT NULL,
  action varchar NOT NULL,
  before_json jsonb DEFAULT NULL,
  after_json jsonb DEFAULT NULL,
  user_id uuid DEFAULT NULL,
  user_name varchar DEFAULT NULL,
  ip_address varchar DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2G: COURIER RATE CARDS
CREATE TABLE public.courier_rate_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_name varchar NOT NULL,
  service_area varchar NOT NULL,
  weight_slab_min numeric DEFAULT 0,
  weight_slab_max numeric DEFAULT 5,
  base_charge numeric NOT NULL DEFAULT 0,
  cod_fee_percent numeric DEFAULT 1,
  extra_charge numeric DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- PHASE 3: RLS POLICIES (permissive for now, no auth yet)
-- ============================================
ALTER TABLE public.account_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to account_ledger" ON public.account_ledger FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.order_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to order_costs" ON public.order_costs FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to shipments" ON public.shipments FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.cod_settlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to cod_settlements" ON public.cod_settlements FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.cod_settlement_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to cod_settlement_lines" ON public.cod_settlement_lines FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to audit_logs" ON public.audit_logs FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.courier_rate_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to courier_rate_cards" ON public.courier_rate_cards FOR ALL USING (true) WITH CHECK (true);
