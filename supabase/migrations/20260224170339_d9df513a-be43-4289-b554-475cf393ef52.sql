
-- ═══════════════════════════════════════════════════════════════
-- Phase 3: Expenses + Allocation Engine
-- ═══════════════════════════════════════════════════════════════

-- 1) expense_categories
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  default_gl_account_id uuid REFERENCES public.chart_of_accounts(id),
  is_allocatable boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access on expense_categories" ON public.expense_categories FOR ALL USING (true) WITH CHECK (true);

-- Seed categories
INSERT INTO public.expense_categories (name, is_allocatable) VALUES
  ('Meta Ads', true),
  ('Influencer', true),
  ('Packaging', true),
  ('External Marketing', true),
  ('Rent', true),
  ('Utility', true),
  ('Salary', true),
  ('Office Supplies', true),
  ('Return Handling', true),
  ('Miscellaneous', false)
ON CONFLICT (name) DO NOTHING;

-- 2) expenses_v2 (enterprise expense entries separate from legacy)
CREATE TABLE IF NOT EXISTS public.expenses_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  category_id uuid NOT NULL REFERENCES public.expense_categories(id),
  vendor_name text,
  description text,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  payment_method text NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash','bank','bkash','nagad','other')),
  paid_from_account_id uuid REFERENCES public.chart_of_accounts(id),
  reference_type text NOT NULL DEFAULT 'none' CHECK (reference_type IN ('none','order','campaign','import','payroll')),
  reference_id text,
  attachment_url text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','posted','void')),
  journal_id uuid REFERENCES public.journal_entries(id),
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_expenses_v2_date ON public.expenses_v2(expense_date);
CREATE INDEX idx_expenses_v2_category ON public.expenses_v2(category_id);
CREATE INDEX idx_expenses_v2_status ON public.expenses_v2(status);
ALTER TABLE public.expenses_v2 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access on expenses_v2" ON public.expenses_v2 FOR ALL USING (true) WITH CHECK (true);

-- 3) allocation_rules
CREATE TABLE IF NOT EXISTS public.allocation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category_id uuid NOT NULL REFERENCES public.expense_categories(id),
  allocation_method text NOT NULL CHECK (allocation_method IN ('per_order','per_delivered_qty','revenue_share','cogs_share','sku_fixed_rate','manual_split')),
  scope text NOT NULL DEFAULT 'date_range' CHECK (scope IN ('date_range','campaign','order','global')),
  default_target text NOT NULL DEFAULT 'sku' CHECK (default_target IN ('sku','order')),
  config_json jsonb DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.allocation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access on allocation_rules" ON public.allocation_rules FOR ALL USING (true) WITH CHECK (true);

-- 4) expense_allocations (run header)
CREATE TABLE IF NOT EXISTS public.expense_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_name text NOT NULL,
  category_id uuid REFERENCES public.expense_categories(id),
  date_from date NOT NULL,
  date_to date NOT NULL,
  allocation_method text NOT NULL,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','posted','reversed')),
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.expense_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access on expense_allocations" ON public.expense_allocations FOR ALL USING (true) WITH CHECK (true);

-- 5) expense_allocation_lines
CREATE TABLE IF NOT EXISTS public.expense_allocation_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id uuid NOT NULL REFERENCES public.expense_allocations(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('sku','order')),
  target_id text NOT NULL,
  allocated_amount numeric(12,2) NOT NULL DEFAULT 0,
  weight_value numeric(12,4),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_eal_allocation ON public.expense_allocation_lines(allocation_id);
CREATE INDEX idx_eal_target ON public.expense_allocation_lines(target_type, target_id);
ALTER TABLE public.expense_allocation_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access on expense_allocation_lines" ON public.expense_allocation_lines FOR ALL USING (true) WITH CHECK (true);

-- 6) product_cost_buckets (caching layer for profitability)
CREATE TABLE IF NOT EXISTS public.product_cost_buckets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL,
  period_key text NOT NULL,
  ads_cost numeric(12,2) NOT NULL DEFAULT 0,
  influencer_cost numeric(12,2) NOT NULL DEFAULT 0,
  packaging_cost numeric(12,2) NOT NULL DEFAULT 0,
  external_marketing_cost numeric(12,2) NOT NULL DEFAULT 0,
  overhead_cost numeric(12,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(sku, period_key)
);
CREATE INDEX idx_pcb_sku ON public.product_cost_buckets(sku);
ALTER TABLE public.product_cost_buckets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access on product_cost_buckets" ON public.product_cost_buckets FOR ALL USING (true) WITH CHECK (true);
