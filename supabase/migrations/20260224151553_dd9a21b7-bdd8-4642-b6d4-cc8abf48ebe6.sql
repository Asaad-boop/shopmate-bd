
-- Drop old empty shipments table (different schema)
DROP TABLE IF EXISTS shipments CASCADE;

-- ============================================
-- PART A: ALTER EXISTING TABLES
-- ============================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_id text UNIQUE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_source text DEFAULT 'manual';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS return_condition text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS partial_confirmed boolean DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS partial_delivered_qty integer DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS partial_returned_qty integer DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_reason text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmed_by uuid;

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS unit_cost_at_delivery numeric DEFAULT 0;

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;

ALTER TABLE account_ledger ADD COLUMN IF NOT EXISTS reversed_by uuid;
ALTER TABLE account_ledger ADD COLUMN IF NOT EXISTS reversed_at timestamptz;

ALTER TABLE courier_rate_cards ADD COLUMN IF NOT EXISTS cod_minimum numeric DEFAULT 0;
ALTER TABLE courier_rate_cards ADD COLUMN IF NOT EXISTS cod_maximum numeric DEFAULT 999999;
ALTER TABLE courier_rate_cards ADD COLUMN IF NOT EXISTS return_charge numeric DEFAULT 0;
ALTER TABLE courier_rate_cards ADD COLUMN IF NOT EXISTS effective_from date DEFAULT CURRENT_DATE;
ALTER TABLE courier_rate_cards ADD COLUMN IF NOT EXISTS effective_to date;

ALTER TABLE cod_settlements ADD COLUMN IF NOT EXISTS period_start date;
ALTER TABLE cod_settlements ADD COLUMN IF NOT EXISTS period_end date;
ALTER TABLE cod_settlements ADD COLUMN IF NOT EXISTS total_expected numeric DEFAULT 0;

ALTER TABLE cod_settlement_lines ADD COLUMN IF NOT EXISTS note text;

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent text;

-- ============================================
-- PART B: CREATE NEW TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  currency text NOT NULL DEFAULT 'USD',
  rate_date date NOT NULL,
  rate numeric NOT NULL,
  source text DEFAULT 'manual',
  created_at timestamptz DEFAULT now(),
  UNIQUE(currency, rate_date)
);

CREATE TABLE IF NOT EXISTS inventory_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE RESTRICT,
  sku text,
  txn_date timestamptz DEFAULT now(),
  txn_type text NOT NULL,
  qty_in integer NOT NULL DEFAULT 0,
  qty_out integer NOT NULL DEFAULT 0,
  unit_cost numeric DEFAULT 0,
  running_avg_cost numeric DEFAULT 0,
  reference_type text,
  reference_id uuid,
  note text,
  requires_approval boolean DEFAULT false,
  approved_by uuid,
  approved_at timestamptz,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE RESTRICT,
  invoice_id text,
  courier_name text NOT NULL,
  courier_zone text DEFAULT 'dhaka',
  tracking_id text,
  shipped_date date,
  delivered_date date,
  product_price numeric NOT NULL DEFAULT 0,
  customer_shipping_fee numeric DEFAULT 0,
  total_customer_paid numeric NOT NULL DEFAULT 0,
  courier_delivery_charge numeric NOT NULL DEFAULT 0,
  cod_amount numeric NOT NULL DEFAULT 0,
  cod_fee numeric NOT NULL DEFAULT 0,
  net_receivable numeric GENERATED ALWAYS AS (cod_amount - courier_delivery_charge - cod_fee) STORED,
  courier_subsidy numeric GENERATED ALWAYS AS (GREATEST(courier_delivery_charge - customer_shipping_fee, 0)) STORED,
  return_type text DEFAULT NULL,
  customer_return_paid numeric DEFAULT 0,
  courier_return_charge numeric DEFAULT 0,
  return_net numeric GENERATED ALWAYS AS (
    CASE
      WHEN return_type = 'paid' THEN customer_return_paid - courier_return_charge
      WHEN return_type = 'unpaid' THEN 0 - courier_return_charge
      ELSE 0
    END
  ) STORED,
  is_partial boolean DEFAULT false,
  partial_delivered_qty integer DEFAULT 0,
  partial_returned_qty integer DEFAULT 0,
  partial_delivered_revenue numeric DEFAULT 0,
  partial_courier_charge_delivered numeric DEFAULT 0,
  partial_courier_charge_returned numeric DEFAULT 0,
  partial_cod_fee_delivered numeric DEFAULT 0,
  partial_confirmed_by uuid,
  partial_confirmed_at timestamptz,
  settlement_id uuid REFERENCES cod_settlements(id),
  is_settled boolean DEFAULT false,
  settled_amount numeric DEFAULT 0,
  settlement_difference numeric DEFAULT 0,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE cod_settlement_lines ADD COLUMN IF NOT EXISTS invoice_id text;
