
-- RPC: executive_report - comprehensive metrics for a date range
CREATE OR REPLACE FUNCTION public.executive_report(
  p_date_from date DEFAULT (now() AT TIME ZONE 'Asia/Dhaka')::date - 29,
  p_date_to date DEFAULT (now() AT TIME ZONE 'Asia/Dhaka')::date
)
RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    -- KPIs for range
    'revenue', COALESCE((
      SELECT sum(o.total_amount) FROM orders o
      WHERE o.status = 'delivered'
        AND COALESCE(o.delivered_at, o.updated_at)::date BETWEEN p_date_from AND p_date_to
    ), 0),

    'cogs', COALESCE((
      SELECT sum(oi.quantity * COALESCE(oi.unit_cost_at_delivery, p.cost_price, 0))
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE o.status = 'delivered'
        AND COALESCE(o.delivered_at, o.updated_at)::date BETWEEN p_date_from AND p_date_to
    ), 0),

    'courier_cost', COALESCE((
      SELECT sum(cs.courier_total_cost)
      FROM orders o
      JOIN courier_shipments cs ON cs.order_id = o.id
      WHERE o.status = 'delivered'
        AND COALESCE(o.delivered_at, o.updated_at)::date BETWEEN p_date_from AND p_date_to
    ), 0),

    'total_orders', (
      SELECT count(*) FROM orders o
      WHERE o.created_at::date BETWEEN p_date_from AND p_date_to
    ),

    'delivered_orders', (
      SELECT count(*) FROM orders o
      WHERE o.status = 'delivered'
        AND COALESCE(o.delivered_at, o.updated_at)::date BETWEEN p_date_from AND p_date_to
    ),

    'returned_orders', (
      SELECT count(*) FROM orders o
      WHERE o.status = 'returned'
        AND o.updated_at::date BETWEEN p_date_from AND p_date_to
    ),

    'cancelled_orders', (
      SELECT count(*) FROM orders o
      WHERE o.status = 'cancelled'
        AND o.updated_at::date BETWEEN p_date_from AND p_date_to
    ),

    -- Cash position (real-time from GL)
    'cash_position', (SELECT row_to_json(cp) FROM (
      SELECT
        COALESCE(sum(CASE WHEN coa.code = '1100' THEN jl.debit - jl.credit ELSE 0 END), 0) as cash,
        COALESCE(sum(CASE WHEN coa.code = '1101' THEN jl.debit - jl.credit ELSE 0 END), 0) as bank,
        COALESCE(sum(CASE WHEN coa.code = '1102' THEN jl.debit - jl.credit ELSE 0 END), 0) as bkash,
        COALESCE(sum(CASE WHEN coa.code = '1103' THEN jl.debit - jl.credit ELSE 0 END), 0) as nagad
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl.journal_id
      JOIN chart_of_accounts coa ON coa.id = jl.account_id
      WHERE je.status = 'posted' AND coa.code IN ('1100','1101','1102','1103')
    ) cp),

    -- Working capital (real-time)
    'inventory_value', COALESCE((
      SELECT sum(p.stock_quantity * COALESCE(p.cost_price, 0))
      FROM products p WHERE p.status = 'active' AND p.stock_quantity > 0
    ), 0),

    'courier_receivable', COALESCE((
      SELECT sum(jl.debit - jl.credit)
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl.journal_id
      JOIN chart_of_accounts coa ON coa.id = jl.account_id
      WHERE je.status = 'posted' AND coa.code = '1200'
    ), 0),

    'supplier_payable', COALESCE((
      SELECT sum(jl.credit - jl.debit)
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl.journal_id
      JOIN chart_of_accounts coa ON coa.id = jl.account_id
      WHERE je.status = 'posted' AND coa.code = '2100'
    ), 0),

    'customer_advances', COALESCE((
      SELECT sum(advance_amount) FROM orders
      WHERE advance_amount > 0 AND status NOT IN ('delivered', 'returned', 'cancelled')
    ), 0),

    -- Daily trend data for charts
    'daily_trend', COALESCE((
      SELECT json_agg(row_to_json(t) ORDER BY t.d)
      FROM (
        SELECT
          d::date as d,
          COALESCE(sum(CASE WHEN o.status = 'delivered' THEN o.total_amount ELSE 0 END), 0) as revenue,
          COALESCE(sum(CASE WHEN o.status = 'delivered' THEN o.gross_profit ELSE 0 END), 0) as profit,
          count(CASE WHEN o.status = 'returned' THEN 1 END)::int as returns,
          count(CASE WHEN o.status = 'delivered' THEN 1 END)::int as delivered,
          count(o.id)::int as orders
        FROM generate_series(p_date_from, p_date_to, '1 day'::interval) d
        LEFT JOIN orders o ON COALESCE(o.delivered_at, o.updated_at)::date = d::date
          AND o.status IN ('delivered', 'returned')
        GROUP BY d::date
      ) t
    ), '[]'::json),

    -- Expenses in range (from posted journals)
    'total_expenses', COALESCE((
      SELECT sum(jl.debit)
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl.journal_id
      JOIN chart_of_accounts coa ON coa.id = jl.account_id
      WHERE je.status = 'posted'
        AND coa.account_type = 'expense'
        AND je.entry_date BETWEEN p_date_from AND p_date_to
    ), 0)

  ) INTO result;
  RETURN result;
END;
$function$;
