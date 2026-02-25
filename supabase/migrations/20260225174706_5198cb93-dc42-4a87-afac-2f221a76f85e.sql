
-- RPC: general_ledger_lines - paginated ledger with running balance
CREATE OR REPLACE FUNCTION public.general_ledger_lines(
  p_account_id uuid DEFAULT NULL,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 100
)
RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  result json;
  q_like text;
BEGIN
  IF p_search IS NOT NULL AND trim(p_search) != '' THEN
    q_like := '%' || trim(p_search) || '%';
  END IF;

  SELECT json_build_object(
    'total', (
      SELECT count(*)
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl.journal_id
      WHERE (p_account_id IS NULL OR jl.account_id = p_account_id)
        AND je.status IN ('posted', 'reversed')
        AND (p_date_from IS NULL OR je.entry_date >= p_date_from)
        AND (p_date_to IS NULL OR je.entry_date <= p_date_to)
        AND (q_like IS NULL
             OR je.description ILIKE q_like
             OR je.reference_id::text ILIKE q_like
             OR jl.description ILIKE q_like)
    ),
    'rows', COALESCE((
      SELECT json_agg(row_to_json(r))
      FROM (
        SELECT
          jl.id as line_id,
          jl.journal_id,
          je.entry_date,
          je.description as journal_description,
          je.reference_type,
          je.reference_id,
          je.status as journal_status,
          je.is_auto,
          je.reversal_of_id,
          je.reversed_by_id,
          je.period_key,
          jl.account_id,
          coa.code as account_code,
          coa.name as account_name,
          jl.debit,
          jl.credit,
          jl.description as line_description,
          -- running balance (sum of all debits - credits up to and including this line for this account)
          sum(jl.debit - jl.credit) OVER (
            PARTITION BY jl.account_id
            ORDER BY je.entry_date, je.created_at, jl.id
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
          ) as running_balance
        FROM journal_lines jl
        JOIN journal_entries je ON je.id = jl.journal_id
        JOIN chart_of_accounts coa ON coa.id = jl.account_id
        WHERE (p_account_id IS NULL OR jl.account_id = p_account_id)
          AND je.status IN ('posted', 'reversed')
          AND (p_date_from IS NULL OR je.entry_date >= p_date_from)
          AND (p_date_to IS NULL OR je.entry_date <= p_date_to)
          AND (q_like IS NULL
               OR je.description ILIKE q_like
               OR je.reference_id::text ILIKE q_like
               OR jl.description ILIKE q_like)
        ORDER BY je.entry_date DESC, je.created_at DESC, jl.id DESC
        OFFSET p_offset LIMIT p_limit
      ) r
    ), '[]'::json)
  ) INTO result;
  RETURN result;
END;
$function$;

-- RPC: journal_entry_detail - full journal with all lines
CREATE OR REPLACE FUNCTION public.journal_entry_detail(p_journal_id uuid)
RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE result json;
BEGIN
  SELECT row_to_json(j) INTO result
  FROM (
    SELECT
      je.id, je.entry_date, je.description, je.reference_type, je.reference_id,
      je.status, je.is_auto, je.period_key, je.posted_at, je.created_at,
      je.reversal_of_id, je.reversed_by_id,
      (
        SELECT json_agg(row_to_json(l) ORDER BY l.id)
        FROM (
          SELECT jl.id, jl.account_id, coa.code, coa.name as account_name,
                 jl.debit, jl.credit, jl.description
          FROM journal_lines jl
          JOIN chart_of_accounts coa ON coa.id = jl.account_id
          WHERE jl.journal_id = je.id
        ) l
      ) as lines,
      (SELECT count(*) FROM journal_lines WHERE journal_id = je.id)::int as line_count,
      (SELECT COALESCE(sum(debit), 0) FROM journal_lines WHERE journal_id = je.id)::numeric as total_debit,
      (SELECT COALESCE(sum(credit), 0) FROM journal_lines WHERE journal_id = je.id)::numeric as total_credit
    FROM journal_entries je
    WHERE je.id = p_journal_id
  ) j;
  RETURN result;
END;
$function$;