ALTER TABLE cod_settlement_lines ADD COLUMN IF NOT EXISTS shipment_id uuid REFERENCES shipments(id);

CREATE TABLE IF NOT EXISTS settlement_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id uuid REFERENCES cod_settlements(id),
  settlement_line_id uuid REFERENCES cod_settlement_lines(id),
  order_id uuid,
  invoice_id text,
  exception_type text NOT NULL,
  expected_amount numeric,
  received_amount numeric,
  difference numeric,
  dispute_status text DEFAULT 'open',
  resolution_note text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id),
  cost_type text NOT NULL,
  description text,
  amount numeric NOT NULL,
  currency text DEFAULT 'BDT',
  exchange_rate numeric DEFAULT 1,
  amount_bdt numeric NOT NULL,
  total_units integer,
  per_unit_cost numeric GENERATED ALWAYS AS (ROUND(amount_bdt / NULLIF(total_units, 0), 4)) STORED,
  period_start date,
  period_end date,
  note text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date date NOT NULL,
  category text NOT NULL,
  sub_category text,
  description text,
  amount_bdt numeric NOT NULL,
  currency text DEFAULT 'BDT',
  exchange_rate numeric DEFAULT 1,
  original_amount numeric,
  product_id uuid REFERENCES products(id),
  allocation_type text,
  total_units_allocated integer,
  per_unit_amount numeric,
  source text DEFAULT 'manual',
  ref_type text,
  ref_id uuid,
  is_fixed_cost boolean DEFAULT false,
  fixed_allocation_method text,
  note text,
  payment_account_id uuid REFERENCES accounts(id),
  is_reversed boolean DEFAULT false,
  reversed_by uuid,
  reversed_at timestamptz,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS daily_pnl_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pnl_date date NOT NULL,
  product_id uuid REFERENCES products(id),
  delivered_orders integer DEFAULT 0,
  returned_orders integer DEFAULT 0,
  partial_orders integer DEFAULT 0,
  cancelled_orders integer DEFAULT 0,
  gross_revenue numeric DEFAULT 0,
  courier_receivable numeric DEFAULT 0,
  courier_subsidy numeric DEFAULT 0,
  cogs numeric DEFAULT 0,
  courier_delivery_charge numeric DEFAULT 0,
  cod_fees numeric DEFAULT 0,
  return_loss_cogs numeric DEFAULT 0,
  meta_ads_cost numeric DEFAULT 0,
  influencer_cost numeric DEFAULT 0,
  video_cost numeric DEFAULT 0,
  packaging_cost numeric DEFAULT 0,
  salary_allocated numeric DEFAULT 0,
  rent_allocated numeric DEFAULT 0,
  other_expenses numeric DEFAULT 0,
  total_expenses numeric DEFAULT 0,
  gross_profit numeric DEFAULT 0,
  net_profit numeric DEFAULT 0,
  gross_margin_pct numeric DEFAULT 0,
  net_margin_pct numeric DEFAULT 0,
  calculated_at timestamptz DEFAULT now(),
  UNIQUE(pnl_date, product_id)
);
