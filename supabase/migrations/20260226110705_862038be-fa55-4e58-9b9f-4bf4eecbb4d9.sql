
-- Executive Dashboard RPCs

-- 1) exec_dashboard_kpis: orders, revenue, profit, AOV, return rate with deltas
CREATE OR REPLACE FUNCTION public.exec_dashboard_kpis(p_from date DEFAULT CURRENT_DATE, p_to date DEFAULT CURRENT_DATE)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
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
      coalesce(sum(total_amount - coalesce(total_cost,0) - coalesce(courier_charge,0)) FILTER (WHERE status = 'delivered'), 0) as gross_profit
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
      coalesce(sum(total_amount - coalesce(total_cost,0) - coalesce(courier_charge,0)) FILTER (WHERE status = 'delivered'), 0) as gross_profit
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
$$;

-- 2) exec_dashboard_pipeline: counts + amounts per status
CREATE OR REPLACE FUNCTION public.exec_dashboard_pipeline(p_from date DEFAULT NULL, p_to date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO result
  FROM (
    SELECT
      status,
      count(*) as count,
      coalesce(sum(total_amount), 0) as total_amount
    FROM orders
    WHERE (p_from IS NULL OR created_at::date >= p_from)
      AND (p_to IS NULL OR created_at::date <= p_to)
    GROUP BY status
    ORDER BY count DESC
  ) t;

  RETURN result;
END;
$$;

-- 3) exec_dashboard_alerts: operational alerts with counts
CREATE OR REPLACE FUNCTION public.exec_dashboard_alerts()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result jsonb;
  v_pending_24h int;
  v_intransit_5d int;
  v_delivered_unsettled int;
  v_delivered_unsettled_amt numeric;
  v_missing_courier_cost int;
  v_missing_sku_cost int;
  v_negative_stock int;
  v_unposted_2d int;
  v_exceptions_open int;
BEGIN
  -- Pending > 24h
  SELECT count(*) INTO v_pending_24h
  FROM orders WHERE status = 'pending' AND created_at < now() - interval '24 hours';

  -- In transit > 5 days
  SELECT count(*) INTO v_intransit_5d
  FROM orders WHERE status = 'in_transit' AND updated_at < now() - interval '5 days';

  -- Delivered but not settled
  SELECT count(*), coalesce(sum(total_amount), 0) INTO v_delivered_unsettled, v_delivered_unsettled_amt
  FROM orders WHERE status = 'delivered' AND coalesce(settlement_posted, false) = false;

  -- Missing courier cost
  SELECT count(*) INTO v_missing_courier_cost
  FROM orders WHERE status IN ('shipped','in_transit','delivered') AND coalesce(courier_charge, 0) = 0;

  -- Missing SKU cost
  SELECT count(DISTINCT oi.product_id) INTO v_missing_sku_cost
  FROM order_items oi WHERE coalesce(oi.unit_cost, 0) = 0;

  -- Negative stock
  SELECT count(*) INTO v_negative_stock
  FROM products WHERE stock_quantity < 0;

  -- Unposted finance events > 2 days
  SELECT count(*) INTO v_unposted_2d
  FROM posting_events WHERE status = 'pending' AND created_at < now() - interval '2 days';

  -- Open exceptions
  SELECT count(*) INTO v_exceptions_open
  FROM system_issues WHERE status NOT IN ('resolved','ignored');

  result := jsonb_build_object(
    'pending_24h', v_pending_24h,
    'intransit_5d', v_intransit_5d,
    'delivered_unsettled', v_delivered_unsettled,
    'delivered_unsettled_amt', v_delivered_unsettled_amt,
    'missing_courier_cost', v_missing_courier_cost,
    'missing_sku_cost', v_missing_sku_cost,
    'negative_stock', v_negative_stock,
    'unposted_2d', v_unposted_2d,
    'exceptions_open', v_exceptions_open
  );

  RETURN result;
END;
$$;

-- 4) exec_dashboard_inventory: value, low stock, dead stock, top movers
CREATE OR REPLACE FUNCTION public.exec_dashboard_inventory()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result jsonb;
  v_total_value numeric;
  v_low_stock int;
  v_dead_stock int;
  v_top_by_qty jsonb;
  v_top_by_profit jsonb;
BEGIN
  SELECT coalesce(sum(stock_quantity * coalesce(cost_price, 0)), 0) INTO v_total_value FROM products WHERE stock_quantity > 0;

  SELECT count(*) INTO v_low_stock FROM products WHERE stock_quantity > 0 AND stock_quantity <= coalesce(reorder_point, 5) AND is_active = true;

  SELECT count(*) INTO v_dead_stock FROM products p WHERE p.is_active = true AND p.stock_quantity > 0
    AND NOT EXISTS (SELECT 1 FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE oi.product_id = p.id AND o.created_at > now() - interval '60 days');

  SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_top_by_qty
  FROM (
    SELECT p.name, p.sku, sum(oi.quantity) as qty
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN products p ON p.id = oi.product_id
    WHERE o.status = 'delivered' AND o.created_at > now() - interval '30 days'
    GROUP BY p.id, p.name, p.sku
    ORDER BY qty DESC LIMIT 5
  ) t;

  SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_top_by_profit
  FROM (
    SELECT p.name, p.sku, sum(oi.profit) as profit
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN products p ON p.id = oi.product_id
    WHERE o.status = 'delivered' AND o.created_at > now() - interval '30 days'
    GROUP BY p.id, p.name, p.sku
    ORDER BY profit DESC LIMIT 5
  ) t;

  result := jsonb_build_object(
    'total_value', v_total_value,
    'low_stock', v_low_stock,
    'dead_stock', v_dead_stock,
    'top_by_qty', v_top_by_qty,
    'top_by_profit', v_top_by_profit
  );

  RETURN result;
