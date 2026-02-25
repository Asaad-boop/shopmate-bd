
-- Finance Posting Queue Summary RPC
CREATE OR REPLACE FUNCTION public.finance_posting_queue_summary()
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE result json;
BEGIN
  SELECT json_build_object(
    'pending_advances', (SELECT count(*) FROM orders WHERE advance_amount > 0 AND advance_posted IS NOT TRUE AND status NOT IN ('cancelled')),
    'pending_delivered', (SELECT count(*) FROM orders WHERE status = 'delivered' AND NOT EXISTS (
      SELECT 1 FROM journal_entries je WHERE je.reference_id = orders.id AND je.reference_type = 'order' AND je.status = 'posted'
    )),
    'pending_settlements', (SELECT count(*) FROM orders WHERE status = 'delivered' AND settlement_posted IS NOT TRUE AND delivered_at < now() - interval '1 day'),
    'pending_expenses', (SELECT count(*) FROM journal_entries WHERE status = 'draft' AND reference_type = 'expense')
  ) INTO result;
  RETURN result;
END;
$$;

-- Finance Settlement Summary RPC
CREATE OR REPLACE FUNCTION public.finance_settlement_summary()
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE result json;
  week_start date := date_trunc('week', now() AT TIME ZONE 'Asia/Dhaka')::date;
BEGIN
  SELECT json_build_object(
    'statements_this_week', (SELECT count(*) FROM courier_statements WHERE imported_at >= week_start),
    'orders_matched', (SELECT count(*) FROM courier_statement_lines WHERE match_status = 'matched' AND created_at >= week_start),
    'orders_posted', (SELECT count(*) FROM courier_settlements_v2 WHERE created_at >= week_start),
    'mismatch_count', (SELECT count(*) FROM courier_statement_lines WHERE match_status = 'mismatch' AND created_at >= week_start)
  ) INTO result;
  RETURN result;
END;
$$;

-- Finance-specific alerts RPC
CREATE OR REPLACE FUNCTION public.finance_alerts()
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE result json;
BEGIN
  SELECT json_build_object(
    'settlement_pending_5d', (SELECT count(*) FROM orders WHERE status = 'delivered' AND settlement_posted IS NOT TRUE AND COALESCE(delivered_at, updated_at) < now() - interval '5 days'),
    'duplicate_posting_blocked', 0,
    'unmapped_methods', (SELECT count(*) FROM account_mappings WHERE account_id IS NULL),
    'negative_stock_finance', (SELECT count(*) FROM products WHERE status = 'active' AND stock_quantity < 0)
  ) INTO result;
  RETURN result;
END;
$$;
