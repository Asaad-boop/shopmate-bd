
-- Procurement dashboard RPC for server-side aggregation
CREATE OR REPLACE FUNCTION public.procurement_dashboard_report(p_month_start date DEFAULT date_trunc('month', CURRENT_DATE)::date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  v_month_end date := (p_month_start + interval '1 month' - interval '1 day')::date;
BEGIN
  WITH
  -- PO counts by status
  po_stats AS (
    SELECT
      count(*) FILTER (WHERE status NOT IN ('closed','cancelled')) AS open_pos,
      count(*) FILTER (WHERE status IN ('shipped','in_transit')) AS in_transit,
      count(*) FILTER (WHERE status = 'received' AND actual_arrival_date >= p_month_start AND actual_arrival_date <= v_month_end) AS received_this_month,
      count(*) AS total_pos
    FROM purchase_orders
  ),
  -- PO pipeline breakdown
  po_pipeline AS (
    SELECT
      count(*) FILTER (WHERE status = 'draft') AS draft,
      count(*) FILTER (WHERE status = 'confirmed') AS confirmed,
      count(*) FILTER (WHERE status = 'production') AS production,
      count(*) FILTER (WHERE status IN ('shipped','in_transit')) AS in_transit,
      count(*) FILTER (WHERE status = 'received') AS received,
      count(*) FILTER (WHERE status = 'closed') AS closed
    FROM purchase_orders
  ),
  -- Supplier payables from posted GRNs minus posted payments
  payable_summary AS (
    SELECT
      COALESCE(SUM(g.total_product_cost), 0) AS total_grn_value,
      COALESCE((
        SELECT SUM(spa.allocated_amount)
        FROM supplier_payment_allocations spa
        JOIN supplier_payments sp ON sp.id = spa.payment_id
        WHERE sp.status = 'posted'
      ), 0) AS total_paid,
      count(*) FILTER (
        WHERE g.receipt_date < CURRENT_DATE - interval '30 days'
      ) AS overdue_count
    FROM goods_receipts g
    WHERE g.status = 'posted'
  ),
  -- GRNs received this month
  recent_grns AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', g.id,
        'grn_number', g.grn_number,
        'supplier_name', s.name,
        'receipt_date', g.receipt_date,
        'total_cost', g.total_product_cost,
        'status', g.status,
        'item_count', (SELECT count(*) FROM goods_receipt_items gi WHERE gi.grn_id = g.id)
      ) ORDER BY g.receipt_date DESC
    ) AS grns
    FROM goods_receipts g
    LEFT JOIN suppliers s ON s.id = g.supplier_id
    WHERE g.receipt_date >= p_month_start AND g.receipt_date <= v_month_end
    LIMIT 20
  ),
  -- Inventory value added this month (from inventory_ledger stock_in)
  inv_value_added AS (
    SELECT
      COALESCE(SUM(il.qty_in * il.unit_cost), 0) AS value_added,
      CASE WHEN SUM(il.qty_in) > 0
        THEN ROUND(SUM(il.qty_in * il.unit_cost) / SUM(il.qty_in), 2)
        ELSE 0
      END AS avg_cost_per_unit
    FROM inventory_ledger il
    WHERE il.txn_type = 'stock_in'
      AND il.created_at >= p_month_start::timestamptz
      AND il.created_at < (v_month_end + 1)::timestamptz
  ),
  -- Import cost summary from landed_costs
  import_costs AS (
    SELECT
      COALESCE(SUM(CASE WHEN lc.cost_type = 'freight' THEN lc.amount ELSE 0 END), 0) AS freight,
      COALESCE(SUM(CASE WHEN lc.cost_type = 'customs' THEN lc.amount ELSE 0 END), 0) AS customs,
      COALESCE(SUM(CASE WHEN lc.cost_type = 'agent_fee' THEN lc.amount ELSE 0 END), 0) AS agent_fees,
      COALESCE(SUM(CASE WHEN lc.cost_type = 'cnf' THEN lc.amount ELSE 0 END), 0) AS cnf,
      COALESCE(SUM(CASE WHEN lc.cost_type = 'transport' THEN lc.amount ELSE 0 END), 0) AS transport,
      COALESCE(SUM(CASE WHEN lc.cost_type NOT IN ('freight','customs','agent_fee','cnf','transport') THEN lc.amount ELSE 0 END), 0) AS other,
      COALESCE(SUM(lc.amount), 0) AS total_landed
    FROM landed_costs lc
    WHERE lc.cost_date >= p_month_start AND lc.cost_date <= v_month_end
  ),
  -- Landed cost per shipment (POs with landed costs)
  shipment_costs AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'po_id', po.id,
        'po_number', po.po_number,
        'supplier', s.name,
        'product_cost', po.total_landed_cost_bdt,
        'freight', COALESCE(po.freight_cost_bdt, 0),
        'customs', COALESCE(po.customs_duty_bdt, 0),
        'cnf', COALESCE(po.c_and_f_charge_bdt, 0),
        'transport', COALESCE(po.local_transport_bdt, 0),
        'other', COALESCE(po.other_charges_bdt, 0),
        'grand_total', COALESCE(po.grand_total_bdt, 0),
        'status', po.status
      ) ORDER BY po.created_at DESC
    ) AS shipments
    FROM purchase_orders po
    LEFT JOIN suppliers s ON s.id = po.supplier_id
    WHERE po.status NOT IN ('cancelled')
    LIMIT 20
  ),
  -- Avg cost trend (last 6 months)
  cost_trend AS (
    SELECT jsonb_agg(
      jsonb_build_object('month', m.month_key, 'avg_cost', m.avg_cost)
      ORDER BY m.month_key
    ) AS trend
    FROM (
      SELECT
        to_char(il.created_at, 'YYYY-MM') AS month_key,
        CASE WHEN SUM(il.qty_in) > 0
          THEN ROUND(SUM(il.qty_in * il.unit_cost) / SUM(il.qty_in), 2)
          ELSE 0
        END AS avg_cost
      FROM inventory_ledger il
      WHERE il.txn_type = 'stock_in'
        AND il.created_at >= (CURRENT_DATE - interval '6 months')
      GROUP BY to_char(il.created_at, 'YYYY-MM')
    ) m
  )
  SELECT jsonb_build_object(
    'kpi', jsonb_build_object(
      'open_pos', (SELECT open_pos FROM po_stats),
      'in_transit', (SELECT in_transit FROM po_stats),
      'received_this_month', (SELECT received_this_month FROM po_stats),
      'total_supplier_payable', (SELECT GREATEST(total_grn_value - total_paid, 0) FROM payable_summary),
      'overdue_payable_count', (SELECT overdue_count FROM payable_summary),
      'inventory_value_added', (SELECT value_added FROM inv_value_added),
      'avg_cost_per_unit', (SELECT avg_cost_per_unit FROM inv_value_added)
    ),
    'pipeline', (SELECT row_to_json(po_pipeline.*) FROM po_pipeline),
    'recent_grns', COALESCE((SELECT grns FROM recent_grns), '[]'::jsonb),
    'import_costs', (SELECT row_to_json(import_costs.*) FROM import_costs),
    'shipment_costs', COALESCE((SELECT shipments FROM shipment_costs), '[]'::jsonb),
    'cost_trend', COALESCE((SELECT trend FROM cost_trend), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;
