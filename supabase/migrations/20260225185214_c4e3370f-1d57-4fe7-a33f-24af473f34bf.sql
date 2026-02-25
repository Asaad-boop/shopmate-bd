
-- Enhanced Cashflow Report RPC with account filtering, transfer exclusion, and drilldown
DROP FUNCTION IF EXISTS public.cashflow_report(date, date);

CREATE OR REPLACE FUNCTION public.cashflow_report(
  p_date_from date DEFAULT (date_trunc('month', now() AT TIME ZONE 'Asia/Dhaka'))::date,
  p_date_to date DEFAULT (now() AT TIME ZONE 'Asia/Dhaka')::date,
  p_account_codes text[] DEFAULT ARRAY['1100','1110','1120','1130'],
  p_include_transfers boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_cash_ids uuid[];
  v_all_cash_ids uuid[];
  v_opening numeric := 0;
  v_closing numeric := 0;
  v_inflows jsonb;
  v_outflows jsonb;
  v_daily jsonb;
  v_by_account jsonb;
  v_total_inflow numeric := 0;
  v_total_outflow numeric := 0;
BEGIN
  -- Resolve account IDs for selected codes
  SELECT array_agg(id) INTO v_cash_ids
  FROM chart_of_accounts WHERE code = ANY(p_account_codes);

  -- All cash-like account IDs (for transfer detection)
  SELECT array_agg(id) INTO v_all_cash_ids
  FROM chart_of_accounts WHERE code IN ('1100','1110','1120','1130');

  IF v_cash_ids IS NULL THEN
    RETURN jsonb_build_object('opening_balance', 0, 'closing_balance', 0,
      'inflows', '[]'::jsonb, 'outflows', '[]'::jsonb, 'daily_trend', '[]'::jsonb,
      'by_account', '[]'::jsonb, 'total_inflow', 0, 'total_outflow', 0,
      'net_change', 0, 'reconciled', true);
  END IF;

  -- Opening balance: sum of all debits - credits before period
  SELECT COALESCE(SUM(jl.debit - jl.credit), 0)
  INTO v_opening
  FROM journal_lines jl
  JOIN journal_entries je ON je.id = jl.journal_id
  WHERE je.status = 'posted'
    AND je.entry_date < p_date_from
    AND jl.account_id = ANY(v_cash_ids);

  -- Cash inflows (debits to cash accounts = money coming in)
  -- Grouped by the counter-party account type / reference_type
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.amount DESC), '[]'::jsonb),
         COALESCE(SUM(t.amount), 0)
  INTO v_inflows, v_total_inflow
  FROM (
    SELECT
      COALESCE(je.reference_type, 'other') AS ref_type,
      CASE je.reference_type
        WHEN 'courier' THEN 'Courier Settlements'
        WHEN 'order' THEN 'Customer Payments / Advances'
        WHEN 'capital' THEN 'Owner Capital Deposits'
        WHEN 'transfer' THEN 'Inter-Account Transfer In'
        WHEN 'settlement' THEN 'Courier Settlements'
        WHEN 'manual' THEN 'Manual Adjustments'
        ELSE COALESCE(INITCAP(je.reference_type), 'Other Income')
      END AS label,
      SUM(jl.debit) AS amount,
      COUNT(DISTINCT je.id) AS txn_count
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.journal_id
    WHERE je.status = 'posted'
      AND je.entry_date BETWEEN p_date_from AND p_date_to
      AND jl.account_id = ANY(v_cash_ids)
      AND jl.debit > 0
      AND (p_include_transfers OR NOT (
        -- Exclude transfers: journal where BOTH debit and credit sides hit cash accounts
        EXISTS (
          SELECT 1 FROM journal_lines jl2
          WHERE jl2.journal_id = je.id
            AND jl2.account_id = ANY(v_all_cash_ids)
            AND jl2.credit > 0
            AND jl2.id != jl.id
        )
      ))
    GROUP BY je.reference_type
    HAVING SUM(jl.debit) > 0
  ) t;

  -- Cash outflows (credits from cash accounts = money going out)
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.amount DESC), '[]'::jsonb),
         COALESCE(SUM(t.amount), 0)
  INTO v_outflows, v_total_outflow
  FROM (
    SELECT
      COALESCE(je.reference_type, 'other') AS ref_type,
      CASE je.reference_type
        WHEN 'purchase' THEN 'Supplier Payments'
        WHEN 'expense' THEN 'Operating Expenses'
        WHEN 'payroll' THEN 'HR Payroll'
        WHEN 'ads' THEN 'Meta Ads Spend'
        WHEN 'marketing' THEN 'Marketing / Influencer'
        WHEN 'transfer' THEN 'Inter-Account Transfer Out'
        WHEN 'manual' THEN 'Manual Adjustments'
        WHEN 'import' THEN 'Import Payments'
        WHEN 'withdrawal' THEN 'Owner Withdrawals'
        ELSE COALESCE(INITCAP(je.reference_type), 'Other Outflow')
      END AS label,
      SUM(jl.credit) AS amount,
      COUNT(DISTINCT je.id) AS txn_count
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.journal_id
    WHERE je.status = 'posted'
      AND je.entry_date BETWEEN p_date_from AND p_date_to
      AND jl.account_id = ANY(v_cash_ids)
      AND jl.credit > 0
      AND (p_include_transfers OR NOT (
        EXISTS (
          SELECT 1 FROM journal_lines jl2
          WHERE jl2.journal_id = je.id
            AND jl2.account_id = ANY(v_all_cash_ids)
            AND jl2.debit > 0
            AND jl2.id != jl.id
        )
      ))
    GROUP BY je.reference_type
    HAVING SUM(jl.credit) > 0
  ) t;

  -- Closing balance
  v_closing := v_opening + v_total_inflow - v_total_outflow;

  -- Daily trend
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.d), '[]'::jsonb)
  INTO v_daily
  FROM (
    SELECT
      d::date AS d,
      COALESCE(SUM(CASE WHEN jl.debit > 0 THEN jl.debit ELSE 0 END), 0) AS inflow,
      COALESCE(SUM(CASE WHEN jl.credit > 0 THEN jl.credit ELSE 0 END), 0) AS outflow,
      COALESCE(SUM(jl.debit - jl.credit), 0) AS net
    FROM generate_series(p_date_from, p_date_to, '1 day'::interval) d
    LEFT JOIN journal_entries je ON je.entry_date = d::date AND je.status = 'posted'
      AND (p_include_transfers OR je.reference_type IS DISTINCT FROM 'transfer')
    LEFT JOIN journal_lines jl ON jl.journal_id = je.id AND jl.account_id = ANY(v_cash_ids)
    GROUP BY d
  ) t;

  -- By account breakdown
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.code), '[]'::jsonb)
  INTO v_by_account
  FROM (
    SELECT
      ca.code,
      ca.name,
      COALESCE(SUM(CASE WHEN je.entry_date < p_date_from THEN jl.debit - jl.credit ELSE 0 END), 0) AS opening,
      COALESCE(SUM(CASE WHEN je.entry_date BETWEEN p_date_from AND p_date_to AND jl.debit > 0 THEN jl.debit ELSE 0 END), 0) AS period_inflow,
      COALESCE(SUM(CASE WHEN je.entry_date BETWEEN p_date_from AND p_date_to AND jl.credit > 0 THEN jl.credit ELSE 0 END), 0) AS period_outflow,
      COALESCE(SUM(CASE WHEN je.entry_date <= p_date_to THEN jl.debit - jl.credit ELSE 0 END), 0) AS closing
    FROM chart_of_accounts ca
    LEFT JOIN journal_lines jl ON jl.account_id = ca.id
    LEFT JOIN journal_entries je ON je.id = jl.journal_id AND je.status = 'posted'
    WHERE ca.id = ANY(v_cash_ids)
    GROUP BY ca.code, ca.name
  ) t;

  RETURN jsonb_build_object(
    'opening_balance', v_opening,
    'closing_balance', v_closing,
    'computed_closing', v_opening + v_total_inflow - v_total_outflow,
    'total_inflow', v_total_inflow,
    'total_outflow', v_total_outflow,
    'net_change', v_total_inflow - v_total_outflow,
    'reconciled', ABS(v_closing - (v_opening + v_total_inflow - v_total_outflow)) < 1,
    'inflows', v_inflows,
    'outflows', v_outflows,
    'daily_trend', v_daily,
    'by_account', v_by_account
  );
