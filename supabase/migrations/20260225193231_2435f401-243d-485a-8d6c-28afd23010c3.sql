
-- ============================================================
-- expense_analytics_report RPC
-- Returns category-level aggregation + daily trend + exceptions
-- Uses expenses_v2 (modern) + ad_expenses + expenses (legacy)
-- ============================================================
CREATE OR REPLACE FUNCTION public.expense_analytics_report(
  p_date_from text,
  p_date_to   text
)
RETURNS jsonb
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_result jsonb;
BEGIN
  WITH
  -- Modern expenses (expenses_v2)
  v2_expenses AS (
    SELECT
      e.id,
      ec.name AS category,
      e.amount,
      e.expense_date,
      e.status,
      e.journal_id,
      e.description,
      e.vendor_name,
      e.payment_method,
      e.paid_from_account_id,
      ca.name AS payment_account_name,
      ec.is_allocatable,
      e.category_id
    FROM expenses_v2 e
    JOIN expense_categories ec ON ec.id = e.category_id
    LEFT JOIN chart_of_accounts ca ON ca.id = e.paid_from_account_id
    WHERE e.expense_date >= p_date_from::date
      AND e.expense_date <= p_date_to::date
      AND e.status != 'cancelled'
  ),
  -- Legacy expenses
  legacy_expenses AS (
    SELECT
      e.id,
      e.category,
      e.amount_bdt AS amount,
      e.expense_date,
      CASE WHEN e.is_reversed THEN 'reversed' ELSE 'posted' END AS status,
      NULL::uuid AS journal_id,
      e.description,
      NULL AS vendor_name,
      NULL AS payment_method,
      e.payment_account_id::uuid AS paid_from_account_id,
      a.name AS payment_account_name,
      false AS is_allocatable,
      NULL::uuid AS category_id
    FROM expenses e
    LEFT JOIN accounts a ON a.id = e.payment_account_id
    WHERE e.expense_date >= p_date_from::date
      AND e.expense_date <= p_date_to::date
      AND (e.is_reversed IS NULL OR e.is_reversed = false)
  ),
  -- Ad expenses (Meta Ads etc)
  ad_exp AS (
    SELECT
      ae.id,
      ae.category,
      ae.amount_bdt AS amount,
      ae.expense_date,
      'posted' AS status,
      NULL::uuid AS journal_id,
      ae.note AS description,
      NULL AS vendor_name,
      NULL AS payment_method,
      NULL::uuid AS paid_from_account_id,
      NULL AS payment_account_name,
      true AS is_allocatable,
      NULL::uuid AS category_id
    FROM ad_expenses ae
    WHERE ae.expense_date >= p_date_from::date
      AND ae.expense_date <= p_date_to::date
  ),
  -- Combined
  all_expenses AS (
    SELECT * FROM v2_expenses
    UNION ALL
    SELECT * FROM legacy_expenses
    UNION ALL
    SELECT * FROM ad_exp
  ),
  -- Category aggregation
  by_category AS (
    SELECT
      category,
      COUNT(*)::int AS expense_count,
      ROUND(SUM(amount), 2)::numeric(14,2) AS total_amount,
      MAX(expense_date) AS last_expense_date,
      bool_or(is_allocatable) AS is_allocatable
    FROM all_expenses
    GROUP BY category
    ORDER BY SUM(amount) DESC
  ),
  -- Daily trend
  daily_trend AS (
    SELECT
      expense_date::text AS day,
      ROUND(SUM(amount), 2)::numeric(14,2) AS total
    FROM all_expenses
    GROUP BY expense_date
    ORDER BY expense_date
  ),
  -- Grand totals
  totals AS (
    SELECT
      ROUND(COALESCE(SUM(amount), 0), 2)::numeric(14,2) AS total_expenses,
      ROUND(COALESCE(SUM(amount) FILTER (WHERE category ILIKE '%meta%' OR category ILIKE '%ad%' OR category = 'marketing_ads'), 0), 2)::numeric(14,2) AS total_meta_ads,
      ROUND(COALESCE(SUM(amount) FILTER (WHERE category ILIKE '%influencer%' OR category ILIKE '%marketing%'), 0), 2)::numeric(14,2) AS total_marketing,
      ROUND(COALESCE(SUM(amount) FILTER (WHERE category NOT ILIKE '%meta%' AND category NOT ILIKE '%ad%' AND category NOT ILIKE '%influencer%' AND category NOT ILIKE '%marketing%'), 0), 2)::numeric(14,2) AS total_operational,
      COUNT(*)::int AS total_count
    FROM all_expenses
  ),
  -- Revenue for same period (from posted income journals)
  period_revenue AS (
    SELECT ROUND(COALESCE(SUM(jl.credit - jl.debit), 0), 2)::numeric(14,2) AS revenue
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.journal_id
      AND je.status = 'posted'
      AND je.entry_date >= p_date_from::date
      AND je.entry_date <= p_date_to::date
    JOIN chart_of_accounts ca ON ca.id = jl.account_id
      AND ca.account_type = 'income'
  ),
  -- Days in period
  period_days AS (
    SELECT GREATEST((p_date_to::date - p_date_from::date + 1), 1) AS days
  ),
  -- Delivered orders count for expense-per-order
  delivered_count AS (
    SELECT COUNT(*)::int AS cnt
    FROM orders
    WHERE status = 'delivered'
      AND order_date >= (p_date_from || 'T00:00:00')::timestamptz
      AND order_date <= (p_date_to   || 'T23:59:59')::timestamptz
  ),
  -- Top 5 largest single expenses
  top_expenses AS (
    SELECT category, amount, expense_date, description
    FROM all_expenses
    ORDER BY amount DESC
    LIMIT 5
  ),
  -- Top 5 highest expense days
  top_days AS (
    SELECT expense_date::text AS day, ROUND(SUM(amount), 2)::numeric(14,2) AS total
    FROM all_expenses
    GROUP BY expense_date
    ORDER BY SUM(amount) DESC
    LIMIT 5
  ),
  -- Exceptions: unposted
  exc_unposted AS (
    SELECT id, category, amount, 'unposted' AS exc_type
    FROM all_expenses
    WHERE status NOT IN ('posted', 'reversed') AND journal_id IS NULL
    LIMIT 50
  ),
  -- Exceptions: zero amount
  exc_zero AS (
    SELECT id, category, amount, 'zero_amount' AS exc_type
    FROM all_expenses
    WHERE amount = 0
    LIMIT 20
  ),
  -- Exceptions: no payment account
  exc_no_account AS (
    SELECT id, category, amount, 'no_payment_account' AS exc_type
    FROM v2_expenses
    WHERE paid_from_account_id IS NULL
    LIMIT 20
  ),
  all_exceptions AS (
    SELECT * FROM exc_unposted
    UNION ALL SELECT * FROM exc_zero
    UNION ALL SELECT * FROM exc_no_account
  )
  SELECT jsonb_build_object(
    'summary', jsonb_build_object(
      'total_expenses', (SELECT total_expenses FROM totals),
      'total_meta_ads', (SELECT total_meta_ads FROM totals),
      'total_marketing', (SELECT total_marketing FROM totals),
      'total_operational', (SELECT total_operational FROM totals),
      'total_count', (SELECT total_count FROM totals),
      'revenue', (SELECT revenue FROM period_revenue),
      'expense_ratio', CASE WHEN (SELECT revenue FROM period_revenue) > 0
        THEN ROUND((SELECT total_expenses FROM totals) / (SELECT revenue FROM period_revenue) * 100, 2)
        ELSE 0 END,
      'avg_daily', ROUND((SELECT total_expenses FROM totals) / (SELECT days FROM period_days), 2),
      'expense_per_order', CASE WHEN (SELECT cnt FROM delivered_count) > 0
        THEN ROUND((SELECT total_expenses FROM totals) / (SELECT cnt FROM delivered_count), 2)
        ELSE 0 END,
      'delivered_orders', (SELECT cnt FROM delivered_count)
    ),
    'categories', COALESCE((SELECT jsonb_agg(row_to_json(bc)::jsonb) FROM by_category bc), '[]'::jsonb),
    'daily_trend', COALESCE((SELECT jsonb_agg(row_to_json(dt)::jsonb) FROM daily_trend dt), '[]'::jsonb),
    'top_expenses', COALESCE((SELECT jsonb_agg(row_to_json(te)::jsonb) FROM top_expenses te), '[]'::jsonb),
    'top_days', COALESCE((SELECT jsonb_agg(row_to_json(td)::jsonb) FROM top_days td), '[]'::jsonb),
    'exceptions', COALESCE((SELECT jsonb_agg(row_to_json(ae)::jsonb) FROM all_exceptions ae), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ============================================================
-- expense_analytics_drilldown RPC
-- Returns expense lines for a specific category
-- ============================================================
CREATE OR REPLACE FUNCTION public.expense_analytics_drilldown(
  p_category text,
  p_date_from text,
  p_date_to   text
)
RETURNS jsonb
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_result jsonb;
BEGIN
  WITH
  v2_lines AS (
    SELECT
      e.id,
      e.expense_date,
      e.amount,
      e.description,
      e.vendor_name,
      e.payment_method,
      ca.name AS payment_account,
      e.status,
      e.journal_id,
      ec.is_allocatable,
      e.reference_type,
      e.reference_id
    FROM expenses_v2 e
    JOIN expense_categories ec ON ec.id = e.category_id
    LEFT JOIN chart_of_accounts ca ON ca.id = e.paid_from_account_id
    WHERE ec.name = p_category
      AND e.expense_date >= p_date_from::date
      AND e.expense_date <= p_date_to::date
      AND e.status != 'cancelled'
    ORDER BY e.expense_date DESC
    LIMIT 200
  ),
  legacy_lines AS (
    SELECT
      e.id,
      e.expense_date,
      e.amount_bdt AS amount,
      e.description,
      NULL AS vendor_name,
      NULL AS payment_method,
      a.name AS payment_account,
      CASE WHEN e.is_reversed THEN 'reversed' ELSE 'posted' END AS status,
      NULL::uuid AS journal_id,
      false AS is_allocatable,
      e.ref_type AS reference_type,
      e.ref_id AS reference_id
    FROM expenses e
    LEFT JOIN accounts a ON a.id = e.payment_account_id
    WHERE e.category = p_category
      AND e.expense_date >= p_date_from::date
      AND e.expense_date <= p_date_to::date
      AND (e.is_reversed IS NULL OR e.is_reversed = false)
    ORDER BY e.expense_date DESC
    LIMIT 200
  ),
  ad_lines AS (
    SELECT
      ae.id,
      ae.expense_date,
      ae.amount_bdt AS amount,
      ae.note AS description,
      NULL AS vendor_name,
      NULL AS payment_method,
      NULL AS payment_account,
      'posted' AS status,
      NULL::uuid AS journal_id,
      true AS is_allocatable,
      'campaign' AS reference_type,
      ae.campaign_id::text AS reference_id
    FROM ad_expenses ae
    WHERE ae.category = p_category
      AND ae.expense_date >= p_date_from::date
      AND ae.expense_date <= p_date_to::date
    ORDER BY ae.expense_date DESC
    LIMIT 200
  ),
  combined AS (
    SELECT * FROM v2_lines
    UNION ALL SELECT * FROM legacy_lines
    UNION ALL SELECT * FROM ad_lines
  ),
  -- Allocation summary for this category
  alloc_summary AS (
    SELECT
      ROUND(COALESCE(SUM(eal.allocated_amount), 0), 2) AS allocated,
      ROUND(
        (SELECT COALESCE(SUM(amount), 0) FROM combined) -
        COALESCE(SUM(eal.allocated_amount), 0)
      , 2) AS unallocated
    FROM expense_allocation_lines eal
    JOIN expense_allocations ea ON ea.id = eal.allocation_id
    JOIN expenses_v2 e ON e.id::text = ea.expense_ref_id
    JOIN expense_categories ec ON ec.id = e.category_id
    WHERE ec.name = p_category
      AND ea.status = 'posted'
      AND ea.allocation_date >= p_date_from::date
      AND ea.allocation_date <= p_date_to::date
  )
  SELECT jsonb_build_object(
    'lines', COALESCE((SELECT jsonb_agg(row_to_json(c)::jsonb) FROM combined c), '[]'::jsonb),
    'allocation', jsonb_build_object(
      'allocated', COALESCE((SELECT allocated FROM alloc_summary), 0),
      'unallocated', COALESCE((SELECT unallocated FROM alloc_summary), 0)
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;
