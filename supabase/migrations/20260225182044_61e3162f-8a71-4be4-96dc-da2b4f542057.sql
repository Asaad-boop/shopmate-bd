
-- Add compensation column to settlement_batch_lines
ALTER TABLE public.settlement_batch_lines
  ADD COLUMN IF NOT EXISTS courier_compensation numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ignored boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ignore_reason text;

-- Enhanced auto-match with 1 BDT tolerance and exception creation
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
  tolerance numeric := 1.00;
  v_computed_cost numeric;
  v_computed_net numeric;
BEGIN
  FOR line IN SELECT * FROM settlement_batch_lines WHERE batch_id = p_batch_id AND match_status IN ('pending','unmatched','mismatch') AND NOT COALESCE(ignored, false)
  LOOP
    found_order := NULL;

    -- Priority 1: tracking_id exact match
    IF line.tracking_id IS NOT NULL THEN
      SELECT o.id, o.total_amount,
             COALESCE(cs.courier_total_cost, 0) as sys_courier_cost,
             COALESCE(cs.courier_net_payable, 0) as sys_net_payable,
             o.settlement_posted, o.invoice_id as inv
      INTO found_order
      FROM orders o
      LEFT JOIN courier_shipments cs ON cs.order_id = o.id
      WHERE cs.tracking_id = line.tracking_id
         OR o.pathao_tracking_code = line.tracking_id
         OR o.legacy_tracking_id = line.tracking_id
      LIMIT 1;
    END IF;

    -- Priority 2: invoice_id exact match
    IF line.invoice_id IS NOT NULL AND found_order.id IS NULL THEN
      SELECT o.id, o.total_amount,
             COALESCE(cs.courier_total_cost, 0) as sys_courier_cost,
             COALESCE(cs.courier_net_payable, 0) as sys_net_payable,
             o.settlement_posted, o.invoice_id as inv
      INTO found_order
      FROM orders o
      LEFT JOIN courier_shipments cs ON cs.order_id = o.id
      WHERE o.invoice_id = line.invoice_id
      LIMIT 1;
    END IF;

    -- Priority 3: courier_order_id
    IF line.courier_order_id IS NOT NULL AND found_order.id IS NULL THEN
      SELECT o.id, o.total_amount,
             COALESCE(cs.courier_total_cost, 0) as sys_courier_cost,
             COALESCE(cs.courier_net_payable, 0) as sys_net_payable,
             o.settlement_posted, o.invoice_id as inv
      INTO found_order
      FROM orders o
      LEFT JOIN courier_shipments cs ON cs.order_id = o.id
      WHERE cs.tracking_id = line.courier_order_id
      LIMIT 1;
    END IF;

    -- Compute costs from statement data
    v_computed_cost := COALESCE(line.courier_delivery_fee,0) + COALESCE(line.courier_cod_fee,0)
                     - COALESCE(line.courier_discount,0) + COALESCE(line.courier_additional,0)
                     + COALESCE(line.courier_compensation,0);
    v_computed_net := COALESCE(line.statement_amount,0) - v_computed_cost;

    -- Update computed fields
    UPDATE settlement_batch_lines SET
      courier_total_cost = ROUND(v_computed_cost, 2),
      net_payable_statement = ROUND(v_computed_net, 2)
    WHERE id = line.id;

    IF found_order.id IS NOT NULL THEN
      -- Check if already posted
      IF found_order.settlement_posted = true THEN
        UPDATE settlement_batch_lines SET
          match_status = 'mismatch', order_id = found_order.id,
          matched_customer_total = found_order.total_amount,
          matched_courier_cost = found_order.sys_courier_cost,
          matched_net_payable = found_order.sys_net_payable,
          mismatch_reason = 'Order already settlement posted',
          mismatch_amount = 0
        WHERE id = line.id;
        INSERT INTO settlement_exceptions (exception_type, settlement_line_id, order_id, invoice_id, dispute_status)
        VALUES ('already_posted', line.id, found_order.id, found_order.inv, 'open');
        mm_count := mm_count + 1;
        CONTINUE;
      END IF;

      -- Check net_payable negative
      IF ROUND(v_computed_net, 2) < 0 THEN
        UPDATE settlement_batch_lines SET
          match_status = 'mismatch', order_id = found_order.id,
          matched_customer_total = found_order.total_amount,
          matched_courier_cost = found_order.sys_courier_cost,
          matched_net_payable = found_order.sys_net_payable,
          mismatch_reason = 'Negative net payable: ' || ROUND(v_computed_net,2)::text,
          mismatch_amount = ABS(ROUND(v_computed_net,2))
        WHERE id = line.id;
        INSERT INTO settlement_exceptions (exception_type, settlement_line_id, order_id, invoice_id,
          expected_amount, received_amount, difference, dispute_status)
        VALUES ('negative_net_payable', line.id, found_order.id, found_order.inv,
          0, ROUND(v_computed_net,2), ABS(ROUND(v_computed_net,2)), 'open');
        mm_count := mm_count + 1;
        CONTINUE;
      END IF;

      -- Check amount mismatch
      IF found_order.sys_net_payable > 0 AND ABS(ROUND(v_computed_net,2) - found_order.sys_net_payable) > tolerance THEN
        UPDATE settlement_batch_lines SET
          match_status = 'mismatch', order_id = found_order.id,
          matched_customer_total = found_order.total_amount,
          matched_courier_cost = found_order.sys_courier_cost,
          matched_net_payable = found_order.sys_net_payable,
          mismatch_reason = 'Amount diff: stmt=' || ROUND(v_computed_net,2)::text || ' sys=' || found_order.sys_net_payable::text,
          mismatch_amount = ABS(ROUND(v_computed_net,2) - found_order.sys_net_payable)
        WHERE id = line.id;
        INSERT INTO settlement_exceptions (exception_type, settlement_line_id, order_id, invoice_id,
          expected_amount, received_amount, difference, dispute_status)
        VALUES ('amount_mismatch', line.id, found_order.id, found_order.inv,
          found_order.sys_net_payable, ROUND(v_computed_net,2),
          ABS(ROUND(v_computed_net,2) - found_order.sys_net_payable), 'open');
        mm_count := mm_count + 1;
      ELSE
        UPDATE settlement_batch_lines SET
          match_status = 'matched', order_id = found_order.id,
          matched_customer_total = found_order.total_amount,
          matched_courier_cost = found_order.sys_courier_cost,
          matched_net_payable = found_order.sys_net_payable
        WHERE id = line.id;
        m_count := m_count + 1;
      END IF;
    ELSE
      UPDATE settlement_batch_lines SET match_status = 'unmatched' WHERE id = line.id;
      IF line.tracking_id IS NULL AND line.invoice_id IS NULL THEN
        INSERT INTO settlement_exceptions (exception_type, settlement_line_id, dispute_status)
        VALUES ('missing_identifiers', line.id, 'open');
      END IF;
      u_count := u_count + 1;
    END IF;
  END LOOP;

  -- Update batch counts
  UPDATE settlement_batches SET
    matched_count = (SELECT count(*) FROM settlement_batch_lines WHERE batch_id = p_batch_id AND match_status = 'matched'),
    unmatched_count = (SELECT count(*) FROM settlement_batch_lines WHERE batch_id = p_batch_id AND match_status = 'unmatched'),
    mismatch_count = (SELECT count(*) FROM settlement_batch_lines WHERE batch_id = p_batch_id AND match_status = 'mismatch'),
    posted_count = (SELECT count(*) FROM settlement_batch_lines WHERE batch_id = p_batch_id AND posted = true),
    status = CASE
      WHEN (SELECT count(*) FROM settlement_batch_lines WHERE batch_id = p_batch_id AND posted = true AND NOT COALESCE(ignored,false)) = (SELECT count(*) FROM settlement_batch_lines WHERE batch_id = p_batch_id AND NOT COALESCE(ignored,false)) THEN 'posted'
      WHEN (SELECT count(*) FROM settlement_batch_lines WHERE batch_id = p_batch_id AND posted = true) > 0 THEN 'partially_posted'
      ELSE 'matched'
    END
  WHERE id = p_batch_id;

  RETURN json_build_object('matched', m_count, 'unmatched', u_count, 'mismatch', mm_count);
