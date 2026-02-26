
-- Update finance_account_balances to show all liquid asset sub-accounts (children of 1100 + 1102 + 1103 + any new ones)
-- Instead of hardcoded codes, show all active asset accounts that are "liquid" (children of 1100 or direct wallet codes)
CREATE OR REPLACE FUNCTION public.finance_account_balances()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result json;
  today date := (now() AT TIME ZONE 'Asia/Dhaka')::date;
  week_ago date := today - 7;
  parent_id uuid;
BEGIN
  -- Get the parent "Cash & Bank" account id
  SELECT id INTO parent_id FROM chart_of_accounts WHERE code = '1100';

  SELECT json_agg(row_to_json(a) ORDER BY a.code) INTO result
  FROM (
    SELECT
      coa.id,
      coa.code,
      coa.name,
      coa.account_type,
      coa.description,
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
    WHERE coa.is_active = true
      AND (
        coa.code IN ('1100', '1101', '1102', '1103')
        OR coa.parent_id = parent_id
      )
      AND coa.code != '1100' -- exclude the parent group itself
    GROUP BY coa.id, coa.code, coa.name, coa.account_type, coa.description
  ) a;
  RETURN COALESCE(result, '[]'::json);
END;
$function$;

-- Create a function to add a new cash/wallet account with optional opening balance
CREATE OR REPLACE FUNCTION public.finance_create_account(
  p_name text,
  p_account_type text,  -- cash, bank, bkash, nagad, other_wallet
  p_account_number text DEFAULT NULL,
  p_owner_name text DEFAULT NULL,
  p_account_nature text DEFAULT 'business',
  p_opening_balance numeric DEFAULT 0,
  p_opening_date date DEFAULT CURRENT_DATE,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_id uuid;
  new_code text;
  parent_id uuid;
  max_code text;
  next_num int;
  ledger_class text;
  acct_equity uuid;
  je_id uuid;
BEGIN
  -- Validate required fields
  IF p_name IS NULL OR trim(p_name) = '' THEN RAISE EXCEPTION 'Account name is required'; END IF;
  IF p_account_type IS NULL OR trim(p_account_type) = '' THEN RAISE EXCEPTION 'Account type is required'; END IF;
  IF p_account_number IS NULL OR trim(p_account_number) = '' THEN RAISE EXCEPTION 'Account number is required'; END IF;
  IF p_opening_balance < 0 THEN RAISE EXCEPTION 'Opening balance must be >= 0'; END IF;

  -- Check uniqueness: same type + account_number
  IF EXISTS (
    SELECT 1 FROM chart_of_accounts 
    WHERE description LIKE '%"acct_type":"' || p_account_type || '"%'
      AND description LIKE '%"acct_number":"' || p_account_number || '"%'
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'An account with this type and number already exists';
  END IF;

  -- Get parent account
  SELECT id INTO parent_id FROM chart_of_accounts WHERE code = '1100';
  IF parent_id IS NULL THEN RAISE EXCEPTION 'Parent Cash & Bank account (1100) not found'; END IF;

  -- Generate next code: find max code among children of 1100
  SELECT MAX(code) INTO max_code FROM chart_of_accounts WHERE chart_of_accounts.parent_id = finance_create_account.parent_id;
  IF max_code IS NULL THEN
    next_num := 1104;
  ELSE
    next_num := CAST(max_code AS int) + 1;
  END IF;
  new_code := LPAD(next_num::text, 4, '0');

  -- Determine ledger classification
  CASE p_account_type
    WHEN 'cash' THEN ledger_class := 'Cash Asset';
    WHEN 'bank' THEN ledger_class := 'Bank Asset';
    WHEN 'bkash' THEN ledger_class := 'Mobile Banking Asset';
    WHEN 'nagad' THEN ledger_class := 'Mobile Banking Asset';
    ELSE ledger_class := 'Digital Asset';
  END CASE;

  -- Build description JSON with metadata
  INSERT INTO chart_of_accounts (code, name, account_type, normal_balance, parent_id, is_system, description)
  VALUES (
    new_code, p_name, 'asset', 'debit', parent_id, false,
    json_build_object(
      'acct_type', p_account_type,
      'acct_number', p_account_number,
      'owner_name', COALESCE(p_owner_name, ''),
      'account_nature', p_account_nature,
      'ledger_classification', ledger_class,
      'notes', COALESCE(p_notes, '')
    )::text
  )
  RETURNING id INTO new_id;

  -- If opening balance > 0, create opening journal entry (Dr Account, Cr Opening Balance Equity)
  IF p_opening_balance > 0 THEN
    SELECT id INTO acct_equity FROM chart_of_accounts WHERE code = '3100' AND is_active = true;
    IF acct_equity IS NULL THEN
      INSERT INTO chart_of_accounts (code, name, account_type, normal_balance, is_system)
      VALUES ('3100', 'Owner Equity / Capital', 'equity', 'credit', true)
      RETURNING id INTO acct_equity;
    END IF;

    INSERT INTO journal_entries (entry_date, description, reference_type, status, is_auto)
    VALUES (p_opening_date, 'Opening Balance: ' || p_name, 'opening_balance', 'posted', true)
    RETURNING id INTO je_id;

    INSERT INTO journal_lines (journal_id, account_id, debit, credit, description) VALUES
      (je_id, new_id, p_opening_balance, 0, 'Opening balance for ' || p_name),
      (je_id, acct_equity, 0, p_opening_balance, 'Opening Balance Equity');
  END IF;

  RETURN new_id;
END;
$function$;
