
CREATE OR REPLACE FUNCTION public.profit_loss_report(
  p_date_from date DEFAULT (((now() AT TIME ZONE 'Asia/Dhaka'::text))::date - 29),
  p_date_to date DEFAULT ((now() AT TIME ZONE 'Asia/Dhaka'::text))::date
)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    -- INCOME
    'product_sales', COALESCE((
      SELECT sum(o.total_amount - COALESCE(o.delivery_charge, 0))
      FROM orders o
      WHERE o.status = 'delivered'
        AND COALESCE(o.delivered_at, o.updated_at)::date BETWEEN p_date_from AND p_date_to
    ), 0),

    'shipping_income', COALESCE((
      SELECT sum(COALESCE(o.delivery_charge, 0))
      FROM orders o
      WHERE o.status = 'delivered'
        AND COALESCE(o.delivered_at, o.updated_at)::date BETWEEN p_date_from AND p_date_to
    ), 0),

    -- COGS
    'cogs', COALESCE((
      SELECT sum(oi.quantity * COALESCE(oi.unit_cost_at_delivery, p.cost_price, 0))
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE o.status = 'delivered'
        AND COALESCE(o.delivered_at, o.updated_at)::date BETWEEN p_date_from AND p_date_to
    ), 0),

    -- EXPENSES BY CATEGORY (from GL)
    'expense_categories', COALESCE((
      SELECT json_agg(row_to_json(ec) ORDER BY ec.total DESC)
      FROM (
        SELECT
          coa.code,
          coa.name as category,
          sum(jl.debit) as total
        FROM journal_lines jl
        JOIN journal_entries je ON je.id = jl.journal_id
        JOIN chart_of_accounts coa ON coa.id = jl.account_id
        WHERE je.status = 'posted'
          AND coa.account_type = 'expense'
          AND je.entry_date BETWEEN p_date_from AND p_date_to
          AND jl.debit > 0
        GROUP BY coa.code, coa.name
      ) ec
    ), '[]'::json),

    -- COGS from GL (for reconciliation)
    'cogs_gl', COALESCE((
      SELECT sum(jl.debit)
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl.journal_id
      JOIN chart_of_accounts coa ON coa.id = jl.account_id
      WHERE je.status = 'posted'
        AND coa.account_type = 'cogs'
        AND je.entry_date BETWEEN p_date_from AND p_date_to
        AND jl.debit > 0
    ), 0),

    -- Courier costs
    'courier_expense', COALESCE((
      SELECT sum(cs.courier_total_cost)
      FROM orders o
      JOIN courier_shipments cs ON cs.order_id = o.id
      WHERE o.status = 'delivered'
        AND COALESCE(o.delivered_at, o.updated_at)::date BETWEEN p_date_from AND p_date_to
    ), 0),

    -- Return losses (COGS of returned items)
    'return_loss', COALESCE((
      SELECT sum(oi.quantity * COALESCE(oi.unit_cost_at_delivery, p.cost_price, 0))
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE o.status IN ('returned', 'damage_return')
        AND o.updated_at::date BETWEEN p_date_from AND p_date_to
    ), 0),

    -- Expense allocations (management layer)
    'allocated_expenses', COALESCE((
      SELECT json_agg(row_to_json(ae) ORDER BY ae.total DESC)
      FROM (
        SELECT
          ea.allocation_method as method,
          ec.name as category,
          sum(eal.allocated_amount) as total
        FROM expense_allocation_lines eal
        JOIN expense_allocations ea ON ea.id = eal.allocation_id
        JOIN expense_categories ec ON ec.id = ea.category_id
        WHERE ea.status = 'posted'
          AND ea.allocation_date BETWEEN p_date_from AND p_date_to
        GROUP BY ea.allocation_method, ec.name
      ) ae
    ), '[]'::json),

    'total_allocated', COALESCE((
      SELECT sum(eal.allocated_amount)
      FROM expense_allocation_lines eal
      JOIN expense_allocations ea ON ea.id = eal.allocation_id
      WHERE ea.status = 'posted'
        AND ea.allocation_date BETWEEN p_date_from AND p_date_to
    ), 0),

    -- Order stats
    'delivered_count', (
      SELECT count(*) FROM orders
      WHERE status = 'delivered'
        AND COALESCE(delivered_at, updated_at)::date BETWEEN p_date_from AND p_date_to
    ),
    'returned_count', (
      SELECT count(*) FROM orders
      WHERE status IN ('returned', 'damage_return')
        AND updated_at::date BETWEEN p_date_from AND p_date_to
    ),

    -- Monthly breakdown for chart
    'monthly_breakdown', COALESCE((
      SELECT json_agg(row_to_json(mb) ORDER BY mb.month)
      FROM (
        SELECT
          to_char(d.d, 'YYYY-MM') as month,
          to_char(d.d, 'Mon YY') as label,
          COALESCE(sum(CASE WHEN o.status = 'delivered' THEN o.total_amount ELSE 0 END), 0) as revenue,
          COALESCE(sum(CASE WHEN o.status = 'delivered' THEN COALESCE(o.gross_profit, 0) ELSE 0 END), 0) as gross_profit,
          count(CASE WHEN o.status = 'delivered' THEN 1 END)::int as delivered,
          count(CASE WHEN o.status IN ('returned','damage_return') THEN 1 END)::int as returned
        FROM generate_series(
          date_trunc('month', p_date_from::timestamp),
          date_trunc('month', p_date_to::timestamp),
          '1 month'::interval
        ) d(d)
        LEFT JOIN orders o ON date_trunc('month', COALESCE(o.delivered_at, o.updated_at)::timestamp) = d.d
          AND o.status IN ('delivered','returned','damage_return')
          AND COALESCE(o.delivered_at, o.updated_at)::date BETWEEN p_date_from AND p_date_to
        GROUP BY d.d
      ) mb
    ), '[]'::json)

  ) INTO result;
  RETURN result;
END;
$function$;
