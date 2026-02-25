
-- Add blocked status and blocked_reason to posting_events
ALTER TABLE public.posting_events ADD COLUMN IF NOT EXISTS blocked_reason text;

-- Update post_event to handle multi-line journals and event-specific logic
CREATE OR REPLACE FUNCTION public.post_event(p_event_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  ev posting_events%ROWTYPE;
  je_id uuid;
  v_period_key text;
  v_meta jsonb;
  v_order record;
  v_cogs numeric;
  v_product_sales numeric;
  v_shipping_income numeric;
  v_collectable numeric;
BEGIN
  SELECT * INTO ev FROM posting_events WHERE id = p_event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found'; END IF;
  IF ev.status = 'posted' THEN RETURN ev.journal_id; END IF; -- idempotent
  IF ev.status NOT IN ('pending', 'blocked') THEN RAISE EXCEPTION 'Event status is %, cannot post', ev.status; END IF;

  -- Period lock check
  v_period_key := to_char(ev.event_date, 'YYYY-MM');
  IF EXISTS (SELECT 1 FROM accounting_periods WHERE period_key = v_period_key AND status = 'closed') THEN
    UPDATE posting_events SET status = 'blocked', blocked_reason = 'Period ' || v_period_key || ' is closed' WHERE id = p_event_id;
    RAISE EXCEPTION 'Cannot post to closed period (%)', v_period_key;
  END IF;

  v_meta := COALESCE(ev.metadata, '{}'::jsonb);

  -- Create journal entry
  INSERT INTO journal_entries (entry_date, description, reference_type, reference_id, status, is_auto)
  VALUES (
    ev.event_date,
    ev.event_type || ': ' || COALESCE(ev.reference_label, ev.reference_id::text),
    ev.reference_type,
    ev.reference_id,
    'posted',
    true
  ) RETURNING id INTO je_id;

  -- Event-specific journal lines
  CASE ev.event_type

    WHEN 'ADVANCE_RECEIVED' THEN
      -- Dr payment_account, Cr customer_advance_liability
      IF ev.debit_account_id IS NULL OR ev.credit_account_id IS NULL THEN
        RAISE EXCEPTION 'Account mappings missing for ADVANCE_RECEIVED';
      END IF;
      INSERT INTO journal_lines (journal_id, account_id, debit, credit, description) VALUES
        (je_id, ev.debit_account_id, ev.amount, 0, 'Payment received - ' || COALESCE(ev.debit_label, 'Cash/Bank')),
        (je_id, ev.credit_account_id, 0, ev.amount, 'Customer advance liability');
      -- Mark order
      UPDATE orders SET advance_posted = true WHERE id = ev.reference_id;

    WHEN 'ORDER_DELIVERED' THEN
      -- Multi-line: Dr Courier Recv, Cr Sales, Cr Shipping, Dr COGS, Cr Inventory
      v_cogs := COALESCE((v_meta->>'cogs')::numeric, 0);
      v_product_sales := COALESCE((v_meta->>'product_sales')::numeric, ev.amount);
      v_shipping_income := COALESCE((v_meta->>'shipping_income')::numeric, 0);
      v_collectable := COALESCE((v_meta->>'collectable')::numeric, ev.amount);

      -- Get account IDs from mappings or event
      DECLARE
        acct_courier_recv uuid;
        acct_sales uuid;
        acct_shipping uuid;
        acct_cogs_id uuid;
        acct_inventory uuid;
      BEGIN
        SELECT account_id INTO acct_courier_recv FROM account_mappings WHERE mapping_key = 'courier_receivable';
        SELECT account_id INTO acct_sales FROM account_mappings WHERE mapping_key = 'product_sales';
        SELECT account_id INTO acct_shipping FROM account_mappings WHERE mapping_key = 'shipping_income';
        SELECT account_id INTO acct_cogs_id FROM account_mappings WHERE mapping_key = 'cogs';
        SELECT account_id INTO acct_inventory FROM account_mappings WHERE mapping_key = 'inventory';

        IF acct_courier_recv IS NULL OR acct_sales IS NULL THEN
          UPDATE posting_events SET status = 'blocked', blocked_reason = 'Missing account mappings for ORDER_DELIVERED' WHERE id = p_event_id;
          RAISE EXCEPTION 'Missing account mappings for ORDER_DELIVERED';
        END IF;

        -- Dr Courier Receivable = collectable
        INSERT INTO journal_lines (journal_id, account_id, debit, credit, description)
        VALUES (je_id, acct_courier_recv, v_collectable, 0, 'Courier receivable');

        -- Cr Product Sales
        IF v_product_sales > 0 THEN
          INSERT INTO journal_lines (journal_id, account_id, debit, credit, description)
          VALUES (je_id, acct_sales, 0, v_product_sales, 'Product sales revenue');
        END IF;

        -- Cr Shipping Income
        IF v_shipping_income > 0 AND acct_shipping IS NOT NULL THEN
          INSERT INTO journal_lines (journal_id, account_id, debit, credit, description)
          VALUES (je_id, acct_shipping, 0, v_shipping_income, 'Shipping income');
        END IF;

        -- Dr COGS / Cr Inventory
        IF v_cogs > 0 AND acct_cogs_id IS NOT NULL AND acct_inventory IS NOT NULL THEN
          INSERT INTO journal_lines (journal_id, account_id, debit, credit, description)
          VALUES (je_id, acct_cogs_id, v_cogs, 0, 'Cost of goods sold');
          INSERT INTO journal_lines (journal_id, account_id, debit, credit, description)
          VALUES (je_id, acct_inventory, 0, v_cogs, 'Inventory reduction');
        END IF;
      END;

      UPDATE orders SET delivered_posted = true WHERE id = ev.reference_id;

    WHEN 'ORDER_RETURNED' THEN
      -- Reverse revenue: Dr Sales, Cr Courier Recv; restock: Dr Inventory, Cr COGS
      v_cogs := COALESCE((v_meta->>'cogs')::numeric, 0);
      v_product_sales := COALESCE((v_meta->>'product_sales')::numeric, ev.amount);
      v_shipping_income := COALESCE((v_meta->>'shipping_income')::numeric, 0);

      DECLARE
        acct_cr uuid; acct_s uuid; acct_sh uuid; acct_c uuid; acct_i uuid;
      BEGIN
        SELECT account_id INTO acct_cr FROM account_mappings WHERE mapping_key = 'courier_receivable';
        SELECT account_id INTO acct_s FROM account_mappings WHERE mapping_key = 'product_sales';
        SELECT account_id INTO acct_sh FROM account_mappings WHERE mapping_key = 'shipping_income';
        SELECT account_id INTO acct_c FROM account_mappings WHERE mapping_key = 'cogs';
        SELECT account_id INTO acct_i FROM account_mappings WHERE mapping_key = 'inventory';

        -- Dr Sales (reverse revenue)
        IF v_product_sales > 0 AND acct_s IS NOT NULL THEN
          INSERT INTO journal_lines (journal_id, account_id, debit, credit, description)
          VALUES (je_id, acct_s, v_product_sales, 0, 'Sales return');
        END IF;
        IF v_shipping_income > 0 AND acct_sh IS NOT NULL THEN
          INSERT INTO journal_lines (journal_id, account_id, debit, credit, description)
          VALUES (je_id, acct_sh, v_shipping_income, 0, 'Shipping income return');
        END IF;
        -- Cr Courier Receivable
        IF acct_cr IS NOT NULL THEN
          INSERT INTO journal_lines (journal_id, account_id, debit, credit, description)
          VALUES (je_id, acct_cr, 0, v_product_sales + v_shipping_income, 'Courier receivable reversed');
        END IF;
        -- Restock: Dr Inventory, Cr COGS
        IF v_cogs > 0 AND acct_c IS NOT NULL AND acct_i IS NOT NULL THEN
          INSERT INTO journal_lines (journal_id, account_id, debit, credit, description)
          VALUES (je_id, acct_i, v_cogs, 0, 'Inventory restocked');
          INSERT INTO journal_lines (journal_id, account_id, debit, credit, description)
          VALUES (je_id, acct_c, 0, v_cogs, 'COGS reversed');
        END IF;
      END;

    WHEN 'SETTLEMENT_READY' THEN
      IF ev.debit_account_id IS NULL OR ev.credit_account_id IS NULL THEN
        UPDATE posting_events SET status = 'blocked', blocked_reason = 'Missing account mappings for SETTLEMENT' WHERE id = p_event_id;
        RAISE EXCEPTION 'Account mappings missing for SETTLEMENT_READY';
      END IF;
      -- Simple 2-line: Dr receiving_account, Cr courier_receivable
      INSERT INTO journal_lines (journal_id, account_id, debit, credit, description) VALUES
        (je_id, ev.debit_account_id, ev.amount, 0, COALESCE(ev.debit_label, 'Settlement received')),
        (je_id, ev.credit_account_id, 0, ev.amount, COALESCE(ev.credit_label, 'Courier receivable cleared'));

    WHEN 'EXPENSE_RECORDED' THEN
      IF ev.debit_account_id IS NULL OR ev.credit_account_id IS NULL THEN
        UPDATE posting_events SET status = 'blocked', blocked_reason = 'Missing account mappings for EXPENSE' WHERE id = p_event_id;
        RAISE EXCEPTION 'Account mappings missing for EXPENSE_RECORDED';
      END IF;
      INSERT INTO journal_lines (journal_id, account_id, debit, credit, description) VALUES
        (je_id, ev.debit_account_id, ev.amount, 0, COALESCE(ev.debit_label, 'Expense')),
        (je_id, ev.credit_account_id, 0, ev.amount, COALESCE(ev.credit_label, 'Cash/Bank payment'));
      -- Mark expense posted if applicable
      UPDATE ad_expenses SET ref_id = je_id::text WHERE id = ev.reference_id;

    WHEN 'STOCK_OPENING', 'STOCK_ADJUSTMENT' THEN
      IF ev.debit_account_id IS NULL OR ev.credit_account_id IS NULL THEN
        UPDATE posting_events SET status = 'blocked', blocked_reason = 'Missing account mappings for STOCK event' WHERE id = p_event_id;
        RAISE EXCEPTION 'Account mappings missing for stock event';
      END IF;
      INSERT INTO journal_lines (journal_id, account_id, debit, credit, description) VALUES
        (je_id, ev.debit_account_id, ev.amount, 0, COALESCE(ev.debit_label, 'Inventory adjustment')),
        (je_id, ev.credit_account_id, 0, ev.amount, COALESCE(ev.credit_label, 'Opening equity / adjustment'));

    ELSE
      -- Fallback: simple 2-line journal
      IF ev.debit_account_id IS NULL OR ev.credit_account_id IS NULL THEN
        UPDATE posting_events SET status = 'blocked', blocked_reason = 'Missing account mappings' WHERE id = p_event_id;
        RAISE EXCEPTION 'Account mappings missing';
      END IF;
      INSERT INTO journal_lines (journal_id, account_id, debit, credit, description) VALUES
        (je_id, ev.debit_account_id, ev.amount, 0, ev.debit_label),
        (je_id, ev.credit_account_id, 0, ev.amount, ev.credit_label);

  END CASE;

  -- Update event status
  UPDATE posting_events
  SET status = 'posted', journal_id = je_id, posted_at = now(), posted_by = auth.uid(), blocked_reason = NULL
  WHERE id = p_event_id;

  -- Audit log
  INSERT INTO audit_logs (entity_type, entity_id, action, after_json, reason)
  VALUES ('posting_event', p_event_id::text, 'post_event',
    json_build_object('journal_id', je_id, 'amount', ev.amount, 'event_type', ev.event_type)::jsonb,
    'Posted via posting queue');

  RETURN je_id;
END;
$$;

-- Enhanced reverse_event with flag cleanup
CREATE OR REPLACE FUNCTION public.reverse_event(p_event_id uuid, p_reason text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  ev posting_events%ROWTYPE;
  rev_id uuid;
  v_period_key text;
BEGIN
  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'Reason is required for reversal';
  END IF;

  SELECT * INTO ev FROM posting_events WHERE id = p_event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found'; END IF;
  IF ev.status != 'posted' THEN RAISE EXCEPTION 'Can only reverse posted events'; END IF;
  IF ev.journal_id IS NULL THEN RAISE EXCEPTION 'No journal to reverse'; END IF;

  -- Period check
  v_period_key := to_char(ev.event_date, 'YYYY-MM');
  IF EXISTS (SELECT 1 FROM accounting_periods WHERE period_key = v_period_key AND status = 'closed') THEN
    RAISE EXCEPTION 'Cannot reverse in closed period (%)', v_period_key;
  END IF;

  SELECT public.reverse_journal_entry(ev.journal_id, p_reason) INTO rev_id;

  UPDATE posting_events
  SET status = 'reversed', reversal_journal_id = rev_id,
      reversed_at = now(), reversed_by = auth.uid(), reversed_reason = p_reason
  WHERE id = p_event_id;

  -- Clean up related flags based on event type
  CASE ev.event_type
    WHEN 'ADVANCE_RECEIVED' THEN
      UPDATE orders SET advance_posted = false WHERE id = ev.reference_id;
    WHEN 'ORDER_DELIVERED' THEN
      UPDATE orders SET delivered_posted = false WHERE id = ev.reference_id;
    WHEN 'SETTLEMENT_READY' THEN
      UPDATE orders SET settlement_posted = false WHERE id = ev.reference_id;
    ELSE NULL;
  END CASE;

  INSERT INTO audit_logs (entity_type, entity_id, action, before_json, after_json, reason)
  VALUES ('posting_event', p_event_id::text, 'reverse_event',
    json_build_object('journal_id', ev.journal_id)::jsonb,
    json_build_object('reversal_journal_id', rev_id)::jsonb,
    p_reason);

  RETURN rev_id;
END;
$$;

-- Enhanced counts including blocked + returns/exchanges
CREATE OR REPLACE FUNCTION public.posting_queue_counts()
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE result json;
BEGIN
  SELECT json_build_object(
    'ADVANCE_RECEIVED', (SELECT count(*) FROM posting_events WHERE event_type = 'ADVANCE_RECEIVED' AND status IN ('pending','blocked')),
    'ORDER_DELIVERED', (SELECT count(*) FROM posting_events WHERE event_type = 'ORDER_DELIVERED' AND status IN ('pending','blocked')),
    'ORDER_RETURNED', (SELECT count(*) FROM posting_events WHERE event_type IN ('ORDER_RETURNED','ORDER_EXCHANGED') AND status IN ('pending','blocked')),
    'SETTLEMENT_READY', (SELECT count(*) FROM posting_events WHERE event_type = 'SETTLEMENT_READY' AND status IN ('pending','blocked')),
    'EXPENSE_RECORDED', (SELECT count(*) FROM posting_events WHERE event_type = 'EXPENSE_RECORDED' AND status IN ('pending','blocked')),
    'STOCK_ADJUSTMENT', (SELECT count(*) FROM posting_events WHERE event_type IN ('STOCK_ADJUSTMENT','STOCK_OPENING') AND status IN ('pending','blocked')),
    'total_pending', (SELECT count(*) FROM posting_events WHERE status = 'pending'),
    'total_posted', (SELECT count(*) FROM posting_events WHERE status = 'posted'),
    'total_reversed', (SELECT count(*) FROM posting_events WHERE status = 'reversed'),
    'total_blocked', (SELECT count(*) FROM posting_events WHERE status = 'blocked')
  ) INTO result;
  RETURN result;
END;
$$;

-- Enhanced list_posting_events with blocked status, date range, multi-type filter
CREATE OR REPLACE FUNCTION public.list_posting_events(
  p_event_type text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_offset int DEFAULT 0,
  p_limit int DEFAULT 50,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result json;
  q_like text;
  v_types text[];
BEGIN
  IF p_search IS NOT NULL AND trim(p_search) != '' THEN
    q_like := '%' || trim(p_search) || '%';
  END IF;

  -- Handle grouped tabs
  IF p_event_type = 'ORDER_RETURNED' THEN
    v_types := ARRAY['ORDER_RETURNED','ORDER_EXCHANGED'];
  ELSIF p_event_type = 'STOCK_ADJUSTMENT' THEN
    v_types := ARRAY['STOCK_ADJUSTMENT','STOCK_OPENING'];
  ELSIF p_event_type IS NOT NULL THEN
    v_types := ARRAY[p_event_type];
  END IF;

  SELECT json_build_object(
    'total', (
      SELECT count(*) FROM posting_events pe
      WHERE (v_types IS NULL OR pe.event_type = ANY(v_types))
        AND (p_status IS NULL OR pe.status = p_status)
        AND (q_like IS NULL OR pe.reference_label ILIKE q_like OR pe.reference_id::text ILIKE q_like)
        AND (p_date_from IS NULL OR pe.event_date >= p_date_from)
        AND (p_date_to IS NULL OR pe.event_date <= p_date_to)
    ),
    'rows', COALESCE((
      SELECT json_agg(row_to_json(r))
      FROM (
        SELECT
          pe.id, pe.event_type, pe.reference_type, pe.reference_id,
          pe.reference_label, pe.event_date, pe.amount,
          pe.debit_label, pe.credit_label,
          pe.debit_account_id, pe.credit_account_id,
          pe.status, pe.journal_id, pe.reversal_journal_id,
          pe.posted_at, pe.reversed_at, pe.reversed_reason,
          pe.blocked_reason,
          pe.metadata, pe.created_at,
          (SELECT count(*) FROM order_exceptions oe
           WHERE oe.order_id = pe.reference_id AND oe.resolved_at IS NULL)::int AS exception_count
        FROM posting_events pe
        WHERE (v_types IS NULL OR pe.event_type = ANY(v_types))
          AND (p_status IS NULL OR pe.status = p_status)
          AND (q_like IS NULL OR pe.reference_label ILIKE q_like OR pe.reference_id::text ILIKE q_like)
          AND (p_date_from IS NULL OR pe.event_date >= p_date_from)
          AND (p_date_to IS NULL OR pe.event_date <= p_date_to)
        ORDER BY pe.event_date DESC, pe.created_at DESC
        OFFSET p_offset LIMIT p_limit
      ) r
    ), '[]'::json)
  ) INTO result;
  RETURN result;
END;
$$;

-- Preview journal lines for a posted event
CREATE OR REPLACE FUNCTION public.preview_event_journal(p_event_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result json;
  v_journal_id uuid;
BEGIN
  SELECT journal_id INTO v_journal_id FROM posting_events WHERE id = p_event_id;
  IF v_journal_id IS NULL THEN
    -- Return preview from event data itself
    SELECT json_build_object(
      'lines', (
        SELECT json_agg(row_to_json(l))
        FROM (
          SELECT
            COALESCE(coa_d.code || ' - ' || coa_d.name, pe.debit_label, 'Unmapped') as account,
            pe.amount as debit,
            0 as credit,
            COALESCE(pe.debit_label, 'Debit') as description
          FROM posting_events pe
          LEFT JOIN chart_of_accounts coa_d ON coa_d.id = pe.debit_account_id
          WHERE pe.id = p_event_id
          UNION ALL
          SELECT
            COALESCE(coa_c.code || ' - ' || coa_c.name, pe.credit_label, 'Unmapped') as account,
            0 as debit,
            pe.amount as credit,
            COALESCE(pe.credit_label, 'Credit') as description
          FROM posting_events pe
          LEFT JOIN chart_of_accounts coa_c ON coa_c.id = pe.credit_account_id
          WHERE pe.id = p_event_id
        ) l
      ),
      'metadata', (SELECT metadata FROM posting_events WHERE id = p_event_id)
    ) INTO result;
  ELSE
    -- Return actual posted journal lines
    SELECT json_build_object(
      'lines', (
        SELECT json_agg(row_to_json(l) ORDER BY l.debit DESC)
        FROM (
          SELECT
            coa.code || ' - ' || coa.name as account,
            jl.debit,
            jl.credit,
            jl.description
          FROM journal_lines jl
          JOIN chart_of_accounts coa ON coa.id = jl.account_id
          WHERE jl.journal_id = v_journal_id
        ) l
      ),
      'journal_id', v_journal_id,
      'metadata', (SELECT metadata FROM posting_events WHERE id = p_event_id)
    ) INTO result;
  END IF;
  RETURN result;
END;
$$;