END;
$$;

-- Enhanced post_settlement_line with negative check and batch fields on order
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
  IF COALESCE(ln.ignored, false) THEN RAISE EXCEPTION 'Line is ignored'; END IF;
  IF ln.order_id IS NULL THEN RAISE EXCEPTION 'Line not matched to an order'; END IF;
  IF ln.match_status NOT IN ('matched', 'mismatch') THEN RAISE EXCEPTION 'Cannot post unmatched line'; END IF;

  IF EXISTS (SELECT 1 FROM orders WHERE id = ln.order_id AND settlement_posted = true) THEN
    RAISE EXCEPTION 'Order already has settlement posted (idempotent block)';
  END IF;

  IF EXISTS (SELECT 1 FROM settlement_batch_lines WHERE order_id = ln.order_id AND batch_id = ln.batch_id AND posted = true AND id != p_line_id) THEN
    RAISE EXCEPTION 'Duplicate: another line for same order in this batch already posted';
  END IF;

  v_collectable := COALESCE(ln.matched_customer_total, ln.statement_amount);
  v_courier_cost := COALESCE(ln.courier_total_cost, 0);
  v_net_payable := ROUND(v_collectable - v_courier_cost, 2);

  IF v_net_payable < 0 THEN
    RAISE EXCEPTION 'Cannot post: net payable is negative (%). Create exception instead.', v_net_payable;
  END IF;

  SELECT invoice_id INTO v_order_invoice FROM orders WHERE id = ln.order_id;

  SELECT account_id INTO acct_courier_recv FROM account_mappings WHERE mapping_key = 'courier_receivable';
  IF acct_courier_recv IS NULL THEN
    SELECT id INTO acct_courier_recv FROM chart_of_accounts WHERE code = '1200';
  END IF;

  SELECT id INTO acct_courier_expense FROM chart_of_accounts WHERE code = '6400' AND is_active = true;
  IF acct_courier_expense IS NULL THEN
    INSERT INTO chart_of_accounts (code, name, account_type, normal_balance, is_system)
    VALUES ('6400', 'Courier & Delivery Expense', 'expense', 'debit', true)
    RETURNING id INTO acct_courier_expense;
  END IF;

  INSERT INTO journal_entries (entry_date, description, reference_type, reference_id, status, is_auto)
  VALUES (CURRENT_DATE, 'Settlement: ' || COALESCE(v_order_invoice, ln.order_id::text), 'settlement', ln.order_id, 'posted', true)
  RETURNING id INTO je_id;

  INSERT INTO journal_lines (journal_id, account_id, debit, credit, description) VALUES
    (je_id, p_receiving_account_id, v_net_payable, 0, 'COD received - net payable'),
    (je_id, acct_courier_expense, v_courier_cost, 0, 'Courier charges'),
    (je_id, acct_courier_recv, 0, v_collectable, 'Courier receivable cleared');

  UPDATE settlement_batch_lines SET
    posted = true, journal_id = je_id, posted_at = now(),
    posted_by = auth.uid(), receiving_account_id = p_receiving_account_id,
    matched_net_payable = v_net_payable, matched_courier_cost = v_courier_cost
  WHERE id = p_line_id;

  UPDATE orders SET
    settlement_posted = true,
    settlement_batch_id = ln.batch_id,
    settlement_journal_id = je_id,
    courier_total_cost = v_courier_cost,
    net_payable = v_net_payable
  WHERE id = ln.order_id;

  UPDATE settlement_batches SET
    posted_count = (SELECT count(*) FROM settlement_batch_lines WHERE batch_id = ln.batch_id AND posted = true),
    status = CASE
      WHEN (SELECT count(*) FROM settlement_batch_lines WHERE batch_id = ln.batch_id AND posted = true AND NOT COALESCE(ignored,false)) =
           (SELECT count(*) FROM settlement_batch_lines WHERE batch_id = ln.batch_id AND NOT COALESCE(ignored,false)) THEN 'posted'
      ELSE 'partially_posted'
    END
  WHERE id = ln.batch_id;

  INSERT INTO audit_logs (entity_type, entity_id, action, after_json, reason)
  VALUES ('settlement_line', p_line_id::text, 'post_settlement',
    json_build_object('journal_id', je_id, 'net_payable', v_net_payable, 'courier_cost', v_courier_cost, 'collectable', v_collectable, 'batch_id', ln.batch_id)::jsonb,
    'Settlement posted via finance/settlements');

  RETURN je_id;
