
-- Dashboard RPC: Today KPIs
CREATE OR REPLACE FUNCTION public.dashboard_today_kpis()
RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
  today date := (now() AT TIME ZONE 'Asia/Dhaka')::date;
BEGIN
  SELECT json_build_object(
    'orders_created', (SELECT count(*) FROM orders WHERE order_date::date = today),
    'orders_delivered', (SELECT count(*) FROM orders WHERE status = 'delivered' AND (delivered_at::date = today OR (delivered_at IS NULL AND updated_at::date = today AND status = 'delivered'))),
    'returns_today', (SELECT count(*) FROM orders WHERE status = 'returned' AND updated_at::date = today),
    'today_revenue', COALESCE((SELECT sum(total_amount) FROM orders WHERE status = 'delivered' AND (COALESCE(delivered_at, updated_at))::date = today), 0),
    'today_cogs', COALESCE((
      SELECT sum(oi.quantity * COALESCE(oi.unit_cost_at_delivery, p.cost_price, 0))
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE o.status = 'delivered' AND (COALESCE(o.delivered_at, o.updated_at))::date = today
    ), 0),
    'today_courier_cost', COALESCE((
      SELECT sum(cs.courier_total_cost)
      FROM orders o
      JOIN courier_shipments cs ON cs.order_id = o.id
      WHERE o.status = 'delivered' AND (COALESCE(o.delivered_at, o.updated_at))::date = today
    ), 0)
  ) INTO result;
  RETURN result;
END;
$$;

-- Dashboard RPC: Cash position from journal entries
CREATE OR REPLACE FUNCTION public.dashboard_cash_position()
RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'cash', COALESCE((
      SELECT sum(CASE WHEN jl.debit > 0 THEN jl.debit ELSE -jl.credit END)
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl.journal_id
      JOIN chart_of_accounts coa ON coa.id = jl.account_id
      WHERE je.status = 'posted' AND coa.code = '1100'
    ), 0),
    'bank', COALESCE((
      SELECT sum(CASE WHEN jl.debit > 0 THEN jl.debit ELSE -jl.credit END)
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl.journal_id
      JOIN chart_of_accounts coa ON coa.id = jl.account_id
      WHERE je.status = 'posted' AND coa.code = '1101'
    ), 0),
    'bkash', COALESCE((
      SELECT sum(CASE WHEN jl.debit > 0 THEN jl.debit ELSE -jl.credit END)
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl.journal_id
      JOIN chart_of_accounts coa ON coa.id = jl.account_id
      WHERE je.status = 'posted' AND coa.code = '1102'
    ), 0),
    'nagad', COALESCE((
      SELECT sum(CASE WHEN jl.debit > 0 THEN jl.debit ELSE -jl.credit END)
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl.journal_id
      JOIN chart_of_accounts coa ON coa.id = jl.account_id
      WHERE je.status = 'posted' AND coa.code = '1103'
    ), 0)
  ) INTO result;
  RETURN result;
END;
$$;

-- Dashboard RPC: Working capital
CREATE OR REPLACE FUNCTION public.dashboard_working_capital()
RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'inventory_value', COALESCE((
      SELECT sum(p.stock_quantity * COALESCE(p.cost_price, 0))
      FROM products p WHERE p.status = 'active' AND p.stock_quantity > 0
    ), 0),
    'courier_receivable', COALESCE((
      SELECT sum(CASE WHEN jl.debit > 0 THEN jl.debit ELSE -jl.credit END)
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl.journal_id
      JOIN chart_of_accounts coa ON coa.id = jl.account_id
      WHERE je.status = 'posted' AND coa.code = '1200'
    ), 0),
    'supplier_payable', COALESCE((
      SELECT sum(CASE WHEN jl.credit > 0 THEN jl.credit ELSE -jl.debit END)
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl.journal_id
      JOIN chart_of_accounts coa ON coa.id = jl.account_id
      WHERE je.status = 'posted' AND coa.code = '2100'
    ), 0),
    'customer_advances', COALESCE((
      SELECT sum(advance_amount) FROM orders
      WHERE advance_amount > 0 AND status NOT IN ('delivered', 'returned', 'cancelled')
    ), 0)
  ) INTO result;
  RETURN result;
END;
$$;

-- Dashboard RPC: 14-day trend
CREATE OR REPLACE FUNCTION public.dashboard_14day_trend()
RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_agg(row_to_json(t)) INTO result
  FROM (
    SELECT
      d::date as date,
      COALESCE(sum(CASE WHEN o.status = 'delivered' THEN o.total_amount ELSE 0 END), 0) as revenue,
      COALESCE(sum(CASE WHEN o.status = 'delivered' THEN o.gross_profit ELSE 0 END), 0) as profit
    FROM generate_series(
      (now() AT TIME ZONE 'Asia/Dhaka')::date - 13,
      (now() AT TIME ZONE 'Asia/Dhaka')::date,
      '1 day'::interval
    ) d
    LEFT JOIN orders o ON (COALESCE(o.delivered_at, o.updated_at))::date = d::date AND o.status = 'delivered'
    GROUP BY d::date
    ORDER BY d::date
  ) t;
  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Dashboard RPC: Alerts counts
CREATE OR REPLACE FUNCTION public.dashboard_alerts()
RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
  five_days_ago timestamptz := now() - interval '5 days';
BEGIN
  SELECT json_build_object(
    'not_synced', (SELECT count(*) FROM orders WHERE courier_sync_status = 'NOT_SYNCED' AND tracking_id IS NOT NULL AND status NOT IN ('cancelled', 'delivered', 'returned')),
    'settlement_pending', (SELECT count(*) FROM orders WHERE status = 'delivered' AND settlement_posted IS NOT TRUE AND COALESCE(delivered_at, updated_at) < five_days_ago),
    'negative_stock', (SELECT count(*) FROM products WHERE status = 'active' AND stock_quantity < 0),
    'advance_not_posted', (SELECT count(*) FROM orders WHERE advance_amount > 0 AND advance_posted IS NOT TRUE AND status NOT IN ('cancelled')),
    'supplier_overdue', (SELECT count(*) FROM purchase_orders WHERE status = 'received' AND payment_status != 'paid'),
    'unposted_journals', (SELECT count(*) FROM journal_entries WHERE status = 'draft')
  ) INTO result;
  RETURN result;
END;
$$;

-- Ensure bKash and Nagad accounts exist in chart_of_accounts
INSERT INTO chart_of_accounts (code, name, account_type, normal_balance, is_system, is_active)
VALUES ('1102', 'bKash', 'asset', 'debit', true, true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO chart_of_accounts (code, name, account_type, normal_balance, is_system, is_active)
VALUES ('1103', 'Nagad', 'asset', 'debit', true, true)
ON CONFLICT (code) DO NOTHING;
