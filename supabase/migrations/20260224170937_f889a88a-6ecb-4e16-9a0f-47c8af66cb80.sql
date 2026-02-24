
-- =============================================
-- Phase 4: Purchase & Supplier Management
-- =============================================

-- 1) Add currency and is_active to suppliers if not present
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'BDT',
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 2) Sequences for auto-numbering
CREATE SEQUENCE IF NOT EXISTS grn_seq START 1;
CREATE SEQUENCE IF NOT EXISTS supplier_payment_seq START 1;

-- 3) goods_receipts (GRN header)
CREATE TABLE IF NOT EXISTS public.goods_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_number text UNIQUE NOT NULL,
  supplier_id uuid REFERENCES public.suppliers(id),
  po_id uuid REFERENCES public.purchase_orders(id),
  receipt_date date NOT NULL DEFAULT CURRENT_DATE,
  receipt_type text NOT NULL DEFAULT 'LOCAL',
  import_shipment_id text,
  status text NOT NULL DEFAULT 'draft',
  notes text,
  total_product_cost numeric(12,2) DEFAULT 0,
  journal_id uuid REFERENCES public.journal_entries(id),
  created_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4) goods_receipt_items
CREATE TABLE IF NOT EXISTS public.goods_receipt_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_id uuid NOT NULL REFERENCES public.goods_receipts(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id),
  sku text,
  product_name text,
  qty_received numeric(12,2) NOT NULL DEFAULT 0,
  unit_cost numeric(12,2) NOT NULL DEFAULT 0,
  line_total numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 5) supplier_payments
CREATE TABLE IF NOT EXISTS public.supplier_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_number text UNIQUE NOT NULL,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id),
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text NOT NULL DEFAULT 'BANK',
  paid_from_account_id uuid REFERENCES public.chart_of_accounts(id),
  amount numeric(12,2) NOT NULL DEFAULT 0,
  reference text,
  notes text,
  status text NOT NULL DEFAULT 'draft',
  journal_id uuid REFERENCES public.journal_entries(id),
  created_by text,
  created_at timestamptz DEFAULT now()
);

-- 6) supplier_payment_allocations
CREATE TABLE IF NOT EXISTS public.supplier_payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.supplier_payments(id) ON DELETE CASCADE,
  payable_type text NOT NULL DEFAULT 'GRN',
  payable_id uuid NOT NULL,
  allocated_amount numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 7) landed_costs
CREATE TABLE IF NOT EXISTS public.landed_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_shipment_id text,
  po_id uuid REFERENCES public.purchase_orders(id),
  cost_date date NOT NULL DEFAULT CURRENT_DATE,
  cost_type text NOT NULL DEFAULT 'FREIGHT',
  amount numeric(12,2) NOT NULL DEFAULT 0,
  paid_from_account_id uuid REFERENCES public.chart_of_accounts(id),
  status text NOT NULL DEFAULT 'draft',
  notes text,
  journal_id uuid REFERENCES public.journal_entries(id),
  created_by text,
  created_at timestamptz DEFAULT now()
);

-- 8) landed_cost_allocations (header)
CREATE TABLE IF NOT EXISTS public.landed_cost_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_shipment_id text,
  grn_id uuid REFERENCES public.goods_receipts(id),
  po_id uuid REFERENCES public.purchase_orders(id),
  allocation_method text NOT NULL DEFAULT 'BY_VALUE',
  status text NOT NULL DEFAULT 'draft',
  total_landed_cost numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  posted_at timestamptz,
  posted_by text
);

-- 9) landed_cost_allocation_lines
CREATE TABLE IF NOT EXISTS public.landed_cost_allocation_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id uuid NOT NULL REFERENCES public.landed_cost_allocations(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id),
  sku text,
  qty_received numeric(12,2) DEFAULT 0,
  base_value numeric(12,2) DEFAULT 0,
  allocated_cost numeric(12,2) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 10) GRN posting function
