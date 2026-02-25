
DROP FUNCTION IF EXISTS public.executive_report(date, date);

CREATE OR REPLACE FUNCTION public.executive_report(
  p_date_from date,
  p_date_to date
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_result jsonb;
  v_revenue numeric := 0;
  v_cogs numeric := 0;
  v_courier_cost numeric := 0;
  v_total_expenses numeric := 0;
  v_marketing_cost numeric := 0;
  v_total_orders int := 0;
  v_delivered_orders int := 0;
  v_returned_orders int := 0;
  v_cancelled_orders int := 0;
  v_delivered_revenue numeric := 0;
  v_cash_position jsonb;
  v_working_capital jsonb;
  v_daily_trend jsonb;
  v_expense_breakdown jsonb;
  v_prev_revenue numeric := 0;
  v_prev_net_profit numeric := 0;
  v_prev_delivered int := 0;
  v_prev_returned int := 0;
  v_period_days int;
  v_prev_from date;
  v_prev_to date;
BEGIN
  v_period_days := (p_date_to - p_date_from) + 1;
  v_prev_to := p_date_from - 1;
  v_prev_from := v_prev_to - v_period_days + 1;

  -- P&L from posted journals
  SELECT
    COALESCE(SUM(CASE WHEN ca.account_type = 'income' THEN jl.credit - jl.debit ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN ca.account_type = 'cogs' THEN jl.debit - jl.credit ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN ca.account_type = 'expense' AND ca.code LIKE '6%' THEN jl.debit - jl.credit ELSE 0 END), 0)
  INTO v_revenue, v_cogs, v_total_expenses
  FROM journal_lines jl
  JOIN journal_entries je ON je.id = jl.journal_id
  JOIN chart_of_accounts ca ON ca.id = jl.account_id
  WHERE je.status = 'posted'
    AND je.entry_date BETWEEN p_date_from AND p_date_to;

  -- Courier cost from shipments
  SELECT COALESCE(SUM(cs.courier_total_cost), 0)
  INTO v_courier_cost
  FROM courier_shipments cs
  WHERE cs.booking_status = 'delivered'
    AND cs.delivered_at::date BETWEEN p_date_from AND p_date_to;

  -- Marketing cost
  SELECT COALESCE(SUM(amount_bdt), 0)
  INTO v_marketing_cost
  FROM ad_expenses
  WHERE expense_date BETWEEN p_date_from AND p_date_to;

  -- Order counts
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'delivered'),
    COUNT(*) FILTER (WHERE status IN ('returned', 'damage_return')),
    COUNT(*) FILTER (WHERE status = 'cancelled')
  INTO v_total_orders, v_delivered_orders, v_returned_orders, v_cancelled_orders
  FROM orders
  WHERE order_date::date BETWEEN p_date_from AND p_date_to;

  SELECT COALESCE(SUM(total_amount), 0)
  INTO v_delivered_revenue
  FROM orders
  WHERE status = 'delivered'
    AND order_date::date BETWEEN p_date_from AND p_date_to;

  -- Previous period
  SELECT
    COALESCE(SUM(CASE WHEN ca.account_type = 'income' THEN jl.credit - jl.debit ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN ca.account_type = 'income' THEN jl.credit - jl.debit ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN ca.account_type = 'cogs' THEN jl.debit - jl.credit ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN ca.account_type = 'expense' THEN jl.debit - jl.credit ELSE 0 END), 0)
  INTO v_prev_revenue, v_prev_net_profit
  FROM journal_lines jl
  JOIN journal_entries je ON je.id = jl.journal_id
  JOIN chart_of_accounts ca ON ca.id = jl.account_id
  WHERE je.status = 'posted'
    AND je.entry_date BETWEEN v_prev_from AND v_prev_to;

  SELECT
    COUNT(*) FILTER (WHERE status = 'delivered'),
    COUNT(*) FILTER (WHERE status IN ('returned', 'damage_return'))
  INTO v_prev_delivered, v_prev_returned
  FROM orders
  WHERE order_date::date BETWEEN v_prev_from AND v_prev_to;

  -- Cash position (current)
  SELECT jsonb_build_object(
    'cash', COALESCE(SUM(CASE WHEN ca.code = '1100' THEN jl.debit - jl.credit ELSE 0 END), 0),
    'bank', COALESCE(SUM(CASE WHEN ca.code = '1110' THEN jl.debit - jl.credit ELSE 0 END), 0),
    'bkash', COALESCE(SUM(CASE WHEN ca.code = '1120' THEN jl.debit - jl.credit ELSE 0 END), 0),
    'nagad', COALESCE(SUM(CASE WHEN ca.code = '1130' THEN jl.debit - jl.credit ELSE 0 END), 0)
  ) INTO v_cash_position
  FROM journal_lines jl
  JOIN journal_entries je ON je.id = jl.journal_id
  JOIN chart_of_accounts ca ON ca.id = jl.account_id
  WHERE je.status = 'posted'
    AND ca.code IN ('1100', '1110', '1120', '1130');

  -- Working capital
  WITH inv AS (
    SELECT COALESCE(SUM(COALESCE(on_hand,0) * COALESCE(avg_cost,0)), 0) AS val FROM v_stock_on_hand
  ),
  courier_recv AS (
    SELECT COALESCE(SUM(jl.debit - jl.credit), 0) AS val
    FROM journal_lines jl JOIN journal_entries je ON je.id = jl.journal_id JOIN chart_of_accounts ca ON ca.id = jl.account_id
    WHERE je.status = 'posted' AND ca.code = '1200'
  ),
  supplier_pay AS (
    SELECT COALESCE(SUM(jl.credit - jl.debit), 0) AS val
    FROM journal_lines jl JOIN journal_entries je ON je.id = jl.journal_id JOIN chart_of_accounts ca ON ca.id = jl.account_id
    WHERE je.status = 'posted' AND ca.code = '2100'
  ),
  cust_adv AS (
    SELECT COALESCE(SUM(jl.credit - jl.debit), 0) AS val
    FROM journal_lines jl JOIN journal_entries je ON je.id = jl.journal_id JOIN chart_of_accounts ca ON ca.id = jl.account_id
    WHERE je.status = 'posted' AND ca.code = '2200'
  )
  SELECT jsonb_build_object(
    'inventory_value', (SELECT val FROM inv),
    'courier_receivable', (SELECT val FROM courier_recv),
    'supplier_payable', (SELECT val FROM supplier_pay),
    'customer_advances', (SELECT val FROM cust_adv)
  ) INTO v_working_capital;

  -- Daily trend
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.d), '[]'::jsonb)
  INTO v_daily_trend
  FROM (
    SELECT
      d::date AS d,
      COALESCE(SUM(CASE WHEN ca.account_type = 'income' THEN jl.credit - jl.debit ELSE 0 END), 0) AS revenue,
      COALESCE(SUM(CASE WHEN ca.account_type = 'income' THEN jl.credit - jl.debit
                        WHEN ca.account_type IN ('cogs','expense') THEN -(jl.debit - jl.credit)
                        ELSE 0 END), 0) AS profit,
      (SELECT COUNT(*) FROM orders o WHERE o.status = 'delivered' AND o.order_date::date = d::date) AS delivered,
      (SELECT COUNT(*) FROM orders o WHERE o.status IN ('returned','damage_return') AND o.order_date::date = d::date) AS returns
    FROM generate_series(p_date_from, p_date_to, '1 day'::interval) d
    LEFT JOIN journal_entries je ON je.entry_date = d::date AND je.status = 'posted'
    LEFT JOIN journal_lines jl ON jl.journal_id = je.id
    LEFT JOIN chart_of_accounts ca ON ca.id = jl.account_id
    GROUP BY d
  ) t;

  -- Expense breakdown
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_expense_breakdown
  FROM (
    SELECT
      COALESCE(ca.name, 'Other') AS category,
      SUM(jl.debit - jl.credit) AS amount
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.journal_id
    JOIN chart_of_accounts ca ON ca.id = jl.account_id
    WHERE je.status = 'posted'
      AND je.entry_date BETWEEN p_date_from AND p_date_to
      AND ca.account_type = 'expense'
    GROUP BY ca.name
    ORDER BY amount DESC
  ) t;

  v_result := jsonb_build_object(
    'revenue', v_revenue,
    'cogs', v_cogs,
    'courier_cost', v_courier_cost,
    'total_expenses', v_total_expenses,
    'marketing_cost', v_marketing_cost,
    'gross_profit', v_revenue - v_cogs,
    'net_profit', v_revenue - v_cogs - v_courier_cost - v_total_expenses,
    'total_orders', v_total_orders,
    'delivered_orders', v_delivered_orders,
    'returned_orders', v_returned_orders,
    'cancelled_orders', v_cancelled_orders,
    'delivered_revenue', v_delivered_revenue,
    'avg_order_value', CASE WHEN v_delivered_orders > 0 THEN ROUND(v_delivered_revenue / v_delivered_orders, 2) ELSE 0 END,
    'return_rate', CASE WHEN (v_delivered_orders + v_returned_orders) > 0
      THEN ROUND(v_returned_orders::numeric / (v_delivered_orders + v_returned_orders) * 100, 1) ELSE 0 END,
    'cash_position', v_cash_position,
    'working_capital', v_working_capital,
    'daily_trend', v_daily_trend,
    'expense_breakdown', v_expense_breakdown,
    'prev_revenue', v_prev_revenue,
    'prev_net_profit', v_prev_net_profit,
    'prev_delivered', v_prev_delivered,
    'prev_returned', v_prev_returned,
    'prev_return_rate', CASE WHEN (v_prev_delivered + v_prev_returned) > 0
      THEN ROUND(v_prev_returned::numeric / (v_prev_delivered + v_prev_returned) * 100, 1) ELSE 0 END
  );

  RETURN v_result;
END;
$$;