END;
$$;

-- Manual match RPC
CREATE OR REPLACE FUNCTION public.settlement_manual_match(p_line_id uuid, p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order record;
  v_batch_id uuid;
BEGIN
  SELECT o.id, o.total_amount, o.invoice_id,
         COALESCE(cs.courier_total_cost, 0) as sys_courier_cost,
         COALESCE(cs.courier_net_payable, 0) as sys_net_payable
  INTO v_order
  FROM orders o
  LEFT JOIN courier_shipments cs ON cs.order_id = o.id
  WHERE o.id = p_order_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  SELECT batch_id INTO v_batch_id FROM settlement_batch_lines WHERE id = p_line_id;

  UPDATE settlement_batch_lines SET
    match_status = 'matched',
    order_id = p_order_id,
    matched_customer_total = v_order.total_amount,
    matched_courier_cost = v_order.sys_courier_cost,
    matched_net_payable = v_order.sys_net_payable
  WHERE id = p_line_id;

  UPDATE settlement_batches SET
    matched_count = (SELECT count(*) FROM settlement_batch_lines WHERE batch_id = v_batch_id AND match_status = 'matched'),
    unmatched_count = (SELECT count(*) FROM settlement_batch_lines WHERE batch_id = v_batch_id AND match_status = 'unmatched'),
    mismatch_count = (SELECT count(*) FROM settlement_batch_lines WHERE batch_id = v_batch_id AND match_status = 'mismatch')
  WHERE id = v_batch_id;
END;
$$;
