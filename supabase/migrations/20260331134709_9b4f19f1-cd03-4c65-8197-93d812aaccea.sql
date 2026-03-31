-- Fix exec_dashboard_kpis: replace total_cost with courier_total_cost
CREATE OR REPLACE FUNCTION public.exec_dashboard_kpis(p_from date DEFAULT CURRENT_DATE, p_to date DEFAULT CURRENT_DATE)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  result jsonb;
  period_days int;
  prev_from date;
  prev_to date;
BEGIN
  period_days := (p_to - p_from) + 1;
  prev_from := p_from - period_days;
  prev_to := p_from - 1;

  WITH cur AS (
    SELECT
      count(*) as total_orders,
      count(*) FILTER (WHERE status = 'delivered') as delivered,
      count(*) FILTER (WHERE status = 'in_transit') as in_transit,
      count(*) FILTER (WHERE status IN ('returned','damage_return')) as returned,
      coalesce(sum(total_amount) FILTER (WHERE status = 'delivered'), 0) as delivered_revenue,
      coalesce(avg(total_amount) FILTER (WHERE status = 'delivered'), 0) as avg_order_value,
      coalesce(sum(total_amount - coalesce(courier_total_cost,0) - coalesce(courier_charge,0)) FILTER (WHERE status = 'delivered'), 0) as gross_profit
    FROM orders
    WHERE created_at::date BETWEEN p_from AND p_to
  ),
  prev AS (
    SELECT
      count(*) as total_orders,
      count(*) FILTER (WHERE status = 'delivered') as delivered,
      count(*) FILTER (WHERE status IN ('returned','damage_return')) as returned,
      coalesce(sum(total_amount) FILTER (WHERE status = 'delivered'), 0) as delivered_revenue,
      coalesce(avg(total_amount) FILTER (WHERE status = 'delivered'), 0) as avg_order_value,
      coalesce(sum(total_amount - coalesce(courier_total_cost,0) - coalesce(courier_charge,0)) FILTER (WHERE status = 'delivered'), 0) as gross_profit
    FROM orders
    WHERE created_at::date BETWEEN prev_from AND prev_to
  )
  SELECT jsonb_build_object(
    'total_orders', cur.total_orders,
    'delivered', cur.delivered,
    'in_transit', cur.in_transit,
    'returned', cur.returned,
    'return_rate', CASE WHEN (cur.delivered + cur.returned) > 0 THEN round((cur.returned::numeric / (cur.delivered + cur.returned) * 100), 1) ELSE 0 END,
    'delivered_revenue', cur.delivered_revenue,
    'avg_order_value', round(cur.avg_order_value::numeric, 2),
    'gross_profit', cur.gross_profit,
    'prev_total_orders', prev.total_orders,
    'prev_delivered', prev.delivered,
    'prev_delivered_revenue', prev.delivered_revenue,
    'prev_avg_order_value', round(prev.avg_order_value::numeric, 2),
    'prev_gross_profit', prev.gross_profit,
    'prev_return_rate', CASE WHEN (prev.delivered + prev.returned) > 0 THEN round((prev.returned::numeric / (prev.delivered + prev.returned) * 100), 1) ELSE 0 END
  ) INTO result FROM cur, prev;

  RETURN result;
END;
$function$;

-- Fix exec_dashboard_charts: replace o.total_cost with o.courier_total_cost
CREATE OR REPLACE FUNCTION public.exec_dashboard_charts(p_days integer DEFAULT 14)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  result jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(row_to_json(t) ORDER BY t.day), '[]'::jsonb) INTO result
  FROM (
    SELECT
      d.day::date as day,
      coalesce(sum(o.total_amount) FILTER (WHERE o.status = 'delivered'), 0) as revenue,
      coalesce(sum(o.total_amount - coalesce(o.courier_total_cost,0) - coalesce(o.courier_charge,0)) FILTER (WHERE o.status = 'delivered'), 0) as profit,
      count(*) FILTER (WHERE o.status IN ('returned','damage_return')) as returns,
      count(*) FILTER (WHERE o.status = 'delivered') as delivered
    FROM generate_series(CURRENT_DATE - (p_days - 1), CURRENT_DATE, '1 day') d(day)
    LEFT JOIN orders o ON o.created_at::date = d.day
    GROUP BY d.day
  ) t;

  RETURN result;
END;
$function$;