END;
$$;

-- Drilldown: journal lines affecting cash accounts for a given reference type
CREATE OR REPLACE FUNCTION public.cashflow_drilldown(
  p_ref_type text,
  p_direction text, -- 'inflow' or 'outflow'
  p_date_from date,
  p_date_to date,
  p_account_codes text[] DEFAULT ARRAY['1100','1110','1120','1130']
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_cash_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO v_cash_ids
  FROM chart_of_accounts WHERE code = ANY(p_account_codes);

  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.entry_date DESC), '[]'::jsonb)
    FROM (
      SELECT
        je.entry_date,
        je.reference_type,
        je.reference_id,
        je.description AS journal_desc,
        jl.description AS line_desc,
        CASE WHEN p_direction = 'inflow' THEN jl.debit ELSE jl.credit END AS amount,
        ca.code AS account_code,
        ca.name AS account_name
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl.journal_id
      JOIN chart_of_accounts ca ON ca.id = jl.account_id
      WHERE je.status = 'posted'
        AND je.entry_date BETWEEN p_date_from AND p_date_to
        AND jl.account_id = ANY(v_cash_ids)
        AND COALESCE(je.reference_type, 'other') = p_ref_type
        AND CASE WHEN p_direction = 'inflow' THEN jl.debit > 0 ELSE jl.credit > 0 END
      LIMIT 200
    ) t
  );
END;
$$;
