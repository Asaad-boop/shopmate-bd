
-- ============================================================
-- DOUBLE-ENTRY ACCOUNTING ENGINE
-- ============================================================

-- 1. CHART OF ACCOUNTS
CREATE TABLE public.chart_of_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(20) NOT NULL UNIQUE,
  name varchar(150) NOT NULL,
  account_type varchar(20) NOT NULL CHECK (account_type IN ('asset','liability','income','expense','cogs','equity')),
  parent_id uuid REFERENCES public.chart_of_accounts(id),
  description text,
  is_active boolean NOT NULL DEFAULT true,
  is_system boolean NOT NULL DEFAULT false,
  normal_balance varchar(6) NOT NULL DEFAULT 'debit' CHECK (normal_balance IN ('debit','credit')),
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. JOURNAL ENTRIES
CREATE TABLE public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number serial UNIQUE,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  description text NOT NULL,
  reference_type varchar(50),
  reference_id uuid,
  status varchar(15) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','posted','reversed')),
  is_auto boolean NOT NULL DEFAULT false,
  posted_at timestamptz,
  posted_by uuid,
  reversed_by_id uuid REFERENCES public.journal_entries(id),
  reversal_of_id uuid REFERENCES public.journal_entries(id),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. JOURNAL LINES
CREATE TABLE public.journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id uuid NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.chart_of_accounts(id),
  debit numeric NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit numeric NOT NULL DEFAULT 0 CHECK (credit >= 0),
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT line_has_amount CHECK (debit > 0 OR credit > 0),
  CONSTRAINT line_one_side CHECK (NOT (debit > 0 AND credit > 0))
);

-- 4. PERIOD LOCKS
CREATE TABLE public.accounting_period_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_end date NOT NULL UNIQUE,
  locked_at timestamptz NOT NULL DEFAULT now(),
  locked_by uuid,
  note text
);

-- INDEX
CREATE INDEX idx_journal_lines_journal ON public.journal_lines(journal_id);
CREATE INDEX idx_journal_lines_account ON public.journal_lines(account_id);
CREATE INDEX idx_journal_entries_date ON public.journal_entries(entry_date);
CREATE INDEX idx_journal_entries_ref ON public.journal_entries(reference_type, reference_id);
CREATE INDEX idx_coa_parent ON public.chart_of_accounts(parent_id);
CREATE INDEX idx_coa_type ON public.chart_of_accounts(account_type);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_period_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access" ON public.chart_of_accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.journal_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.journal_lines FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.accounting_period_locks FOR ALL USING (true) WITH CHECK (true);

-- Prevent delete of posted journals
CREATE POLICY "no_delete_posted_journals" ON public.journal_entries FOR DELETE USING (status = 'draft');

-- ============================================================
-- FUNCTION: Validate journal balance (ACID enforcement)
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_validate_journal_balance()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  total_debit numeric;
  total_credit numeric;
BEGIN
  SELECT COALESCE(SUM(debit),0), COALESCE(SUM(credit),0)
  INTO total_debit, total_credit
  FROM public.journal_lines WHERE journal_id = NEW.id;

  IF NEW.status = 'posted' AND total_debit != total_credit THEN
    RAISE EXCEPTION 'Journal entry imbalanced: debit=% credit=%', total_debit, total_credit;
  END IF;

  IF NEW.status = 'posted' THEN
    -- Check period lock
    IF EXISTS (
      SELECT 1 FROM public.accounting_period_locks
      WHERE period_end >= NEW.entry_date
    ) THEN
      RAISE EXCEPTION 'Cannot post to a locked period (entry_date=%)', NEW.entry_date;
    END IF;
    NEW.posted_at := now();
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_journal_balance
  BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW
  WHEN (NEW.status = 'posted' AND OLD.status = 'draft')
  EXECUTE FUNCTION public.fn_validate_journal_balance();

-- ============================================================
-- FUNCTION: Reverse a journal entry
-- ============================================================
CREATE OR REPLACE FUNCTION public.reverse_journal_entry(p_journal_id uuid, p_reason text DEFAULT 'Reversal')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  orig public.journal_entries%ROWTYPE;
  new_id uuid;
