
-- Enhanced account balances with last transaction timestamp
CREATE OR REPLACE FUNCTION public.finance_account_balances()
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result json;
  today date := (now() AT TIME ZONE 'Asia/Dhaka')::date;
  week_ago date := today - 7;
BEGIN
  SELECT json_agg(row_to_json(a) ORDER BY a.code) INTO result
  FROM (
    SELECT
      coa.id,
      coa.code,
      coa.name,
      coa.account_type,
      COALESCE(SUM(CASE WHEN je.status = 'posted' THEN jl.debit - jl.credit ELSE 0 END), 0) AS balance,
      COALESCE(SUM(CASE WHEN je.status = 'posted' AND je.entry_date = today THEN jl.debit ELSE 0 END), 0) AS today_inflow,
      COALESCE(SUM(CASE WHEN je.status = 'posted' AND je.entry_date = today THEN jl.credit ELSE 0 END), 0) AS today_outflow,
      COALESCE(SUM(CASE WHEN je.status = 'posted' AND je.entry_date = today THEN jl.debit - jl.credit ELSE 0 END), 0) AS today_change,
      COALESCE(SUM(CASE WHEN je.status = 'posted' AND je.entry_date >= week_ago THEN jl.debit ELSE 0 END), 0) AS week_inflow,
      COALESCE(SUM(CASE WHEN je.status = 'posted' AND je.entry_date >= week_ago THEN jl.credit ELSE 0 END), 0) AS week_outflow,
      COALESCE(SUM(CASE WHEN je.status = 'posted' AND je.entry_date >= week_ago THEN jl.debit - jl.credit ELSE 0 END), 0) AS week_net,
      (SELECT max(je2.created_at) FROM journal_lines jl2 JOIN journal_entries je2 ON je2.id = jl2.journal_id WHERE jl2.account_id = coa.id AND je2.status = 'posted') AS last_txn_at
    FROM chart_of_accounts coa
    LEFT JOIN journal_lines jl ON jl.account_id = coa.id
    LEFT JOIN journal_entries je ON je.id = jl.journal_id
    WHERE coa.code IN ('1100', '1101', '1102', '1103')
      AND coa.is_active = true
    GROUP BY coa.id, coa.code, coa.name, coa.account_type
  ) a;
  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Enhanced account transactions with running balance, filters, search
CREATE OR REPLACE FUNCTION public.finance_account_transactions(
  p_account_id uuid,
  p_limit int DEFAULT 50,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_reference_type text DEFAULT NULL,
  p_search text DEFAULT NULL
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

  SELECT json_agg(row_to_json(t)) INTO result
  FROM (
    SELECT
      jl.id,
      je.entry_date,
      je.description,
      je.reference_type,
      je.reference_id::text,
      je.is_auto,
      jl.debit,
      jl.credit,
      jl.description AS line_description,
      je.created_at,
      je.status,
      -- Running balance using window function
      SUM(jl.debit - jl.credit) OVER (
        ORDER BY je.entry_date, je.created_at, jl.id
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) AS running_balance
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.journal_id
    WHERE jl.account_id = p_account_id
      AND je.status = 'posted'
      AND (p_date_from IS NULL OR je.entry_date >= p_date_from)
      AND (p_date_to IS NULL OR je.entry_date <= p_date_to)
      AND (p_reference_type IS NULL OR je.reference_type = p_reference_type)
      AND (q_like IS NULL OR je.description ILIKE q_like OR jl.description ILIKE q_like OR je.reference_id::text ILIKE q_like)
    ORDER BY je.entry_date DESC, je.created_at DESC, jl.id DESC
    LIMIT p_limit
  ) t;
  RETURN COALESCE(result, '[]'::json);
END;
$$;
