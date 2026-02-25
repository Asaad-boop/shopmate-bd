
DROP FUNCTION IF EXISTS public.sku_order_drilldown(uuid, date, date);

CREATE OR REPLACE FUNCTION public.sku_order_drilldown(
  p_product_id uuid,
  p_date_from  date DEFAULT (date_trunc('month', now() AT TIME ZONE 'Asia/Dhaka'))::date,
  p_date_to    date DEFAULT (now() AT TIME ZONE 'Asia/Dhaka')::date
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(t)::jsonb ORDER BY t.order_date DESC)
    FROM (
      SELECT
        o.id AS order_id,
        o.invoice_id,
        o.status,
        o.order_date,
        o.customer_name,
        o.customer_phone,
        o.source,
        oi.quantity,
        oi.unit_price,
        COALESCE(oi.unit_cost, p.landed_cost_bdt, 0) AS unit_cost,
        COALESCE(oi.total_price, oi.unit_price * oi.quantity, 0) AS line_revenue,
        ROUND(COALESCE(oi.unit_cost, p.landed_cost_bdt, 0) * oi.quantity, 2) AS line_cogs,
        ROUND(
          COALESCE(oi.total_price, oi.unit_price * oi.quantity, 0)
          - COALESCE(oi.unit_cost, p.landed_cost_bdt, 0) * oi.quantity, 2) AS line_gross_profit,
        ROUND(
          COALESCE(cs_agg.courier_total_cost, 0) *
          CASE WHEN ord_rev.total_rev > 0
            THEN COALESCE(oi.total_price, 0)::numeric / ord_rev.total_rev ELSE 0 END, 2) AS line_courier_cost,
        ROUND(
          COALESCE(oi.total_price, oi.unit_price * oi.quantity, 0)
          - COALESCE(oi.unit_cost, p.landed_cost_bdt, 0) * oi.quantity
          - COALESCE(cs_agg.courier_total_cost, 0) *
            CASE WHEN ord_rev.total_rev > 0
              THEN COALESCE(oi.total_price, 0)::numeric / ord_rev.total_rev ELSE 0 END, 2) AS line_contribution
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      LEFT JOIN products p ON p.id = oi.product_id
      LEFT JOIN LATERAL (
        SELECT SUM(cs2.courier_total_cost) AS courier_total_cost
        FROM courier_shipments cs2 WHERE cs2.order_id = o.id
      ) cs_agg ON true
      LEFT JOIN LATERAL (
        SELECT SUM(COALESCE(oi2.total_price, 0)) AS total_rev
        FROM order_items oi2 WHERE oi2.order_id = o.id
      ) ord_rev ON true
      WHERE oi.product_id = p_product_id
        AND o.order_date >= p_date_from::timestamp
        AND o.order_date < (p_date_to + 1)::timestamp
      LIMIT 200
    ) t
  ), '[]'::jsonb);
END;
$$;
