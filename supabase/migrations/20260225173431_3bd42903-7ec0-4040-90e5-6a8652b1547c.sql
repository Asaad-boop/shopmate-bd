
-- Posting Events table: every business action that needs accounting
CREATE TABLE IF NOT EXISTS public.posting_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL, -- ADVANCE_RECEIVED, ORDER_DELIVERED, SETTLEMENT_READY, EXPENSE_RECORDED, STOCK_ADJUSTMENT
  reference_type text NOT NULL, -- order, settlement, expense, inventory
  reference_id uuid NOT NULL,
  reference_label text, -- invoice_id or human-readable ref
  event_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL DEFAULT 0,
  debit_account_id uuid REFERENCES public.chart_of_accounts(id),
  credit_account_id uuid REFERENCES public.chart_of_accounts(id),
  debit_label text,
  credit_label text,
  status text NOT NULL DEFAULT 'pending', -- pending, posted, reversed
  journal_id uuid REFERENCES public.journal_entries(id),
  reversal_journal_id uuid REFERENCES public.journal_entries(id),
  reversed_reason text,
  posted_at timestamptz,
  posted_by uuid,
  reversed_at timestamptz,
  reversed_by uuid,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (event_type, reference_id) -- idempotent: one event per ref
);

ALTER TABLE public.posting_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.posting_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_posting_events_status ON public.posting_events (status);
CREATE INDEX idx_posting_events_type ON public.posting_events (event_type);
CREATE INDEX idx_posting_events_ref ON public.posting_events (reference_id);

-- RPC: List posting events with pagination & filtering
CREATE OR REPLACE FUNCTION public.list_posting_events(
  p_event_type text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_offset int DEFAULT 0,
  p_limit int DEFAULT 50
)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result json;
  q_like text;
BEGIN
  IF p_search IS NOT NULL AND trim(p_search) != '' THEN
    q_like := '%' || trim(p_search) || '%';
  END IF;

  SELECT json_build_object(
    'total', (
      SELECT count(*) FROM posting_events pe
      WHERE (p_event_type IS NULL OR pe.event_type = p_event_type)
        AND (p_status IS NULL OR pe.status = p_status)
        AND (q_like IS NULL OR pe.reference_label ILIKE q_like)
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
          pe.metadata, pe.created_at,
          -- exception count for this reference
          (SELECT count(*) FROM order_exceptions oe
           WHERE oe.order_id = pe.reference_id AND oe.resolved_at IS NULL)::int AS exception_count
        FROM posting_events pe
        WHERE (p_event_type IS NULL OR pe.event_type = p_event_type)
          AND (p_status IS NULL OR pe.status = p_status)
          AND (q_like IS NULL OR pe.reference_label ILIKE q_like)
        ORDER BY pe.event_date DESC, pe.created_at DESC
        OFFSET p_offset LIMIT p_limit
      ) r
    ), '[]'::json)
  ) INTO result;
  RETURN result;
END;
$$;

-- RPC: Post a single event (creates journal entry)
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
BEGIN
  SELECT * INTO ev FROM posting_events WHERE id = p_event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found'; END IF;
  IF ev.status != 'pending' THEN RAISE EXCEPTION 'Event already %', ev.status; END IF;
  IF ev.debit_account_id IS NULL OR ev.credit_account_id IS NULL THEN
    RAISE EXCEPTION 'Account mappings missing for this event';
  END IF;

  -- Period lock check
  v_period_key := to_char(ev.event_date, 'YYYY-MM');
  IF EXISTS (SELECT 1 FROM accounting_periods WHERE period_key = v_period_key AND status = 'closed') THEN
    RAISE EXCEPTION 'Cannot post to closed period (%)', v_period_key;
  END IF;

  INSERT INTO journal_entries (entry_date, description, reference_type, reference_id, status, is_auto)
  VALUES (
    ev.event_date,
    ev.event_type || ': ' || COALESCE(ev.reference_label, ev.reference_id::text),
    ev.reference_type,
    ev.reference_id,
    'posted',
    true
  ) RETURNING id INTO je_id;

  INSERT INTO journal_lines (journal_id, account_id, debit, credit, description) VALUES
    (je_id, ev.debit_account_id, ev.amount, 0, ev.debit_label),
    (je_id, ev.credit_account_id, 0, ev.amount, ev.credit_label);

  UPDATE posting_events
  SET status = 'posted', journal_id = je_id, posted_at = now(), posted_by = auth.uid()
  WHERE id = p_event_id;

  INSERT INTO audit_logs (entity_type, entity_id, action, after_json, reason)
  VALUES ('posting_event', p_event_id::text, 'post_event',
    json_build_object('journal_id', je_id, 'amount', ev.amount)::jsonb,
    'Posted via posting queue');

  RETURN je_id;
END;
$$;

-- RPC: Reverse a posted event
CREATE OR REPLACE FUNCTION public.reverse_event(p_event_id uuid, p_reason text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  ev posting_events%ROWTYPE;
  rev_id uuid;
BEGIN
  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'Reason is required for reversal';
  END IF;

  SELECT * INTO ev FROM posting_events WHERE id = p_event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found'; END IF;
  IF ev.status != 'posted' THEN RAISE EXCEPTION 'Can only reverse posted events'; END IF;
  IF ev.journal_id IS NULL THEN RAISE EXCEPTION 'No journal to reverse'; END IF;

  -- Use existing reverse_journal_entry RPC
  SELECT public.reverse_journal_entry(ev.journal_id, p_reason) INTO rev_id;

  UPDATE posting_events
  SET status = 'reversed', reversal_journal_id = rev_id,
      reversed_at = now(), reversed_by = auth.uid(), reversed_reason = p_reason
  WHERE id = p_event_id;

  INSERT INTO audit_logs (entity_type, entity_id, action, before_json, after_json, reason)
  VALUES ('posting_event', p_event_id::text, 'reverse_event',
    json_build_object('journal_id', ev.journal_id)::jsonb,
    json_build_object('reversal_journal_id', rev_id)::jsonb,
    p_reason);

  RETURN rev_id;
END;
$$;

-- RPC: Posting queue tab counts
CREATE OR REPLACE FUNCTION public.posting_queue_counts()
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE result json;
BEGIN
  SELECT json_build_object(
    'ADVANCE_RECEIVED', (SELECT count(*) FROM posting_events WHERE event_type = 'ADVANCE_RECEIVED' AND status = 'pending'),
    'ORDER_DELIVERED', (SELECT count(*) FROM posting_events WHERE event_type = 'ORDER_DELIVERED' AND status = 'pending'),
    'SETTLEMENT_READY', (SELECT count(*) FROM posting_events WHERE event_type = 'SETTLEMENT_READY' AND status = 'pending'),
    'EXPENSE_RECORDED', (SELECT count(*) FROM posting_events WHERE event_type = 'EXPENSE_RECORDED' AND status = 'pending'),
    'STOCK_ADJUSTMENT', (SELECT count(*) FROM posting_events WHERE event_type = 'STOCK_ADJUSTMENT' AND status = 'pending'),
    'total_pending', (SELECT count(*) FROM posting_events WHERE status = 'pending'),
    'total_posted', (SELECT count(*) FROM posting_events WHERE status = 'posted'),
    'total_reversed', (SELECT count(*) FROM posting_events WHERE status = 'reversed')
  ) INTO result;
  RETURN result;
END;
$$;
