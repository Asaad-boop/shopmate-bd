
-- SKU Profitability report RPC
CREATE OR REPLACE FUNCTION public.sku_profitability_report(
  p_date_from date DEFAULT (((now() AT TIME ZONE 'Asia/Dhaka'::text))::date - 29),
  p_date_to date DEFAULT ((now() AT TIME ZONE 'Asia/Dhaka'::text))::date
)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result json;
BEGIN
  SELECT json_agg(row_to_json(sku) ORDER BY sku.revenue DESC) INTO result
  FROM (
    SELECT
      p.id as product_id,
      p.sku,
      p.name,
      p.image_url,

      -- Delivered qty & revenue
      COALESCE(del.qty_sold, 0)::int as qty_sold,
      COALESCE(del.revenue, 0)::numeric as revenue,
      COALESCE(del.cogs, 0)::numeric as cogs,
      COALESCE(del.order_count, 0)::int as order_count,
      COALESCE(del.avg_sell_price, 0)::numeric as avg_sell_price,

      -- Courier cost (proportionally allocated per line item)
      COALESCE(cour.courier_cost, 0)::numeric as courier_cost,

      -- Meta ads (from campaign_products allocation)
      COALESCE(meta.meta_ads_cost, 0)::numeric as meta_ads_cost,

      -- Other allocated expenses
      COALESCE(alloc.allocated_cost, 0)::numeric as allocated_cost,
      COALESCE(alloc.allocation_detail, '[]'::json) as allocation_detail,

      -- Returns
      COALESCE(ret.returned_qty, 0)::int as returned_qty,
      COALESCE(ret.return_cogs, 0)::numeric as return_cogs,
      COALESCE(ret.return_courier, 0)::numeric as return_courier_cost,

      -- Calculated fields
      (COALESCE(del.revenue, 0) - COALESCE(del.cogs, 0))::numeric as gross_profit,
      (COALESCE(del.revenue, 0) - COALESCE(del.cogs, 0)
        - COALESCE(cour.courier_cost, 0)
        - COALESCE(meta.meta_ads_cost, 0)
        - COALESCE(alloc.allocated_cost, 0)
        - COALESCE(ret.return_cogs, 0)
        - COALESCE(ret.return_courier, 0)
      )::numeric as net_profit

    FROM products p

    -- Delivered items
    LEFT JOIN LATERAL (
      SELECT
        sum(oi.quantity) as qty_sold,
        sum(oi.total_price) as revenue,
        sum(oi.quantity * COALESCE(oi.unit_cost_at_delivery, p.cost_price, 0)) as cogs,
        count(DISTINCT o.id) as order_count,
        CASE WHEN sum(oi.quantity) > 0 THEN round(sum(oi.total_price) / sum(oi.quantity)) ELSE 0 END as avg_sell_price
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.product_id = p.id
        AND o.status = 'delivered'
        AND COALESCE(o.delivered_at, o.updated_at)::date BETWEEN p_date_from AND p_date_to
    ) del ON true

    -- Courier cost allocated proportionally
    LEFT JOIN LATERAL (
      SELECT sum(allocated_cost) as courier_cost
      FROM (
        SELECT
          cs.courier_total_cost::numeric
            * (oi.total_price::numeric / NULLIF(o.total_amount::numeric, 0))
          as allocated_cost
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN courier_shipments cs ON cs.order_id = o.id
        WHERE oi.product_id = p.id
          AND o.status = 'delivered'
          AND COALESCE(o.delivered_at, o.updated_at)::date BETWEEN p_date_from AND p_date_to
      ) sub
    ) cour ON true

    -- Meta ads from campaign_products mapping
    LEFT JOIN LATERAL (
      SELECT COALESCE(sum(
        ae.amount_bdt * COALESCE(cp.allocation_pct, 100) / 100.0
      ), 0) as meta_ads_cost
      FROM campaign_products cp
      JOIN meta_campaigns mc ON mc.id = cp.campaign_id
      JOIN ad_expenses ae ON ae.campaign_id = mc.id
      WHERE cp.product_id = p.id
        AND ae.expense_date BETWEEN p_date_from AND p_date_to
    ) meta ON true

    -- Expense allocations
    LEFT JOIN LATERAL (
      SELECT
        COALESCE(sum(eal.allocated_amount), 0) as allocated_cost,
        COALESCE((
          SELECT json_agg(json_build_object('category', ec.name, 'method', ea2.allocation_method, 'amount', eal2.allocated_amount))
          FROM expense_allocation_lines eal2
          JOIN expense_allocations ea2 ON ea2.id = eal2.allocation_id
          JOIN expense_categories ec ON ec.id = ea2.category_id
          WHERE eal2.product_id = p.id
            AND ea2.status = 'posted'
            AND ea2.allocation_date BETWEEN p_date_from AND p_date_to
        ), '[]'::json) as allocation_detail
      FROM expense_allocation_lines eal
      JOIN expense_allocations ea ON ea.id = eal.allocation_id
      WHERE eal.product_id = p.id
        AND ea.status = 'posted'
        AND ea.allocation_date BETWEEN p_date_from AND p_date_to
    ) alloc ON true

    -- Returns
    LEFT JOIN LATERAL (
      SELECT
        COALESCE(sum(oi.quantity), 0) as returned_qty,
        COALESCE(sum(oi.quantity * COALESCE(oi.unit_cost_at_delivery, p.cost_price, 0)), 0) as return_cogs,
        COALESCE(sum(
          cs.courier_return_cost::numeric
            * (oi.total_price::numeric / NULLIF(o.total_amount::numeric, 0))
        ), 0) as return_courier
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      LEFT JOIN courier_shipments cs ON cs.order_id = o.id
      WHERE oi.product_id = p.id
        AND o.status IN ('returned', 'damage_return')
        AND o.updated_at::date BETWEEN p_date_from AND p_date_to
    ) ret ON true

    WHERE p.status = 'active'
      AND (COALESCE(del.qty_sold, 0) > 0 OR COALESCE(ret.returned_qty, 0) > 0)
  ) sku;

  RETURN COALESCE(result, '[]'::json);
