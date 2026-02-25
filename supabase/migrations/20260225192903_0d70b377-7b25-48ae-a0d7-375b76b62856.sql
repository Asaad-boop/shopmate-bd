
-- ============================================================
-- balance_snapshot_report RPC
-- Returns full balance sheet as-of a date with reconciliation
-- All values derived from posted journal entries
-- ============================================================
CREATE OR REPLACE FUNCTION public.balance_snapshot_report(
  p_as_of_date text,
  p_include_zero boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_result jsonb;
BEGIN
  WITH
  -- 1) Get all accounts from chart_of_accounts
  accounts AS (
    SELECT id, code, name, account_type, normal_balance, is_active
    FROM chart_of_accounts
    WHERE is_active = true
  ),
  -- 2) Compute balance per account from posted journals up to as-of date
  account_balances AS (
    SELECT
      a.id,
      a.code,
      a.name,
      a.account_type,
      a.normal_balance,
      ROUND(
        COALESCE(SUM(
          CASE WHEN a.normal_balance = 'debit'
            THEN jl.debit - jl.credit
            ELSE jl.credit - jl.debit
          END
        ), 0)
      , 2) AS balance
    FROM accounts a
    LEFT JOIN journal_lines jl ON jl.account_id = a.id
    LEFT JOIN journal_entries je ON je.id = jl.journal_id
      AND je.status = 'posted'
      AND je.entry_date <= p_as_of_date::date
    GROUP BY a.id, a.code, a.name, a.account_type, a.normal_balance
  ),
  -- 3) Filter zero balances if requested
  filtered AS (
    SELECT * FROM account_balances
    WHERE p_include_zero OR ABS(balance) >= 0.01
  ),
  -- 4) Group by type
  assets AS (
    SELECT jsonb_agg(jsonb_build_object(
      'code', code, 'name', name, 'balance', balance
    ) ORDER BY code) AS items,
    COALESCE(SUM(balance), 0) AS total
    FROM filtered WHERE account_type = 'asset'
  ),
  liabilities AS (
    SELECT jsonb_agg(jsonb_build_object(
      'code', code, 'name', name, 'balance', balance
    ) ORDER BY code) AS items,
    COALESCE(SUM(balance), 0) AS total
    FROM filtered WHERE account_type = 'liability'
  ),
  equity_accounts AS (
    SELECT jsonb_agg(jsonb_build_object(
      'code', code, 'name', name, 'balance', balance
    ) ORDER BY code) AS items,
    COALESCE(SUM(balance), 0) AS total
    FROM filtered WHERE account_type = 'equity'
  ),
  -- 5) Retained Earnings = cumulative (Income - COGS - Expense) from all posted journals
  retained_earnings AS (
    SELECT ROUND(COALESCE(SUM(
      CASE
        WHEN a.account_type = 'income' THEN jl.credit - jl.debit
        WHEN a.account_type IN ('expense', 'cogs') THEN -(jl.debit - jl.credit)
        ELSE 0
      END
    ), 0), 2) AS amount
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.journal_id
      AND je.status = 'posted'
      AND je.entry_date <= p_as_of_date::date
    JOIN accounts a ON a.id = jl.account_id
    WHERE a.account_type IN ('income', 'expense', 'cogs')
  ),
  -- 6) Inventory valuation from inventory_ledger (WAC)
  inventory_ledger_value AS (
    SELECT ROUND(COALESCE(SUM(
      CASE WHEN il.direction = 'in' THEN il.quantity ELSE -il.quantity END
      * COALESCE(il.running_avg_cost, il.unit_cost, 0)
    ), 0), 2) AS ledger_value
    FROM inventory_ledger il
    WHERE il.txn_date <= p_as_of_date::date
  ),
  -- 7) GL inventory asset value (code 1300%)
  gl_inventory AS (
    SELECT ROUND(COALESCE(SUM(jl.debit - jl.credit), 0), 2) AS gl_value
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.journal_id
      AND je.status = 'posted'
      AND je.entry_date <= p_as_of_date::date
    JOIN chart_of_accounts ca ON ca.id = jl.account_id
      AND ca.code LIKE '1300%'
  ),
  -- 8) Cash GL totals (codes 1100, 1110, 1120, 1130)
  cash_gl AS (
    SELECT ROUND(COALESCE(SUM(jl.debit - jl.credit), 0), 2) AS cash_total
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.journal_id
      AND je.status = 'posted'
      AND je.entry_date <= p_as_of_date::date
    JOIN chart_of_accounts ca ON ca.id = jl.account_id
      AND ca.code IN ('1100', '1110', '1120', '1130')
  ),
  -- Build result
  summary AS (
    SELECT
      COALESCE(a.total, 0)  AS total_assets,
      COALESCE(l.total, 0)  AS total_liabilities,
      COALESCE(eq.total, 0) AS total_equity_accounts,
      re.amount              AS retained_earnings,
      COALESCE(eq.total, 0) + re.amount AS total_equity,
      ABS(COALESCE(a.total, 0) - COALESCE(l.total, 0) - COALESCE(eq.total, 0) - re.amount) < 1 AS is_balanced,
      ilv.ledger_value       AS inventory_ledger_value,
      gi.gl_value            AS inventory_gl_value,
      ABS(ilv.ledger_value - gi.gl_value) < 1 AS inventory_reconciled,
      cgl.cash_total         AS cash_gl_total
    FROM assets a, liabilities l, equity_accounts eq, retained_earnings re,
         inventory_ledger_value ilv, gl_inventory gi, cash_gl cgl
  )
  SELECT jsonb_build_object(
    'as_of_date', p_as_of_date,
    'assets', jsonb_build_object(
      'items', COALESCE((SELECT items FROM assets), '[]'::jsonb),
      'total', (SELECT total FROM assets)
    ),
    'liabilities', jsonb_build_object(
      'items', COALESCE((SELECT items FROM liabilities), '[]'::jsonb),
      'total', (SELECT total FROM liabilities)
    ),
    'equity', jsonb_build_object(
      'items', COALESCE((SELECT items FROM equity_accounts), '[]'::jsonb),
      'accounts_total', (SELECT total FROM equity_accounts),
      'retained_earnings', (SELECT amount FROM retained_earnings),
      'total', (SELECT total_equity FROM summary)
    ),
    'reconciliation', jsonb_build_object(
      'total_assets', (SELECT total_assets FROM summary),
      'total_liabilities', (SELECT total_liabilities FROM summary),
      'total_equity', (SELECT total_equity FROM summary),
      'is_balanced', (SELECT is_balanced FROM summary),
      'variance', ROUND((SELECT total_assets FROM summary) - (SELECT total_liabilities FROM summary) - (SELECT total_equity FROM summary), 2),
      'inventory_ledger_value', (SELECT inventory_ledger_value FROM summary),
      'inventory_gl_value', (SELECT inventory_gl_value FROM summary),
      'inventory_reconciled', (SELECT inventory_reconciled FROM summary),
      'cash_gl_total', (SELECT cash_gl_total FROM summary)
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;