END;
$$;

-- 5) exec_dashboard_finance: accounts snapshot + settlement summary
CREATE OR REPLACE FUNCTION public.exec_dashboard_finance()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result jsonb;
  v_cash numeric := 0;
  v_bank numeric := 0;
  v_bkash numeric := 0;
  v_nagad numeric := 0;
  v_courier_receivable numeric := 0;
  v_settlements_posted int := 0;
BEGIN
  -- Get account balances by ledger_classification or name
  SELECT coalesce(sum(balance), 0) INTO v_cash FROM accounts WHERE lower(name) LIKE '%cash%' AND is_active = true;
  SELECT coalesce(sum(balance), 0) INTO v_bank FROM accounts WHERE (lower(name) LIKE '%bank%') AND is_active = true;
  SELECT coalesce(sum(balance), 0) INTO v_bkash FROM accounts WHERE lower(name) LIKE '%bkash%' AND is_active = true;
  SELECT coalesce(sum(balance), 0) INTO v_nagad FROM accounts WHERE lower(name) LIKE '%nagad%' AND is_active = true;

  -- Courier receivable: delivered but not settled
  SELECT coalesce(sum(total_amount), 0) INTO v_courier_receivable
  FROM orders WHERE status = 'delivered' AND coalesce(settlement_posted, false) = false;

  -- Settlements posted this month
  SELECT count(*) INTO v_settlements_posted
  FROM courier_settlements_v2 WHERE settlement_date >= date_trunc('month', CURRENT_DATE)::date;

  result := jsonb_build_object(
    'cash', v_cash,
    'bank', v_bank,
    'bkash', v_bkash,
    'nagad', v_nagad,
    'total_liquid', v_cash + v_bank + v_bkash + v_nagad,
    'courier_receivable', v_courier_receivable,
    'settlements_posted', v_settlements_posted
  );

  RETURN result;
END;
$$;

-- 6) exec_dashboard_charts: daily revenue, expenses, profit, return rate for N days
CREATE OR REPLACE FUNCTION public.exec_dashboard_charts(p_days int DEFAULT 14)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(row_to_json(t) ORDER BY t.day), '[]'::jsonb) INTO result
  FROM (
    SELECT
      d.day::date as day,
      coalesce(sum(o.total_amount) FILTER (WHERE o.status = 'delivered'), 0) as revenue,
      coalesce(sum(o.total_amount - coalesce(o.total_cost,0) - coalesce(o.courier_charge,0)) FILTER (WHERE o.status = 'delivered'), 0) as profit,
      count(*) FILTER (WHERE o.status IN ('returned','damage_return')) as returns,
      count(*) FILTER (WHERE o.status = 'delivered') as delivered
    FROM generate_series(CURRENT_DATE - (p_days - 1), CURRENT_DATE, '1 day') d(day)
    LEFT JOIN orders o ON o.created_at::date = d.day
    GROUP BY d.day
  ) t;

  RETURN result;
END;
$$;

-- 7) exec_dashboard_marketing: ad spend, influencer spend, marketing % of revenue
CREATE OR REPLACE FUNCTION public.exec_dashboard_marketing(p_from date DEFAULT date_trunc('month', CURRENT_DATE)::date, p_to date DEFAULT CURRENT_DATE)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result jsonb;
  v_meta_spend numeric;
  v_influencer_spend numeric;
  v_revenue numeric;
BEGIN
  SELECT coalesce(sum(amount_bdt), 0) INTO v_meta_spend
  FROM ad_expenses WHERE expense_date BETWEEN p_from AND p_to AND category = 'meta_ads';

  SELECT coalesce(sum(amount_bdt), 0) INTO v_influencer_spend
  FROM ad_expenses WHERE expense_date BETWEEN p_from AND p_to AND category IN ('influencer','ugc');

  SELECT coalesce(sum(total_amount), 0) INTO v_revenue
  FROM orders WHERE status = 'delivered' AND created_at::date BETWEEN p_from AND p_to;

  result := jsonb_build_object(
    'meta_spend', v_meta_spend,
    'influencer_spend', v_influencer_spend,
    'total_marketing', v_meta_spend + v_influencer_spend,
    'revenue', v_revenue,
    'marketing_pct', CASE WHEN v_revenue > 0 THEN round(((v_meta_spend + v_influencer_spend) / v_revenue * 100)::numeric, 1) ELSE 0 END
  );

  RETURN result;
END;
$$;
