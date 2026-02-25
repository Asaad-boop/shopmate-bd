
-- Settlement batches table (extends existing courier_settlements_v2 concept)
CREATE TABLE IF NOT EXISTS public.settlement_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id uuid NOT NULL REFERENCES public.couriers(id),
  courier_name text NOT NULL,
  batch_ref text,
  statement_date date NOT NULL DEFAULT CURRENT_DATE,
  file_name text,
  total_rows int NOT NULL DEFAULT 0,
  matched_count int NOT NULL DEFAULT 0,
  unmatched_count int NOT NULL DEFAULT 0,
  mismatch_count int NOT NULL DEFAULT 0,
  posted_count int NOT NULL DEFAULT 0,
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft', -- draft, matched, partially_posted, posted, closed
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

ALTER TABLE public.settlement_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.settlement_batches FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Settlement batch lines
CREATE TABLE IF NOT EXISTS public.settlement_batch_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.settlement_batches(id) ON DELETE CASCADE,
  row_index int NOT NULL DEFAULT 0,
  tracking_id text,
  invoice_id text,
  courier_order_id text,
  statement_amount numeric(12,2) NOT NULL DEFAULT 0,
  courier_delivery_fee numeric(12,2) DEFAULT 0,
  courier_cod_fee numeric(12,2) DEFAULT 0,
  courier_discount numeric(12,2) DEFAULT 0,
  courier_additional numeric(12,2) DEFAULT 0,
  courier_total_cost numeric(12,2) DEFAULT 0,
  net_payable_statement numeric(12,2) DEFAULT 0,
  -- matched order data
  order_id uuid REFERENCES public.orders(id),
  matched_customer_total numeric(12,2),
  matched_courier_cost numeric(12,2),
  matched_net_payable numeric(12,2),
  -- status
  match_status text NOT NULL DEFAULT 'pending', -- pending, matched, unmatched, mismatch
  mismatch_reason text,
  mismatch_amount numeric(12,2),
  -- posting
  posted boolean NOT NULL DEFAULT false,
  journal_id uuid REFERENCES public.journal_entries(id),
  posted_at timestamptz,
  posted_by uuid,
  receiving_account_id uuid REFERENCES public.chart_of_accounts(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.settlement_batch_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.settlement_batch_lines FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_sbl_batch ON public.settlement_batch_lines (batch_id);
CREATE INDEX idx_sbl_order ON public.settlement_batch_lines (order_id);
CREATE INDEX idx_sbl_tracking ON public.settlement_batch_lines (tracking_id);

-- RPC: Auto-match a batch's lines to orders
CREATE OR REPLACE FUNCTION public.settlement_auto_match(p_batch_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  line record;
  found_order record;
  m_count int := 0;
  u_count int := 0;
  mm_count int := 0;
  tolerance numeric := 10; -- ৳10 tolerance
BEGIN
  FOR line IN SELECT * FROM settlement_batch_lines WHERE batch_id = p_batch_id AND match_status = 'pending'
  LOOP
    -- Try matching by tracking_id, invoice_id, or courier_order_id
    SELECT o.id, o.total_amount, 
           COALESCE(cs.courier_total_cost, 0) as sys_courier_cost,
           COALESCE(cs.courier_net_payable, 0) as sys_net_payable
    INTO found_order
    FROM orders o
    LEFT JOIN courier_shipments cs ON cs.order_id = o.id
    WHERE (line.tracking_id IS NOT NULL AND (cs.tracking_id = line.tracking_id OR o.pathao_tracking_code = line.tracking_id OR o.legacy_tracking_id = line.tracking_id))
       OR (line.invoice_id IS NOT NULL AND o.invoice_id = line.invoice_id)
    LIMIT 1;

    IF found_order.id IS NOT NULL THEN
      -- Check for amount mismatch
      IF ABS(COALESCE(line.net_payable_statement, 0) - found_order.sys_net_payable) > tolerance THEN
        UPDATE settlement_batch_lines SET
          match_status = 'mismatch',
          order_id = found_order.id,
          matched_customer_total = found_order.total_amount,
          matched_courier_cost = found_order.sys_courier_cost,
          matched_net_payable = found_order.sys_net_payable,
          mismatch_reason = 'Amount diff: statement=' || COALESCE(line.net_payable_statement,0)::text || ' vs system=' || found_order.sys_net_payable::text,
          mismatch_amount = ABS(COALESCE(line.net_payable_statement,0) - found_order.sys_net_payable)
        WHERE id = line.id;
        mm_count := mm_count + 1;
      ELSE
        UPDATE settlement_batch_lines SET
          match_status = 'matched',
          order_id = found_order.id,
          matched_customer_total = found_order.total_amount,
          matched_courier_cost = found_order.sys_courier_cost,
          matched_net_payable = found_order.sys_net_payable
        WHERE id = line.id;
        m_count := m_count + 1;
      END IF;
    ELSE
      UPDATE settlement_batch_lines SET match_status = 'unmatched' WHERE id = line.id;
      u_count := u_count + 1;
    END IF;
  END LOOP;

  -- Update batch counts
  UPDATE settlement_batches SET
    matched_count = (SELECT count(*) FROM settlement_batch_lines WHERE batch_id = p_batch_id AND match_status = 'matched'),
    unmatched_count = (SELECT count(*) FROM settlement_batch_lines WHERE batch_id = p_batch_id AND match_status = 'unmatched'),
    mismatch_count = (SELECT count(*) FROM settlement_batch_lines WHERE batch_id = p_batch_id AND match_status = 'mismatch'),
    status = 'matched'
  WHERE id = p_batch_id;

  RETURN json_build_object('matched', m_count, 'unmatched', u_count, 'mismatch', mm_count);
END;
$$;

-- RPC: Post a single settlement line (creates 3-line journal)
CREATE OR REPLACE FUNCTION public.post_settlement_line(
  p_line_id uuid,
  p_receiving_account_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  ln settlement_batch_lines%ROWTYPE;
  je_id uuid;
  acct_courier_recv uuid;
  acct_courier_expense uuid;
  v_net_payable numeric;
  v_courier_cost numeric;
  v_collectable numeric;
  v_order_invoice text;
BEGIN
  SELECT * INTO ln FROM settlement_batch_lines WHERE id = p_line_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Line not found'; END IF;
  IF ln.posted THEN RAISE EXCEPTION 'Already posted'; END IF;
  IF ln.order_id IS NULL THEN RAISE EXCEPTION 'Line not matched to an order'; END IF;
  IF ln.match_status NOT IN ('matched', 'mismatch') THEN RAISE EXCEPTION 'Cannot post unmatched line'; END IF;

  -- Check if order already settlement_posted
  IF EXISTS (SELECT 1 FROM orders WHERE id = ln.order_id AND settlement_posted = true) THEN
    RAISE EXCEPTION 'Order already has settlement posted (idempotent block)';
  END IF;

  v_collectable := COALESCE(ln.matched_customer_total, ln.statement_amount);
  v_courier_cost := COALESCE(ln.matched_courier_cost, ln.courier_total_cost, 0);
  v_net_payable := COALESCE(ln.matched_net_payable, ln.net_payable_statement, 0);

  SELECT invoice_id INTO v_order_invoice FROM orders WHERE id = ln.order_id;

  -- Get account IDs
  SELECT account_id INTO acct_courier_recv FROM account_mappings WHERE mapping_key = 'courier_receivable';
  IF acct_courier_recv IS NULL THEN
    SELECT id INTO acct_courier_recv FROM chart_of_accounts WHERE code = '1200';
  END IF;

  -- Courier expense account (6400 or similar)
  SELECT id INTO acct_courier_expense FROM chart_of_accounts WHERE code = '6400' AND is_active = true;
  IF acct_courier_expense IS NULL THEN
    INSERT INTO chart_of_accounts (code, name, account_type, normal_balance, is_system)
    VALUES ('6400', 'Courier & Delivery Expense', 'expense', 'debit', true)
    RETURNING id INTO acct_courier_expense;
  END IF;

  -- Create 3-line journal:
  -- Dr Receiving Account (Bank/bKash/Cash) = net_payable
  -- Dr Courier Expense = courier_total_cost
  -- Cr Courier Receivable = collectable (customer_total)
  INSERT INTO journal_entries (entry_date, description, reference_type, reference_id, status, is_auto)
  VALUES (CURRENT_DATE, 'Settlement: ' || COALESCE(v_order_invoice, ln.order_id::text), 'settlement', ln.order_id, 'posted', true)
  RETURNING id INTO je_id;

  INSERT INTO journal_lines (journal_id, account_id, debit, credit, description) VALUES
    (je_id, p_receiving_account_id, v_net_payable, 0, 'COD received - net payable'),
    (je_id, acct_courier_expense, v_courier_cost, 0, 'Courier charges'),
    (je_id, acct_courier_recv, 0, v_collectable, 'Courier receivable cleared');

  -- Mark line posted
  UPDATE settlement_batch_lines SET
    posted = true, journal_id = je_id, posted_at = now(),
    posted_by = auth.uid(), receiving_account_id = p_receiving_account_id
  WHERE id = p_line_id;

  -- Mark order settlement_posted
  UPDATE orders SET settlement_posted = true WHERE id = ln.order_id;

  -- Update batch posted count
  UPDATE settlement_batches SET
    posted_count = (SELECT count(*) FROM settlement_batch_lines WHERE batch_id = ln.batch_id AND posted = true)
  WHERE id = ln.batch_id;

  -- Audit
  INSERT INTO audit_logs (entity_type, entity_id, action, after_json, reason)
  VALUES ('settlement_line', p_line_id::text, 'post_settlement',
    json_build_object('journal_id', je_id, 'net_payable', v_net_payable, 'courier_cost', v_courier_cost, 'collectable', v_collectable)::jsonb,
    'Settlement posted via finance/settlements');

  RETURN je_id;
END;
$$;
