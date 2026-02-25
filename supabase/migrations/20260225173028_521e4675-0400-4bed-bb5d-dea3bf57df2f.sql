
-- Get liquid account balances with today's change and 7-day summary
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
  SELECT json_agg(row_to_json(a)) INTO result
  FROM (
    SELECT
      coa.id,
      coa.code,
      coa.name,
      coa.account_type,
      -- Current balance = sum(debit) - sum(credit) for asset accounts
      COALESCE(SUM(CASE WHEN jl.debit > 0 THEN jl.debit ELSE 0 END) - SUM(CASE WHEN jl.credit > 0 THEN jl.credit ELSE 0 END), 0) AS balance,
      -- Today's change
      COALESCE(SUM(CASE WHEN je.entry_date = today AND jl.debit > 0 THEN jl.debit ELSE 0 END)
             - SUM(CASE WHEN je.entry_date = today AND jl.credit > 0 THEN jl.credit ELSE 0 END), 0) AS today_change,
      -- 7-day inflow
      COALESCE(SUM(CASE WHEN je.entry_date >= week_ago AND jl.debit > 0 THEN jl.debit ELSE 0 END), 0) AS week_inflow,
      -- 7-day outflow
      COALESCE(SUM(CASE WHEN je.entry_date >= week_ago AND jl.credit > 0 THEN jl.credit ELSE 0 END), 0) AS week_outflow
    FROM chart_of_accounts coa
    LEFT JOIN journal_lines jl ON jl.account_id = coa.id
    LEFT JOIN journal_entries je ON je.id = jl.journal_id AND je.status = 'posted'
    WHERE coa.code IN ('1100', '1101', '1102', '1103')
      AND coa.is_active = true
    GROUP BY coa.id, coa.code, coa.name, coa.account_type
    ORDER BY coa.code
  ) a;
  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Get recent transactions for a specific account
CREATE OR REPLACE FUNCTION public.finance_account_transactions(p_account_id uuid, p_limit int DEFAULT 20)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_agg(row_to_json(t)) INTO result
  FROM (
    SELECT
      jl.id,
      je.entry_date,
      je.description,
      je.reference_type,
      je.reference_id,
      je.is_auto,
      jl.debit,
      jl.credit,
      jl.description AS line_description,
      je.created_at
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.journal_id
    WHERE jl.account_id = p_account_id
      AND je.status = 'posted'
    ORDER BY je.entry_date DESC, je.created_at DESC
    LIMIT p_limit
  ) t;
  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Create a transfer journal between two accounts