-- Fix dash_orders_by_source: replace source with order_source
CREATE OR REPLACE FUNCTION public.dash_orders_by_source(p_from date DEFAULT (CURRENT_DATE - 30), p_to date DEFAULT CURRENT_DATE)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE result jsonb;
BEGIN
  WITH cur AS (
    SELECT COALESCE(order_source,'manual') as src, count(*) as cnt, COALESCE(sum(total_amount),0) as revenue
    FROM orders WHERE created_at::date BETWEEN p_from AND p_to
    GROUP BY COALESCE(order_source,'manual')
  ),
  prev AS (
    SELECT COALESCE(order_source,'manual') as src, count(*) as cnt
    FROM orders WHERE created_at::date BETWEEN p_from - (p_to - p_from + 1) AND p_from - 1
    GROUP BY COALESCE(order_source,'manual')
  )
  SELECT jsonb_build_object(
    'total_orders', (SELECT COALESCE(sum(cnt),0) FROM cur),
    'total_value', (SELECT COALESCE(sum(revenue),0) FROM cur),
    'sources', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'source', c.src,
        'count', c.cnt,
        'revenue', c.revenue,
        'prev_count', COALESCE(p.cnt,0),
        'growth_pct', CASE WHEN COALESCE(p.cnt,0) = 0 THEN 100
                           ELSE round(((c.cnt - p.cnt)::numeric / p.cnt) * 100, 1) END
      ) ORDER BY c.cnt DESC)
      FROM cur c LEFT JOIN prev p ON p.src = c.src
    ), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$function$;

-- Fix dash_top_products: replace oi.price with oi.unit_price
CREATE OR REPLACE FUNCTION public.dash_top_products(p_from date DEFAULT (CURRENT_DATE - 30), p_to date DEFAULT CURRENT_DATE, p_limit integer DEFAULT 5)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_jsonb(t) ORDER BY t.sales_count DESC), '[]'::jsonb) INTO result
  FROM (
    SELECT p.name, p.sku, p.image_url as thumbnail,
           COALESCE(sum(oi.quantity),0)::int as sales_count,
           COALESCE(sum(oi.quantity * oi.unit_price),0) as revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN products p ON p.id = oi.product_id
    WHERE o.created_at::date BETWEEN p_from AND p_to
      AND o.status NOT IN ('cancelled')
    GROUP BY p.id, p.name, p.sku, p.image_url
    ORDER BY sales_count DESC
    LIMIT p_limit
  ) t;
  RETURN result;
END;
$function$;

-- Fix ops_dashboard_kpis: replace category with source_module
CREATE OR REPLACE FUNCTION public.ops_dashboard_kpis(p_from date DEFAULT CURRENT_DATE, p_to date DEFAULT CURRENT_DATE)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'pending_orders', (SELECT count(*) FROM orders WHERE status = 'pending' AND created_at::date BETWEEN p_from AND p_to),
    'ready_to_dispatch', (SELECT count(*) FROM orders WHERE status IN ('pending','packed','ready_to_ship') AND created_at::date BETWEEN p_from AND p_to),
    'in_transit', (SELECT count(*) FROM orders WHERE status = 'in_transit'),
    'delivered_today', (SELECT count(*) FROM orders WHERE status = 'delivered' AND updated_at::date = CURRENT_DATE),
    'returned_today', (SELECT count(*) FROM orders WHERE status = 'returned' AND updated_at::date = CURRENT_DATE),
    'courier_sync_errors', (SELECT count(*) FROM exceptions WHERE status = 'open' AND source_module = 'courier_sync')
  ) INTO result;
  RETURN result;
END;
$function$;

-- Fix dash_hourly_orders: replace source with order_source
CREATE OR REPLACE FUNCTION public.dash_hourly_orders(p_source text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE result jsonb;
BEGIN
  WITH hours AS (SELECT generate_series(0,23) as h),
  today AS (
    SELECT extract(hour FROM created_at)::int as h, count(*) as cnt
    FROM orders
    WHERE created_at::date = CURRENT_DATE
      AND (p_source IS NULL OR order_source = p_source)
    GROUP BY 1
  ),
  yesterday AS (
    SELECT extract(hour FROM created_at)::int as h, count(*) as cnt
    FROM orders
    WHERE created_at::date = CURRENT_DATE - 1
      AND (p_source IS NULL OR order_source = p_source)
    GROUP BY 1
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'hour', hours.h,
    'label', CASE WHEN hours.h = 0 THEN '12AM' WHEN hours.h < 12 THEN hours.h || 'AM'
                  WHEN hours.h = 12 THEN '12PM' ELSE (hours.h - 12) || 'PM' END,
    'today', COALESCE(t.cnt,0),
    'yesterday', COALESCE(y.cnt,0)
  ) ORDER BY hours.h), '[]'::jsonb) INTO result
  FROM hours LEFT JOIN today t ON t.h = hours.h LEFT JOIN yesterday y ON y.h = hours.h;
  RETURN result;
END;
$function$;