BEGIN
  SELECT * INTO orig FROM public.journal_entries WHERE id = p_journal_id AND status = 'posted';
  IF NOT FOUND THEN RAISE EXCEPTION 'Can only reverse posted journals'; END IF;
  IF orig.reversed_by_id IS NOT NULL THEN RAISE EXCEPTION 'Already reversed'; END IF;

  INSERT INTO public.journal_entries (entry_date, description, reference_type, reference_id, status, is_auto, reversal_of_id, created_at)
  VALUES (CURRENT_DATE, 'REVERSAL: ' || p_reason || ' | Original: ' || orig.description, orig.reference_type, orig.reference_id, 'posted', true, p_journal_id)
  RETURNING id INTO new_id;

  INSERT INTO public.journal_lines (journal_id, account_id, debit, credit, description)
  SELECT new_id, account_id, credit, debit, 'Reversal of line'
  FROM public.journal_lines WHERE journal_id = p_journal_id;

  UPDATE public.journal_entries SET status = 'reversed', reversed_by_id = new_id WHERE id = p_journal_id;

  RETURN new_id;
END;
$$;

-- ============================================================
-- FUNCTION: Auto-post on order delivered
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_auto_post_order_delivered()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  je_id uuid;
  item record;
  total_revenue numeric := 0;
  total_cogs numeric := 0;
  shipping_income numeric := 0;
  acct_courier_recv uuid;
  acct_sales uuid;
  acct_shipping_income uuid;
  acct_cogs uuid;
  acct_inventory uuid;
BEGIN
  IF NEW.status != 'delivered' OR OLD.status = 'delivered' THEN RETURN NEW; END IF;

  -- Get account IDs
  SELECT id INTO acct_courier_recv FROM public.chart_of_accounts WHERE code = '1200';
  SELECT id INTO acct_sales FROM public.chart_of_accounts WHERE code = '4100';
  SELECT id INTO acct_shipping_income FROM public.chart_of_accounts WHERE code = '4200';
  SELECT id INTO acct_cogs FROM public.chart_of_accounts WHERE code = '5100';
  SELECT id INTO acct_inventory FROM public.chart_of_accounts WHERE code = '1300';

  IF acct_courier_recv IS NULL OR acct_sales IS NULL THEN RETURN NEW; END IF;

  total_revenue := COALESCE(NEW.total, 0);
  shipping_income := COALESCE(NEW.delivery_charge, 0);

  -- Calculate COGS from order items
  SELECT COALESCE(SUM(oi.quantity * COALESCE(oi.unit_cost_at_delivery, p.cost_price, 0)), 0)
  INTO total_cogs
  FROM public.order_items oi
  LEFT JOIN public.products p ON p.id = oi.product_id
  WHERE oi.order_id = NEW.id;

  INSERT INTO public.journal_entries (entry_date, description, reference_type, reference_id, status, is_auto)
  VALUES (CURRENT_DATE, 'Auto: Order delivered ' || COALESCE(NEW.invoice_id, NEW.id::text), 'order', NEW.id, 'posted', true)
  RETURNING id INTO je_id;

  -- Dr Courier Receivable
  INSERT INTO public.journal_lines (journal_id, account_id, debit, credit, description)
  VALUES (je_id, acct_courier_recv, total_revenue, 0, 'Courier receivable');

  -- Cr Product Sales
  IF (total_revenue - shipping_income) > 0 THEN
    INSERT INTO public.journal_lines (journal_id, account_id, debit, credit, description)
    VALUES (je_id, acct_sales, 0, total_revenue - shipping_income, 'Product sales revenue');
  END IF;

  -- Cr Shipping Income
  IF shipping_income > 0 AND acct_shipping_income IS NOT NULL THEN
    INSERT INTO public.journal_lines (journal_id, account_id, debit, credit, description)
    VALUES (je_id, acct_shipping_income, 0, shipping_income, 'Shipping income');
  END IF;

  -- Dr COGS / Cr Inventory
  IF total_cogs > 0 AND acct_cogs IS NOT NULL AND acct_inventory IS NOT NULL THEN
    INSERT INTO public.journal_lines (journal_id, account_id, debit, credit, description)
    VALUES (je_id, acct_cogs, total_cogs, 0, 'Cost of goods sold');
    INSERT INTO public.journal_lines (journal_id, account_id, debit, credit, description)
    VALUES (je_id, acct_inventory, 0, total_cogs, 'Inventory reduction');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_post_order_delivered
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_auto_post_order_delivered();

