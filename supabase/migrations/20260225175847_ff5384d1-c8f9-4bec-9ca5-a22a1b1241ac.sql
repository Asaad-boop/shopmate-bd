
CREATE OR REPLACE FUNCTION public.cashflow_report(
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
    -- Opening cash balance (all cash/bank accounts before period)
    'opening_balance', COALESCE((
      SELECT sum(jl.debit - jl.credit)
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl.journal_id
      JOIN chart_of_accounts coa ON coa.id = jl.account_id
      WHERE je.status = 'posted'
        AND coa.code IN ('1100','1101','1102','1103')
        AND je.entry_date < p_date_from
    ), 0),

    -- Closing cash balance (all cash/bank accounts up to end of period)
    'closing_balance', COALESCE((
      SELECT sum(jl.debit - jl.credit)
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl.journal_id
      JOIN chart_of_accounts coa ON coa.id = jl.account_id
      WHERE je.status = 'posted'
        AND coa.code IN ('1100','1101','1102','1103')
        AND je.entry_date <= p_date_to
    ), 0),

    -- OPERATING: Cash movements on cash/bank accounts grouped by journal reference_type
    'operating', COALESCE((
      SELECT json_agg(row_to_json(op) ORDER BY op.net_amount DESC)
      FROM (
        SELECT
          je.reference_type,
          CASE je.reference_type
            WHEN 'order' THEN 'Order Deliveries'
            WHEN 'courier' THEN 'Courier Settlements'
            WHEN 'expense' THEN 'Expense Payments'
            WHEN 'manual' THEN 'Manual Adjustments'
            WHEN 'adjustment' THEN 'Balance Adjustments'
            WHEN 'reversal' THEN 'Reversals'
            ELSE initcap(COALESCE(je.reference_type, 'Other'))
          END as label,
          sum(jl.debit - jl.credit) as net_amount,
          sum(jl.debit) as inflow,
          sum(jl.credit) as outflow,
          count(DISTINCT je.id)::int as txn_count
        FROM journal_lines jl
        JOIN journal_entries je ON je.id = jl.journal_id
        JOIN chart_of_accounts coa ON coa.id = jl.account_id
        WHERE je.status = 'posted'
          AND coa.code IN ('1100','1101','1102','1103')
          AND je.entry_date BETWEEN p_date_from AND p_date_to
          AND je.reference_type NOT IN ('purchase','import','payroll')
        GROUP BY je.reference_type
      ) op
    ), '[]'::json),

    -- INVESTING: Purchase & import related cash flows
    'investing', COALESCE((
      SELECT json_agg(row_to_json(inv) ORDER BY inv.net_amount)
      FROM (
        SELECT
          je.reference_type,
          CASE je.reference_type
            WHEN 'purchase' THEN 'Supplier Payments'
            WHEN 'import' THEN 'Import / Landed Costs'
            ELSE initcap(COALESCE(je.reference_type, 'Other'))
          END as label,
          sum(jl.debit - jl.credit) as net_amount,
          sum(jl.debit) as inflow,
          sum(jl.credit) as outflow,
          count(DISTINCT je.id)::int as txn_count
        FROM journal_lines jl
        JOIN journal_entries je ON je.id = jl.journal_id
        JOIN chart_of_accounts coa ON coa.id = jl.account_id
        WHERE je.status = 'posted'
          AND coa.code IN ('1100','1101','1102','1103')
          AND je.entry_date BETWEEN p_date_from AND p_date_to
          AND je.reference_type IN ('purchase','import')
        GROUP BY je.reference_type
      ) inv
    ), '[]'::json),

    -- FINANCING: Payroll & equity movements
    'financing', COALESCE((
      SELECT json_agg(row_to_json(fin) ORDER BY fin.net_amount)
      FROM (
        SELECT
          je.reference_type,
          CASE je.reference_type
            WHEN 'payroll' THEN 'Payroll / Salary'
            ELSE initcap(COALESCE(je.reference_type, 'Other'))
          END as label,
          sum(jl.debit - jl.credit) as net_amount,
          sum(jl.debit) as inflow,
          sum(jl.credit) as outflow,
          count(DISTINCT je.id)::int as txn_count
        FROM journal_lines jl
        JOIN journal_entries je ON je.id = jl.journal_id
        JOIN chart_of_accounts coa ON coa.id = jl.account_id
        WHERE je.status = 'posted'
          AND coa.code IN ('1100','1101','1102','1103')
          AND je.entry_date BETWEEN p_date_from AND p_date_to
          AND je.reference_type IN ('payroll')
        GROUP BY je.reference_type
      ) fin
    ), '[]'::json),

    -- Per-account breakdown
    'by_account', COALESCE((
      SELECT json_agg(row_to_json(ba) ORDER BY ba.code)
      FROM (
        SELECT
          coa.code,
          coa.name,
          COALESCE(sum(CASE WHEN je.entry_date < p_date_from THEN jl.debit - jl.credit ELSE 0 END), 0) as opening,
          COALESCE(sum(CASE WHEN je.entry_date BETWEEN p_date_from AND p_date_to THEN jl.debit ELSE 0 END), 0) as period_inflow,
          COALESCE(sum(CASE WHEN je.entry_date BETWEEN p_date_from AND p_date_to THEN jl.credit ELSE 0 END), 0) as period_outflow,
          COALESCE(sum(CASE WHEN je.entry_date <= p_date_to THEN jl.debit - jl.credit ELSE 0 END), 0) as closing
        FROM journal_lines jl
        JOIN journal_entries je ON je.id = jl.journal_id
        JOIN chart_of_accounts coa ON coa.id = jl.account_id
        WHERE je.status = 'posted'
          AND coa.code IN ('1100','1101','1102','1103')
        GROUP BY coa.code, coa.name
      ) ba
    ), '[]'::json),

    -- Daily trend for chart
    'daily_trend', COALESCE((
      SELECT json_agg(row_to_json(dt) ORDER BY dt.d)
      FROM (
        SELECT
          d::date as d,
          COALESCE(sum(jl.debit), 0) as inflow,
          COALESCE(sum(jl.credit), 0) as outflow,
          COALESCE(sum(jl.debit - jl.credit), 0) as net
        FROM generate_series(p_date_from, p_date_to, '1 day'::interval) d
        LEFT JOIN journal_lines jl ON TRUE
        LEFT JOIN journal_entries je ON je.id = jl.journal_id
          AND je.status = 'posted'
          AND je.entry_date = d::date
        LEFT JOIN chart_of_accounts coa ON coa.id = jl.account_id
          AND coa.code IN ('1100','1101','1102','1103')
        WHERE (jl.id IS NULL OR coa.id IS NOT NULL)
        GROUP BY d::date
      ) dt
    ), '[]'::json)

  ) INTO result;
  RETURN result;
END;
$function$;
