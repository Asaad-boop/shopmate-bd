
-- ══════════════════════════════════════════════════════════
-- Inventory Valuation Report RPC
-- Uses inventory_ledger for stock quantities and WAC
-- Reconciles with GL Inventory Asset account
-- ══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.inventory_valuation_report(
  p_as_of_date date DEFAULT (now() AT TIME ZONE 'Asia/Dhaka')::date,
  p_include_zero_stock boolean DEFAULT false,
  p_active_only boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
  v_gl_inventory_value numeric;
BEGIN
  -- Get GL inventory asset balance for reconciliation
  SELECT COALESCE(SUM(
    CASE WHEN ca.normal_balance = 'debit' THEN jl.debit - jl.credit ELSE jl.credit - jl.debit END
  ), 0)
  INTO v_gl_inventory_value
  FROM journal_lines jl
  JOIN journal_entries je ON je.id = jl.journal_id
  JOIN chart_of_accounts ca ON ca.id = jl.account_id
  WHERE je.status = 'posted'
    AND je.entry_date <= p_as_of_date
    AND ca.code LIKE '1300%'; -- Inventory asset accounts

  WITH stock_summary AS (
    SELECT
      il.product_id,
      SUM(il.qty_in) - SUM(il.qty_out) AS on_hand,
      -- Reserved = items in pending/packed orders (approximate from ledger)
      COALESCE(p.reserved_quantity, 0) AS reserved,
      -- Last running_avg_cost from the most recent ledger entry
      (
        SELECT il2.running_avg_cost
        FROM inventory_ledger il2
        WHERE il2.product_id = il.product_id
          AND il2.txn_date <= (p_as_of_date + 1)::timestamp
          AND il2.running_avg_cost IS NOT NULL
          AND il2.running_avg_cost > 0
        ORDER BY il2.txn_date DESC, il2.created_at DESC
        LIMIT 1
      ) AS avg_cost,
      -- Fallback to product avg_cost or landed_cost
      COALESCE(p.avg_cost, p.landed_cost_bdt) AS fallback_cost,
      -- Last stock in date
      MAX(CASE WHEN il.qty_in > 0 THEN il.txn_date END) AS last_stock_in,
      -- Last stock out date
      MAX(CASE WHEN il.qty_out > 0 THEN il.txn_date END) AS last_stock_out,
      -- Last movement of any kind
      MAX(il.txn_date) AS last_movement,
      -- Product details
      p.name,
      p.sku,
      p.image_url,
      p.category_id,
      p.status AS product_status,
      p.reorder_point,
      p.reorder_quantity,
      p.selling_price
    FROM inventory_ledger il
    JOIN products p ON p.id = il.product_id
    WHERE il.txn_date <= (p_as_of_date + 1)::timestamp
    GROUP BY il.product_id, p.id
  ),
  enriched AS (
    SELECT
      ss.*,
      (SELECT c.name FROM categories c WHERE c.id = ss.category_id LIMIT 1) AS category_name,
      COALESCE(ss.avg_cost, ss.fallback_cost, 0) AS effective_cost,
      ss.on_hand - ss.reserved AS available,
      -- Days since last movement
      CASE WHEN ss.last_movement IS NOT NULL
        THEN EXTRACT(DAY FROM (p_as_of_date::timestamp - ss.last_movement))::int
        ELSE NULL
      END AS days_since_movement
    FROM stock_summary ss
    WHERE (NOT p_active_only OR ss.product_status = 'active')
      AND (p_include_zero_stock OR ss.on_hand != 0)
  ),
  -- Exception detection
  negative_stock AS (
    SELECT COUNT(*) AS cnt FROM enriched WHERE on_hand < 0
  ),
  missing_cost AS (
    SELECT COUNT(*) AS cnt FROM enriched WHERE effective_cost = 0 AND on_hand > 0
  ),
  dead_stock AS (
    SELECT COUNT(*) AS cnt FROM enriched WHERE days_since_movement > 90 AND on_hand > 0
  ),
  low_stock AS (
    SELECT COUNT(*) AS cnt FROM enriched WHERE reorder_point IS NOT NULL AND on_hand <= reorder_point AND on_hand > 0
  )
  SELECT jsonb_build_object(
    'skus', COALESCE((
      SELECT jsonb_agg(row_to_json(t)::jsonb ORDER BY t.stock_value DESC)
      FROM (
        SELECT
          e.product_id,
          e.name,
          e.sku,
          e.image_url,
          e.category_name,
          e.product_status,
          e.on_hand::int,
          e.reserved::int,
          e.available::int,
          ROUND(e.effective_cost, 2) AS avg_cost,
          ROUND(e.on_hand * e.effective_cost, 2) AS stock_value,
          e.last_stock_in,
          e.last_stock_out,
          e.last_movement,
          e.days_since_movement,
          e.reorder_point,
          e.reorder_quantity,
          ROUND(e.selling_price, 2) AS selling_price,
          -- Flags
          e.on_hand < 0 AS is_negative,
          e.effective_cost = 0 AND e.on_hand > 0 AS is_missing_cost,
          e.days_since_movement > 90 AND e.on_hand > 0 AS is_dead_stock,
          e.reorder_point IS NOT NULL AND e.on_hand <= e.reorder_point AND e.on_hand > 0 AS is_low_stock,
          -- Suggested reorder
          CASE WHEN e.reorder_point IS NOT NULL AND e.on_hand <= e.reorder_point
            THEN GREATEST(COALESCE(e.reorder_quantity, e.reorder_point * 2) - e.on_hand, 0)::int
            ELSE NULL
          END AS suggested_reorder_qty
        FROM enriched e
      ) t
    ), '[]'::jsonb),
    'summary', jsonb_build_object(
      'total_units', COALESCE((SELECT SUM(on_hand)::int FROM enriched WHERE on_hand > 0), 0),
      'total_value', COALESCE((SELECT ROUND(SUM(on_hand * effective_cost), 2) FROM enriched WHERE on_hand > 0), 0),
      'total_skus', (SELECT COUNT(*) FROM enriched),
      'low_stock_count', (SELECT cnt FROM low_stock),
      'negative_stock_count', (SELECT cnt FROM negative_stock),
      'dead_stock_count', (SELECT cnt FROM dead_stock),
      'missing_cost_count', (SELECT cnt FROM missing_cost)
    ),
    'reconciliation', jsonb_build_object(
      'ledger_stock_value', COALESCE((SELECT ROUND(SUM(on_hand * effective_cost), 2) FROM enriched), 0),
      'gl_inventory_value', ROUND(v_gl_inventory_value, 2),
      'variance', ROUND(
        COALESCE((SELECT SUM(on_hand * effective_cost) FROM enriched), 0) - v_gl_inventory_value, 2
      ),
      'is_reconciled', ABS(
        COALESCE((SELECT SUM(on_hand * effective_cost) FROM enriched), 0) - v_gl_inventory_value
      ) < 1
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ══════════════════════════════════════════════════════════
-- Stock Ledger Drilldown for a specific product
-- ══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.inventory_ledger_drilldown(
  p_product_id uuid,
  p_as_of_date date DEFAULT (now() AT TIME ZONE 'Asia/Dhaka')::date
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(t)::jsonb ORDER BY t.txn_date DESC, t.created_at DESC)
    FROM (
      SELECT
        il.id,
        il.txn_date,
        il.created_at,
        il.txn_type,
        il.qty_in,
        il.qty_out,
        il.unit_cost,
        il.running_avg_cost,
        il.reference_type,
        il.reference_id,
        il.note,
        il.sku,
        -- Running balance (cumulative)
        SUM(il.qty_in - il.qty_out) OVER (
          ORDER BY il.txn_date, il.created_at
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS running_balance
      FROM inventory_ledger il
      WHERE il.product_id = p_product_id
        AND il.txn_date <= (p_as_of_date + 1)::timestamp
      ORDER BY il.txn_date DESC, il.created_at DESC
      LIMIT 200
    ) t
  ), '[]'::jsonb);
END;
$$;