CREATE OR REPLACE FUNCTION public.finance_transfer(
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_amount numeric,
  p_note text,
  p_entry_date date DEFAULT CURRENT_DATE
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  je_id uuid;
  from_name text;
  to_name text;
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF p_from_account_id = p_to_account_id THEN RAISE EXCEPTION 'Cannot transfer to same account'; END IF;
  IF p_note IS NULL OR trim(p_note) = '' THEN RAISE EXCEPTION 'Transfer note is required'; END IF;

  SELECT name INTO from_name FROM chart_of_accounts WHERE id = p_from_account_id;
  SELECT name INTO to_name FROM chart_of_accounts WHERE id = p_to_account_id;

  INSERT INTO journal_entries (entry_date, description, reference_type, status, is_auto)
  VALUES (p_entry_date, 'Transfer: ' || from_name || ' → ' || to_name || ' | ' || p_note, 'transfer', 'posted', false)
  RETURNING id INTO je_id;

  INSERT INTO journal_lines (journal_id, account_id, debit, credit, description) VALUES
    (je_id, p_to_account_id, p_amount, 0, 'Transfer in from ' || from_name),
    (je_id, p_from_account_id, 0, p_amount, 'Transfer out to ' || to_name);

  RETURN je_id;
END;
$$;

-- Deposit (owner capital injection)
CREATE OR REPLACE FUNCTION public.finance_deposit(
  p_account_id uuid,
  p_amount numeric,
  p_note text,
  p_entry_date date DEFAULT CURRENT_DATE
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  je_id uuid;
  acct_name text;
  acct_equity uuid;
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF p_note IS NULL OR trim(p_note) = '' THEN RAISE EXCEPTION 'Note is required'; END IF;

  SELECT name INTO acct_name FROM chart_of_accounts WHERE id = p_account_id;
  
  -- Use owner equity account (3100) or create fallback
  SELECT id INTO acct_equity FROM chart_of_accounts WHERE code = '3100' AND is_active = true;
  IF acct_equity IS NULL THEN
    INSERT INTO chart_of_accounts (code, name, account_type, normal_balance, is_system)
    VALUES ('3100', 'Owner Equity / Capital', 'equity', 'credit', true)
    RETURNING id INTO acct_equity;
  END IF;

  INSERT INTO journal_entries (entry_date, description, reference_type, status, is_auto)
  VALUES (p_entry_date, 'Capital Deposit: ' || acct_name || ' | ' || p_note, 'deposit', 'posted', false)
  RETURNING id INTO je_id;

  INSERT INTO journal_lines (journal_id, account_id, debit, credit, description) VALUES
    (je_id, p_account_id, p_amount, 0, 'Deposit received'),
    (je_id, acct_equity, 0, p_amount, 'Owner capital / funding');

  RETURN je_id;
END;
$$;

-- Withdraw (owner drawing)
CREATE OR REPLACE FUNCTION public.finance_withdraw(
  p_account_id uuid,
  p_amount numeric,
  p_note text,
  p_entry_date date DEFAULT CURRENT_DATE
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  je_id uuid;
  acct_name text;
  acct_drawing uuid;
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF p_note IS NULL OR trim(p_note) = '' THEN RAISE EXCEPTION 'Note is required'; END IF;

  SELECT name INTO acct_name FROM chart_of_accounts WHERE id = p_account_id;

  -- Use owner drawing account (3200)
  SELECT id INTO acct_drawing FROM chart_of_accounts WHERE code = '3200' AND is_active = true;
  IF acct_drawing IS NULL THEN
    INSERT INTO chart_of_accounts (code, name, account_type, normal_balance, is_system)
    VALUES ('3200', 'Owner Drawing', 'equity', 'debit', true)
    RETURNING id INTO acct_drawing;
  END IF;

  INSERT INTO journal_entries (entry_date, description, reference_type, status, is_auto)
  VALUES (p_entry_date, 'Withdrawal: ' || acct_name || ' | ' || p_note, 'withdrawal', 'posted', false)
  RETURNING id INTO je_id;

  INSERT INTO journal_lines (journal_id, account_id, debit, credit, description) VALUES
    (je_id, acct_drawing, p_amount, 0, 'Owner drawing'),
    (je_id, p_account_id, 0, p_amount, 'Withdrawal from ' || acct_name);

  RETURN je_id;
END;
$$;

-- Adjust opening balance (creates adjustment journal)
CREATE OR REPLACE FUNCTION public.finance_adjust_opening(
  p_account_id uuid,
  p_new_balance numeric,
  p_note text,
  p_entry_date date DEFAULT CURRENT_DATE
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  je_id uuid;
  acct_name text;
  current_bal numeric;
  diff numeric;
  acct_equity uuid;
BEGIN
  IF p_note IS NULL OR trim(p_note) = '' THEN RAISE EXCEPTION 'Reason is required for opening balance adjustment'; END IF;

  SELECT name INTO acct_name FROM chart_of_accounts WHERE id = p_account_id;

  -- Calculate current balance
  SELECT COALESCE(SUM(CASE WHEN jl.debit > 0 THEN jl.debit ELSE 0 END) - SUM(CASE WHEN jl.credit > 0 THEN jl.credit ELSE 0 END), 0)
  INTO current_bal
  FROM journal_lines jl
  JOIN journal_entries je ON je.id = jl.journal_id
  WHERE jl.account_id = p_account_id AND je.status = 'posted';

  diff := p_new_balance - current_bal;
  IF diff = 0 THEN RAISE EXCEPTION 'Balance already matches target'; END IF;

  SELECT id INTO acct_equity FROM chart_of_accounts WHERE code = '3100' AND is_active = true;
  IF acct_equity IS NULL THEN
    INSERT INTO chart_of_accounts (code, name, account_type, normal_balance, is_system)
    VALUES ('3100', 'Owner Equity / Capital', 'equity', 'credit', true)
    RETURNING id INTO acct_equity;
  END IF;

  INSERT INTO journal_entries (entry_date, description, reference_type, status, is_auto)
  VALUES (p_entry_date, 'Opening Balance Adjustment: ' || acct_name || ' | ' || p_note, 'adjustment', 'posted', false)
  RETURNING id INTO je_id;

  IF diff > 0 THEN
    INSERT INTO journal_lines (journal_id, account_id, debit, credit, description) VALUES
      (je_id, p_account_id, diff, 0, 'Balance adjustment (+)'),
      (je_id, acct_equity, 0, diff, 'Equity adjustment');
  ELSE
    INSERT INTO journal_lines (journal_id, account_id, debit, credit, description) VALUES
      (je_id, p_account_id, 0, ABS(diff), 'Balance adjustment (-)'),
      (je_id, acct_equity, ABS(diff), 0, 'Equity adjustment');
  END IF;

  RETURN je_id;
END;
$$;