CREATE OR REPLACE FUNCTION public.post_grn(
  p_grn_id uuid,
  p_amount numeric,
  p_entry_date date DEFAULT CURRENT_DATE
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  je_id uuid;
  acct_inventory uuid;
  acct_supplier_payable uuid;
BEGIN
  SELECT account_id INTO acct_inventory FROM public.account_mappings WHERE mapping_key = 'inventory';
  SELECT account_id INTO acct_supplier_payable FROM public.account_mappings WHERE mapping_key = 'supplier_payable';

  IF acct_inventory IS NULL OR acct_supplier_payable IS NULL THEN
    RAISE EXCEPTION 'Account mappings for inventory or supplier_payable not configured';
  END IF;

  INSERT INTO public.journal_entries (entry_date, description, reference_type, reference_id, status, is_auto)
  VALUES (p_entry_date, 'GRN Posted: ' || p_grn_id::text, 'purchase', p_grn_id, 'posted', true)
  RETURNING id INTO je_id;

  INSERT INTO public.journal_lines (journal_id, account_id, debit, credit, description) VALUES
    (je_id, acct_inventory, p_amount, 0, 'Inventory received (GRN)'),
    (je_id, acct_supplier_payable, 0, p_amount, 'Supplier payable created');

  UPDATE public.goods_receipts SET status = 'posted', journal_id = je_id, updated_at = now() WHERE id = p_grn_id;

  RETURN je_id;
END;
$$;

-- 11) Supplier payment posting function
CREATE OR REPLACE FUNCTION public.post_supplier_payment(
  p_payment_id uuid,
  p_amount numeric,
  p_pay_account_id uuid,
  p_entry_date date DEFAULT CURRENT_DATE
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  je_id uuid;
  acct_supplier_payable uuid;
BEGIN
  SELECT account_id INTO acct_supplier_payable FROM public.account_mappings WHERE mapping_key = 'supplier_payable';

  IF acct_supplier_payable IS NULL OR p_pay_account_id IS NULL THEN
    RAISE EXCEPTION 'Account mappings not configured';
  END IF;

  INSERT INTO public.journal_entries (entry_date, description, reference_type, reference_id, status, is_auto)
  VALUES (p_entry_date, 'Supplier Payment: ' || p_payment_id::text, 'purchase', p_payment_id, 'posted', true)
  RETURNING id INTO je_id;

  INSERT INTO public.journal_lines (journal_id, account_id, debit, credit, description) VALUES
    (je_id, acct_supplier_payable, p_amount, 0, 'Supplier payable reduced'),
    (je_id, p_pay_account_id, 0, p_amount, 'Cash/Bank payment to supplier');

  UPDATE public.supplier_payments SET status = 'posted', journal_id = je_id WHERE id = p_payment_id;

  RETURN je_id;
END;
$$;

-- 12) Landed cost posting function
CREATE OR REPLACE FUNCTION public.post_landed_cost(
  p_landed_cost_id uuid,
  p_amount numeric,
  p_pay_account_id uuid,
  p_entry_date date DEFAULT CURRENT_DATE
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  je_id uuid;
  acct_inventory uuid;
BEGIN
  SELECT account_id INTO acct_inventory FROM public.account_mappings WHERE mapping_key = 'inventory';

  IF acct_inventory IS NULL OR p_pay_account_id IS NULL THEN
    RAISE EXCEPTION 'Account mappings not configured';
  END IF;

  INSERT INTO public.journal_entries (entry_date, description, reference_type, reference_id, status, is_auto)
  VALUES (p_entry_date, 'Landed Cost: ' || p_landed_cost_id::text, 'import', p_landed_cost_id, 'posted', true)
  RETURNING id INTO je_id;

  INSERT INTO public.journal_lines (journal_id, account_id, debit, credit, description) VALUES
    (je_id, acct_inventory, p_amount, 0, 'Inventory value increased (landed cost)'),
    (je_id, p_pay_account_id, 0, p_amount, 'Cash/Bank payment for import cost');

  UPDATE public.landed_costs SET status = 'posted', journal_id = je_id WHERE id = p_landed_cost_id;

  RETURN je_id;
END;
$$;

-- Enable RLS on new tables (no delete policy)
ALTER TABLE public.goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landed_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landed_cost_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landed_cost_allocation_lines ENABLE ROW LEVEL SECURITY;

-- Allow all operations except delete for anon (no auth yet)
CREATE POLICY "Allow all select" ON public.goods_receipts FOR SELECT USING (true);
CREATE POLICY "Allow all insert" ON public.goods_receipts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update" ON public.goods_receipts FOR UPDATE USING (true);

CREATE POLICY "Allow all select" ON public.goods_receipt_items FOR SELECT USING (true);
CREATE POLICY "Allow all insert" ON public.goods_receipt_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update" ON public.goods_receipt_items FOR UPDATE USING (true);

CREATE POLICY "Allow all select" ON public.supplier_payments FOR SELECT USING (true);
CREATE POLICY "Allow all insert" ON public.supplier_payments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update" ON public.supplier_payments FOR UPDATE USING (true);

CREATE POLICY "Allow all select" ON public.supplier_payment_allocations FOR SELECT USING (true);
CREATE POLICY "Allow all insert" ON public.supplier_payment_allocations FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update" ON public.supplier_payment_allocations FOR UPDATE USING (true);

CREATE POLICY "Allow all select" ON public.landed_costs FOR SELECT USING (true);
CREATE POLICY "Allow all insert" ON public.landed_costs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update" ON public.landed_costs FOR UPDATE USING (true);

CREATE POLICY "Allow all select" ON public.landed_cost_allocations FOR SELECT USING (true);
CREATE POLICY "Allow all insert" ON public.landed_cost_allocations FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update" ON public.landed_cost_allocations FOR UPDATE USING (true);

CREATE POLICY "Allow all select" ON public.landed_cost_allocation_lines FOR SELECT USING (true);
CREATE POLICY "Allow all insert" ON public.landed_cost_allocation_lines FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update" ON public.landed_cost_allocation_lines FOR UPDATE USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_goods_receipts_supplier ON public.goods_receipts(supplier_id);
CREATE INDEX IF NOT EXISTS idx_goods_receipts_po ON public.goods_receipts(po_id);
CREATE INDEX IF NOT EXISTS idx_goods_receipt_items_grn ON public.goods_receipt_items(grn_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier ON public.supplier_payments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_landed_costs_po ON public.landed_costs(po_id);