-- ============================================================
-- FUNCTION: Auto-post expense created
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_auto_post_expense()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  je_id uuid;
  acct_expense uuid;
  acct_cash uuid;
BEGIN
  -- Map expense category to COA
  SELECT id INTO acct_expense FROM public.chart_of_accounts
  WHERE account_type IN ('expense','cogs') AND is_active = true
  ORDER BY CASE
    WHEN NEW.category = 'salary' THEN code = '6200'
    WHEN NEW.category = 'rent' THEN code = '6300'
    WHEN NEW.category = 'meta_ads' THEN code = '6100'
    ELSE code = '6900'
  END DESC LIMIT 1;

  SELECT id INTO acct_cash FROM public.chart_of_accounts WHERE code = '1100';

  IF acct_expense IS NULL OR acct_cash IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.journal_entries (entry_date, description, reference_type, reference_id, status, is_auto)
  VALUES (NEW.expense_date, 'Auto: Expense - ' || NEW.category || ' ' || COALESCE(NEW.description, ''), 'expense', NEW.id, 'posted', true)
  RETURNING id INTO je_id;

  INSERT INTO public.journal_lines (journal_id, account_id, debit, credit, description) VALUES
    (je_id, acct_expense, NEW.amount_bdt, 0, NEW.category || ' expense'),
    (je_id, acct_cash, 0, NEW.amount_bdt, 'Cash/Bank payment');

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_post_expense
  AFTER INSERT ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_auto_post_expense();

-- ============================================================
-- SEED: Default Chart of Accounts
-- ============================================================
INSERT INTO public.chart_of_accounts (code, name, account_type, normal_balance, is_system, sort_order) VALUES
  -- Assets
  ('1000', 'Assets', 'asset', 'debit', true, 100),
  ('1100', 'Cash & Bank', 'asset', 'debit', true, 110),
  ('1200', 'Courier Receivable', 'asset', 'debit', true, 120),
  ('1300', 'Inventory', 'asset', 'debit', true, 130),
  ('1400', 'Accounts Receivable', 'asset', 'debit', true, 140),
  -- Liabilities
  ('2000', 'Liabilities', 'liability', 'credit', true, 200),
  ('2100', 'Supplier Payable', 'liability', 'credit', true, 210),
  ('2200', 'Customer Advance', 'liability', 'credit', true, 220),
  -- Income
  ('4000', 'Revenue', 'income', 'credit', true, 400),
  ('4100', 'Product Sales', 'income', 'credit', true, 410),
  ('4200', 'Shipping Income', 'income', 'credit', true, 420),
  ('4900', 'Other Income', 'income', 'credit', true, 490),
  -- COGS
  ('5000', 'Cost of Goods Sold', 'cogs', 'debit', true, 500),
  ('5100', 'Product COGS', 'cogs', 'debit', true, 510),
  ('5200', 'Packaging Cost', 'cogs', 'debit', true, 520),
  -- Expenses
  ('6000', 'Operating Expenses', 'expense', 'debit', true, 600),
  ('6100', 'Marketing & Ads', 'expense', 'debit', true, 610),
  ('6200', 'Salaries & Wages', 'expense', 'debit', true, 620),
  ('6300', 'Rent', 'expense', 'debit', true, 630),
  ('6400', 'Courier & Shipping', 'expense', 'debit', true, 640),
  ('6500', 'Utilities', 'expense', 'debit', true, 650),
  ('6900', 'Other Expenses', 'expense', 'debit', true, 690);

-- Set parent_id for sub-accounts
UPDATE public.chart_of_accounts SET parent_id = (SELECT id FROM public.chart_of_accounts WHERE code = '1000') WHERE code IN ('1100','1200','1300','1400');
UPDATE public.chart_of_accounts SET parent_id = (SELECT id FROM public.chart_of_accounts WHERE code = '2000') WHERE code IN ('2100','2200');
UPDATE public.chart_of_accounts SET parent_id = (SELECT id FROM public.chart_of_accounts WHERE code = '4000') WHERE code IN ('4100','4200','4900');
UPDATE public.chart_of_accounts SET parent_id = (SELECT id FROM public.chart_of_accounts WHERE code = '5000') WHERE code IN ('5100','5200');
UPDATE public.chart_of_accounts SET parent_id = (SELECT id FROM public.chart_of_accounts WHERE code = '6000') WHERE code IN ('6100','6200','6300','6400','6500','6900');