END;
$function$;

-- SKU drilldown: orders for a specific product in a date range
CREATE OR REPLACE FUNCTION public.sku_order_drilldown(
  p_product_id uuid,
  p_date_from date,
  p_date_to date
)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result json;
BEGIN
  SELECT json_agg(row_to_json(r) ORDER BY r.order_date DESC) INTO result
  FROM (
    SELECT
      o.id as order_id,
      o.invoice_id,
      o.status,
      o.order_date,
      COALESCE(o.delivered_at, o.updated_at) as resolved_at,
      c.full_name as customer_name,
      oi.quantity,
      oi.unit_price,
      oi.total_price as line_revenue,
      (oi.quantity * COALESCE(oi.unit_cost_at_delivery, p.cost_price, 0))::numeric as line_cogs,
      COALESCE(
        cs.courier_total_cost * (oi.total_price::numeric / NULLIF(o.total_amount::numeric, 0)),
        0
      )::numeric as line_courier_cost,
      (oi.total_price - oi.quantity * COALESCE(oi.unit_cost_at_delivery, p.cost_price, 0)
        - COALESCE(cs.courier_total_cost * (oi.total_price::numeric / NULLIF(o.total_amount::numeric, 0)), 0)
      )::numeric as line_contribution
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN products p ON p.id = oi.product_id
    LEFT JOIN customers c ON c.id = o.customer_id
    LEFT JOIN courier_shipments cs ON cs.order_id = o.id
    WHERE oi.product_id = p_product_id
      AND o.status IN ('delivered', 'returned', 'damage_return')
      AND COALESCE(o.delivered_at, o.updated_at)::date BETWEEN p_date_from AND p_date_to
  ) r;

  RETURN COALESCE(result, '[]'::json);
END;
$function$;
