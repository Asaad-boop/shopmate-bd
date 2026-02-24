
-- ═══ accounting_periods table ═══
CREATE TABLE IF NOT EXISTS public.accounting_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_key text NOT NULL UNIQUE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status varchar NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  closed_at timestamptz,
  closed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.accounting_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON public.accounting_periods FOR ALL USING (true) WITH CHECK (true);

-- Add period_key column to journal_entries
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS period_key text;

-- Add reference_type default enrichment
ALTER TABLE public.journal_entries ALTER COLUMN reference_type SET DEFAULT 'manual';

-- Backfill period_key for existing entries
UPDATE public.journal_entries SET period_key = to_char(entry_date, 'YYYY-MM') WHERE period_key IS NULL;

-- ═══ account_mappings table for default accounts ═══
CREATE TABLE IF NOT EXISTS public.account_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mapping_key text NOT NULL UNIQUE,
  account_id uuid REFERENCES public.chart_of_accounts(id),
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.account_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON public.account_mappings FOR ALL USING (true) WITH CHECK (true);

-- Seed default mappings
INSERT INTO public.account_mappings (mapping_key, description, account_id) VALUES
  ('inventory', 'Default Inventory Account', (SELECT id FROM public.chart_of_accounts WHERE code = '1300' LIMIT 1)),
  ('cogs', 'Default COGS Account', (SELECT id FROM public.chart_of_accounts WHERE code = '5100' LIMIT 1)),
  ('product_sales', 'Default Product Sales Account', (SELECT id FROM public.chart_of_accounts WHERE code = '4100' LIMIT 1)),
  ('shipping_income', 'Default Shipping Income Account', (SELECT id FROM public.chart_of_accounts WHERE code = '4200' LIMIT 1)),
  ('courier_receivable', 'Default Courier Receivable Account', (SELECT id FROM public.chart_of_accounts WHERE code = '1200' LIMIT 1)),
  ('cash', 'Default Cash Account', (SELECT id FROM public.chart_of_accounts WHERE code = '1100' LIMIT 1)),
  ('bank', 'Default Bank Account', (SELECT id FROM public.chart_of_accounts WHERE code = '1100' LIMIT 1)),
  ('supplier_payable', 'Default Supplier Payable Account', (SELECT id FROM public.chart_of_accounts WHERE code = '2100' LIMIT 1))
ON CONFLICT (mapping_key) DO NOTHING;

-- ═══ Trigger: auto-set period_key on journal_entries ═══
CREATE OR REPLACE FUNCTION public.fn_set_journal_period_key()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  NEW.period_key := to_char(NEW.entry_date, 'YYYY-MM');
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_set_journal_period_key ON public.journal_entries;
CREATE TRIGGER trg_set_journal_period_key
  BEFORE INSERT OR UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_journal_period_key();

-- ═══ Update validation trigger to also check accounting_periods ═══
CREATE OR REPLACE FUNCTION public.fn_validate_journal_balance()
RETURNS trigger LANGUAGE plpgsql AS $function$
DECLARE
  total_debit numeric;
  total_credit numeric;
  v_period_key text;
BEGIN
  SELECT COALESCE(SUM(debit),0), COALESCE(SUM(credit),0)
  INTO total_debit, total_credit
  FROM public.journal_lines WHERE journal_id = NEW.id;

  IF NEW.status = 'posted' AND total_debit != total_credit THEN
    RAISE EXCEPTION 'Journal entry imbalanced: debit=% credit=%', total_debit, total_credit;
  END IF;

  IF NEW.status = 'posted' THEN
    v_period_key := to_char(NEW.entry_date, 'YYYY-MM');
    
    -- Check accounting_periods table
    IF EXISTS (
      SELECT 1 FROM public.accounting_periods
      WHERE period_key = v_period_key AND status = 'closed'
    ) THEN
      RAISE EXCEPTION 'Cannot post to closed period (%)', v_period_key;
    END IF;

    -- Check legacy period locks
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
$function$;

-- ═══ Integration hook functions ═══

