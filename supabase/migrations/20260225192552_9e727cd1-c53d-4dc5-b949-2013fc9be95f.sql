
-- ============================================================
-- courier_performance_report RPC
-- Returns one JSON object with: summary, couriers[], exceptions[]
-- ============================================================
CREATE OR REPLACE FUNCTION public.courier_performance_report(
  p_date_from text,
  p_date_to   text
)
RETURNS jsonb
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_result jsonb;
BEGIN
  WITH shipment_data AS (
    SELECT
      cs.courier_id,
      c.name AS courier_name,
      cs.id AS shipment_id,
      cs.order_id,
      cs.booking_status,
      cs.courier_delivery_fee,
      cs.courier_cod_fee,
      cs.courier_discount,
      cs.courier_promo_discount,
      cs.courier_additional_charge,
      cs.courier_compensation_cost,
      cs.courier_total_cost,
      cs.courier_net_payable,
      cs.courier_return_cost,
      cs.customer_total_amount,
      cs.delivered_at,
      cs.returned_at,
      cs.created_at
    FROM courier_shipments cs
    JOIN couriers c ON c.id = cs.courier_id
    WHERE cs.created_at >= (p_date_from || 'T00:00:00')::timestamptz
      AND cs.created_at <= (p_date_to   || 'T23:59:59')::timestamptz
  ),
  -- Settlement dates from journal entries
  settlement_dates AS (
    SELECT
      cs2.id AS shipment_id,
      MIN(je.entry_date) AS settlement_date
    FROM courier_shipments cs2
    JOIN courier_settlement_allocations csa ON csa.shipment_id = cs2.id
    JOIN courier_settlements_v2 csv ON csv.id = csa.settlement_id
    JOIN journal_entries je ON je.id = csv.journal_id AND je.status = 'posted'
    GROUP BY cs2.id
  ),
  per_courier AS (
    SELECT
      sd.courier_id,
      sd.courier_name,
      COUNT(*)::int AS shipped,
      COUNT(*) FILTER (WHERE sd.booking_status = 'delivered')::int AS delivered,
      COUNT(*) FILTER (WHERE sd.booking_status = 'returned')::int AS returned,
      COUNT(*) FILTER (WHERE sd.booking_status = 'partial_delivered')::int AS partial_delivered,
      
      -- Charges
      COALESCE(SUM(sd.courier_delivery_fee), 0)::numeric(14,2) AS total_delivery_fee,
      COALESCE(SUM(sd.courier_cod_fee), 0)::numeric(14,2)       AS total_cod_fee,
      COALESCE(SUM(sd.courier_discount), 0)::numeric(14,2)      AS total_discount,
      COALESCE(SUM(sd.courier_promo_discount), 0)::numeric(14,2) AS total_promo_discount,
      COALESCE(SUM(sd.courier_additional_charge), 0)::numeric(14,2) AS total_additional,
      COALESCE(SUM(sd.courier_compensation_cost), 0)::numeric(14,2) AS total_compensation,
      COALESCE(SUM(sd.courier_total_cost), 0)::numeric(14,2)    AS total_courier_cost,
      COALESCE(SUM(sd.courier_net_payable), 0)::numeric(14,2)   AS total_net_payable,
      COALESCE(SUM(sd.courier_return_cost), 0)::numeric(14,2)   AS total_return_cost,
      COALESCE(SUM(sd.customer_total_amount), 0)::numeric(14,2) AS total_revenue,
      
      -- Avg delivery charge (delivered only)
      ROUND(COALESCE(
        SUM(sd.courier_delivery_fee) FILTER (WHERE sd.booking_status = 'delivered') /
        NULLIF(COUNT(*) FILTER (WHERE sd.booking_status = 'delivered'), 0)
      , 0), 2)::numeric(14,2) AS avg_delivery_charge,
      
      -- Avg COD fee (delivered only)
      ROUND(COALESCE(
        SUM(sd.courier_cod_fee) FILTER (WHERE sd.booking_status = 'delivered') /
        NULLIF(COUNT(*) FILTER (WHERE sd.booking_status = 'delivered'), 0)
      , 0), 2)::numeric(14,2) AS avg_cod_fee,
      
      -- Settlement delay (avg days from delivered_at to settlement posted)
      ROUND(COALESCE(
        AVG(EXTRACT(EPOCH FROM (sdt.settlement_date - sd.delivered_at::date)) / 86400)
          FILTER (WHERE sd.booking_status = 'delivered' AND sdt.settlement_date IS NOT NULL)
      , 0), 1)::numeric(8,1) AS avg_settlement_delay_days,
      
      -- Unsettled delivered orders
      COUNT(*) FILTER (WHERE sd.booking_status = 'delivered' AND sdt.settlement_date IS NULL)::int AS unsettled_count

    FROM shipment_data sd
    LEFT JOIN settlement_dates sdt ON sdt.shipment_id = sd.id
    GROUP BY sd.courier_id, sd.courier_name
  ),
  -- Exceptions: delivered with zero cost
  exc_no_cost AS (
    SELECT sd.courier_name, sd.order_id, 'no_courier_cost' AS exc_type
    FROM shipment_data sd
    WHERE sd.booking_status = 'delivered'
      AND (sd.courier_total_cost IS NULL OR sd.courier_total_cost = 0)
  ),
  -- Exceptions: settlement delay > 7 days
  exc_slow_settle AS (
    SELECT sd.courier_name, sd.order_id, 'slow_settlement' AS exc_type
    FROM shipment_data sd
    LEFT JOIN settlement_dates sdt ON sdt.shipment_id = sd.id
    WHERE sd.booking_status = 'delivered'
      AND sdt.settlement_date IS NOT NULL
      AND (sdt.settlement_date - sd.delivered_at::date) > 7
  ),
  all_exceptions AS (
    SELECT * FROM exc_no_cost
    UNION ALL
    SELECT * FROM exc_slow_settle
  ),
  -- Summary totals
  totals AS (
    SELECT
      SUM(shipped)::int AS total_shipped,
      SUM(delivered)::int AS total_delivered,
      SUM(returned)::int AS total_returned,
      SUM(total_courier_cost)::numeric(14,2) AS grand_courier_cost,
      SUM(total_net_payable)::numeric(14,2) AS grand_net_payable,
      SUM(total_revenue)::numeric(14,2) AS grand_revenue,
      ROUND(SUM(total_courier_cost) / NULLIF(SUM(delivered), 0), 2)::numeric(14,2) AS avg_cost_per_order,
      ROUND(AVG(avg_settlement_delay_days), 1)::numeric(8,1) AS avg_settlement_delay,
      SUM(unsettled_count)::int AS total_unsettled
    FROM per_courier
  )
  SELECT jsonb_build_object(
    'summary', (SELECT row_to_json(t)::jsonb FROM totals t),
    'couriers', COALESCE((SELECT jsonb_agg(row_to_json(pc)::jsonb ORDER BY pc.shipped DESC) FROM per_courier pc), '[]'::jsonb),
    'exceptions', COALESCE((SELECT jsonb_agg(row_to_json(ae)::jsonb) FROM all_exceptions ae), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ============================================================
-- courier_performance_drilldown RPC
-- Returns shipment-level detail for a specific courier
-- ============================================================
CREATE OR REPLACE FUNCTION public.courier_performance_drilldown(
  p_courier_id text,
  p_date_from  text,
  p_date_to    text
)
RETURNS jsonb
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_result jsonb;
BEGIN
  WITH shipments AS (
    SELECT
      cs.id,
      cs.order_id,
      cs.tracking_id,
      cs.booking_status,
      cs.courier_delivery_fee,
      cs.courier_cod_fee,
      cs.courier_total_cost,
      cs.courier_net_payable,
      cs.customer_total_amount,
      cs.delivered_at,
      cs.returned_at,
      cs.created_at
    FROM courier_shipments cs
    WHERE cs.courier_id = p_courier_id::uuid
      AND cs.created_at >= (p_date_from || 'T00:00:00')::timestamptz
      AND cs.created_at <= (p_date_to   || 'T23:59:59')::timestamptz
    ORDER BY cs.created_at DESC
    LIMIT 200
  ),
  -- Top SKUs shipped via this courier
  top_skus AS (
    SELECT
      p.sku,
      p.name AS product_name,
      COUNT(DISTINCT s.order_id)::int AS order_count,
      SUM(oi.quantity)::int AS units
    FROM shipments s
    JOIN order_items oi ON oi.order_id = s.order_id
    JOIN products p ON p.id = oi.product_id
    GROUP BY p.sku, p.name
    ORDER BY units DESC
    LIMIT 10
  ),
  -- Settlement batches
  batches AS (
    SELECT DISTINCT
      csv.id,
      csv.settlement_ref,
      csv.settlement_date,
      csv.amount_received,
      je.status AS journal_status
    FROM shipments s
    JOIN courier_settlement_allocations csa ON csa.shipment_id = s.id
    JOIN courier_settlements_v2 csv ON csv.id = csa.settlement_id
    LEFT JOIN journal_entries je ON je.id = csv.journal_id
    ORDER BY csv.settlement_date DESC
    LIMIT 20
  )
  SELECT jsonb_build_object(
    'orders', COALESCE((SELECT jsonb_agg(row_to_json(s)::jsonb) FROM shipments s), '[]'::jsonb),
    'top_skus', COALESCE((SELECT jsonb_agg(row_to_json(ts)::jsonb) FROM top_skus ts), '[]'::jsonb),
    'settlements', COALESCE((SELECT jsonb_agg(row_to_json(b)::jsonb) FROM batches b), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;
