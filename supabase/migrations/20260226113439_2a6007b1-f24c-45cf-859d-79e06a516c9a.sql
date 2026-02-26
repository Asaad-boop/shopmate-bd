
-- 1) Web Order Performance (donut: complete/no-response/good-but-no-response/cancel)
CREATE OR REPLACE FUNCTION public.dash_web_order_performance(p_days int DEFAULT 7)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total', count(*),
    'complete', count(*) FILTER (WHERE status IN ('delivered','completed')),
    'no_response', count(*) FILTER (WHERE status = 'pending' AND created_at < now() - interval '48 hours'),
    'good_no_response', count(*) FILTER (WHERE status IN ('in_transit','shipped','packed','ready_to_ship')),
    'cancel', count(*) FILTER (WHERE status IN ('cancelled','returned'))
  ) INTO result
  FROM orders
  WHERE source IN ('shopify','website','web')
    AND created_at >= now() - (p_days || ' days')::interval;
  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

-- 2) Orders by Source (donut + legend)
CREATE OR REPLACE FUNCTION public.dash_orders_by_source(p_from date DEFAULT CURRENT_DATE - 30, p_to date DEFAULT CURRENT_DATE)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE result jsonb;
BEGIN
  WITH cur AS (
    SELECT COALESCE(source,'manual') as src, count(*) as cnt, COALESCE(sum(total_amount),0) as revenue
    FROM orders WHERE created_at::date BETWEEN p_from AND p_to
    GROUP BY COALESCE(source,'manual')
  ),
  prev AS (
    SELECT COALESCE(source,'manual') as src, count(*) as cnt
    FROM orders WHERE created_at::date BETWEEN p_from - (p_to - p_from + 1) AND p_from - 1
    GROUP BY COALESCE(source,'manual')
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
$$;

-- 3) Order Flow Trend (bar: created vs sent to courier)
CREATE OR REPLACE FUNCTION public.dash_order_flow_trend(p_days int DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE result jsonb;
BEGIN
  WITH days AS (
    SELECT generate_series(CURRENT_DATE - (p_days - 1), CURRENT_DATE, '1 day')::date as d
  ),
  created AS (
    SELECT created_at::date as d, count(*) as cnt FROM orders
    WHERE created_at::date >= CURRENT_DATE - (p_days - 1)
    GROUP BY 1
  ),
  sent AS (
    SELECT updated_at::date as d, count(*) as cnt FROM orders
    WHERE status IN ('shipped','in_transit','delivered','returned')
      AND updated_at::date >= CURRENT_DATE - (p_days - 1)
    GROUP BY 1
  )
  SELECT jsonb_build_object(
    'total_created', (SELECT COALESCE(sum(cnt),0) FROM created),
    'total_sent', (SELECT COALESCE(sum(cnt),0) FROM sent),
    'days', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'day', to_char(days.d, 'DD Mon'),
        'date', days.d,
        'created', COALESCE(c.cnt,0),
        'sent', COALESCE(s.cnt,0)
      ) ORDER BY days.d)
      FROM days LEFT JOIN created c ON c.d = days.d LEFT JOIN sent s ON s.d = days.d
    ), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;

-- 4) Hourly Order Trend (today vs yesterday)
CREATE OR REPLACE FUNCTION public.dash_hourly_orders(p_source text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE result jsonb;
BEGIN
  WITH hours AS (SELECT generate_series(0,23) as h),
  today AS (
    SELECT extract(hour FROM created_at)::int as h, count(*) as cnt
    FROM orders
    WHERE created_at::date = CURRENT_DATE
      AND (p_source IS NULL OR source = p_source)
    GROUP BY 1
  ),
  yesterday AS (
    SELECT extract(hour FROM created_at)::int as h, count(*) as cnt
    FROM orders
    WHERE created_at::date = CURRENT_DATE - 1
      AND (p_source IS NULL OR source = p_source)
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
$$;

-- 5) Top Sales Products
CREATE OR REPLACE FUNCTION public.dash_top_products(p_from date DEFAULT CURRENT_DATE - 30, p_to date DEFAULT CURRENT_DATE, p_limit int DEFAULT 5)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_jsonb(t) ORDER BY t.sales_count DESC), '[]'::jsonb) INTO result
  FROM (
    SELECT p.name, p.sku, p.image_url as thumbnail,
           COALESCE(sum(oi.quantity),0)::int as sales_count,
           COALESCE(sum(oi.quantity * oi.price),0) as revenue
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
$$;