-- post_order_delivered
CREATE OR REPLACE FUNCTION public.post_order_delivered(
  p_order_id uuid,
  p_product_sales numeric,
  p_shipping_income numeric,
  p_cogs numeric,
  p_courier_receivable numeric,
  p_entry_date date DEFAULT CURRENT_DATE
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $function$
DECLARE
  je_id uuid;
  acct_courier_recv uuid;
  acct_sales uuid;
  acct_shipping uuid;
  acct_cogs uuid;
  acct_inventory uuid;
BEGIN
  SELECT account_id INTO acct_courier_recv FROM public.account_mappings WHERE mapping_key = 'courier_receivable';
  SELECT account_id INTO acct_sales FROM public.account_mappings WHERE mapping_key = 'product_sales';
  SELECT account_id INTO acct_shipping FROM public.account_mappings WHERE mapping_key = 'shipping_income';
  SELECT account_id INTO acct_cogs FROM public.account_mappings WHERE mapping_key = 'cogs';
  SELECT account_id INTO acct_inventory FROM public.account_mappings WHERE mapping_key = 'inventory';

  INSERT INTO public.journal_entries (entry_date, description, reference_type, reference_id, status, is_auto)
  VALUES (p_entry_date, 'Order delivered: ' || p_order_id::text, 'order', p_order_id, 'posted', true)
  RETURNING id INTO je_id;

  INSERT INTO public.journal_lines (journal_id, account_id, debit, credit, description) VALUES
    (je_id, acct_courier_recv, p_courier_receivable, 0, 'Courier receivable'),
    (je_id, acct_sales, 0, p_product_sales, 'Product sales'),
    (je_id, acct_shipping, 0, p_shipping_income, 'Shipping income'),
    (je_id, acct_cogs, p_cogs, 0, 'Cost of goods sold'),
    (je_id, acct_inventory, 0, p_cogs, 'Inventory reduction');

  RETURN je_id;
END;
$function$;

-- post_cod_received
CREATE OR REPLACE FUNCTION public.post_cod_received(
  p_order_id uuid,
  p_amount numeric,
  p_entry_date date DEFAULT CURRENT_DATE,
  p_cash_account text DEFAULT 'bank'
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $function$
DECLARE
  je_id uuid;
  acct_cash uuid;
  acct_courier_recv uuid;
BEGIN
  SELECT account_id INTO acct_cash FROM public.account_mappings WHERE mapping_key = p_cash_account;
  SELECT account_id INTO acct_courier_recv FROM public.account_mappings WHERE mapping_key = 'courier_receivable';

  INSERT INTO public.journal_entries (entry_date, description, reference_type, reference_id, status, is_auto)
  VALUES (p_entry_date, 'COD received: ' || p_order_id::text, 'courier', p_order_id, 'posted', true)
  RETURNING id INTO je_id;

  INSERT INTO public.journal_lines (journal_id, account_id, debit, credit, description) VALUES
    (je_id, acct_cash, p_amount, 0, 'Cash/Bank receipt'),
    (je_id, acct_courier_recv, 0, p_amount, 'Courier receivable cleared');

  RETURN je_id;
END;
$function$;

-- post_purchase_receive
CREATE OR REPLACE FUNCTION public.post_purchase_receive(
  p_grn_id uuid,
  p_amount numeric,
  p_entry_date date DEFAULT CURRENT_DATE
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $function$
DECLARE
  je_id uuid;
  acct_inventory uuid;
  acct_supplier_payable uuid;
BEGIN
  SELECT account_id INTO acct_inventory FROM public.account_mappings WHERE mapping_key = 'inventory';
  SELECT account_id INTO acct_supplier_payable FROM public.account_mappings WHERE mapping_key = 'supplier_payable';

  INSERT INTO public.journal_entries (entry_date, description, reference_type, reference_id, status, is_auto)
  VALUES (p_entry_date, 'Purchase received: ' || p_grn_id::text, 'purchase', p_grn_id, 'posted', true)
  RETURNING id INTO je_id;

  INSERT INTO public.journal_lines (journal_id, account_id, debit, credit, description) VALUES
    (je_id, acct_inventory, p_amount, 0, 'Inventory received'),
    (je_id, acct_supplier_payable, 0, p_amount, 'Supplier payable');

  RETURN je_id;
END;
$function$;

-- post_expense_entry
CREATE OR REPLACE FUNCTION public.post_expense_entry(
  p_expense_id uuid,
  p_amount numeric,
  p_entry_date date DEFAULT CURRENT_DATE,
  p_expense_account_id uuid DEFAULT NULL,
  p_pay_account text DEFAULT 'cash'
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $function$
DECLARE
  je_id uuid;
  acct_expense uuid;
  acct_pay uuid;
BEGIN
  acct_expense := COALESCE(p_expense_account_id, (SELECT account_id FROM public.account_mappings WHERE mapping_key = 'cogs'));
  SELECT account_id INTO acct_pay FROM public.account_mappings WHERE mapping_key = p_pay_account;

  INSERT INTO public.journal_entries (entry_date, description, reference_type, reference_id, status, is_auto)
  VALUES (p_entry_date, 'Expense: ' || p_expense_id::text, 'expense', p_expense_id, 'posted', true)
  RETURNING id INTO je_id;

  INSERT INTO public.journal_lines (journal_id, account_id, debit, credit, description) VALUES
    (je_id, acct_expense, p_amount, 0, 'Expense'),
    (je_id, acct_pay, 0, p_amount, 'Cash/Bank payment');

  RETURN je_id;
END;
$function$;

-- ═══ Close period function ═══
CREATE OR REPLACE FUNCTION public.close_accounting_period(p_period_key text, p_closed_by uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $function$
DECLARE
  v_start date;
  v_end date;
BEGIN
  v_start := (p_period_key || '-01')::date;
  v_end := (v_start + interval '1 month' - interval '1 day')::date;

  INSERT INTO public.accounting_periods (period_key, start_date, end_date, status, closed_at, closed_by)
  VALUES (p_period_key, v_start, v_end, 'closed', now(), p_closed_by)
  ON CONFLICT (period_key) DO UPDATE SET status = 'closed', closed_at = now(), closed_by = p_closed_by;
END;
$function$;

-- ═══ Reopen period function ═══
CREATE OR REPLACE FUNCTION public.reopen_accounting_period(p_period_key text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $function$
BEGIN
  UPDATE public.accounting_periods SET status = 'open', closed_at = NULL, closed_by = NULL
  WHERE period_key = p_period_key;
END;
$function$;
