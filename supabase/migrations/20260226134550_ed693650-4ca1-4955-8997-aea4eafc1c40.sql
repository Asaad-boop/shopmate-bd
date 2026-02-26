
-- ─── Operations Dashboard KPIs ───
CREATE OR REPLACE FUNCTION public.ops_dashboard_kpis(p_from date DEFAULT CURRENT_DATE, p_to date DEFAULT CURRENT_DATE)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'pending_orders', (SELECT count(*) FROM orders WHERE status = 'pending' AND created_at::date BETWEEN p_from AND p_to),
    'ready_to_dispatch', (SELECT count(*) FROM orders WHERE status IN ('pending','packed','ready_to_ship') AND created_at::date BETWEEN p_from AND p_to),
    'in_transit', (SELECT count(*) FROM orders WHERE status = 'in_transit'),
    'delivered_today', (SELECT count(*) FROM orders WHERE status = 'delivered' AND updated_at::date = CURRENT_DATE),
    'returned_today', (SELECT count(*) FROM orders WHERE status = 'returned' AND updated_at::date = CURRENT_DATE),
    'courier_sync_errors', (SELECT count(*) FROM exceptions WHERE status = 'open' AND category = 'courier_sync')
  ) INTO result;
  RETURN result;
END;
$$;

-- ─── Operations Courier Performance ───
CREATE OR REPLACE FUNCTION public.ops_courier_performance()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  FROM (
    SELECT 
      c.name as courier_name,
      count(*) FILTER (WHERE cs.booking_status = 'delivered') as delivered,
      count(*) as total,
      CASE WHEN count(*) > 0 
        THEN round((count(*) FILTER (WHERE cs.booking_status = 'delivered')::numeric / count(*)) * 100, 1)
        ELSE 0 END as success_rate,
      COALESCE(round(avg(cs.courier_total_cost)::numeric, 0), 0) as avg_cost,
      COALESCE(round(avg(EXTRACT(EPOCH FROM (cs.delivered_at - cs.in_transit_at)) / 86400)::numeric, 1), 0) as avg_days
    FROM courier_shipments cs
    JOIN couriers c ON c.id = cs.courier_id
    WHERE cs.created_at >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY c.name
    ORDER BY total DESC
    LIMIT 5
  ) t INTO result;
  RETURN result;
END;
$$;

-- ─── Operations Activity Timeline ───
CREATE OR REPLACE FUNCTION public.ops_recent_activity(p_limit int DEFAULT 10)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  FROM (
    SELECT 
      id,
      action,
      entity_type,
      entity_id,
      user_name,
      created_at,
      COALESCE(reason, '') as reason
    FROM audit_logs
    WHERE entity_type IN ('order', 'shipment', 'inventory')
    ORDER BY created_at DESC
    LIMIT p_limit
  ) t INTO result;
  RETURN result;
END;
$$;

-- ─── Finance Dashboard KPIs ───
CREATE OR REPLACE FUNCTION public.fin_dashboard_kpis(p_from date DEFAULT NULL, p_to date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  result jsonb;
  v_from date := COALESCE(p_from, date_trunc('month', CURRENT_DATE)::date);
  v_to date := COALESCE(p_to, CURRENT_DATE);
BEGIN
  SELECT jsonb_build_object(
    'liquid_cash', COALESCE((SELECT sum(balance) FROM accounts WHERE type IN ('cash','bank','mobile_wallet') AND is_active = true), 0),
    'courier_receivable', COALESCE((SELECT sum(customer_total_amount) FROM courier_shipments WHERE booking_status = 'delivered' AND delivered_at IS NOT NULL AND id NOT IN (SELECT shipment_id FROM courier_settlement_allocations)), 0),
    'settlements_posted', (SELECT count(*) FROM courier_settlements_v2 WHERE settlement_date BETWEEN v_from AND v_to),
    'supplier_payables', COALESCE((SELECT sum(total_amount - paid_amount) FROM purchase_orders WHERE payment_status != 'paid'), 0),
    'period_expenses', COALESCE((SELECT sum(amount) FROM expenses WHERE expense_date BETWEEN v_from AND v_to), 0),
    'unposted_events', (SELECT count(*) FROM posting_queue WHERE status = 'pending')
  ) INTO result;
  RETURN result;
END;
$$;

-- ─── Finance Settlement Aging ───
CREATE OR REPLACE FUNCTION public.fin_settlement_aging()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'bucket_0_3', (SELECT count(*) FROM courier_shipments WHERE booking_status = 'delivered' AND delivered_at >= CURRENT_DATE - INTERVAL '3 days' AND id NOT IN (SELECT shipment_id FROM courier_settlement_allocations)),
    'bucket_4_7', (SELECT count(*) FROM courier_shipments WHERE booking_status = 'delivered' AND delivered_at BETWEEN CURRENT_DATE - INTERVAL '7 days' AND CURRENT_DATE - INTERVAL '4 days' AND id NOT IN (SELECT shipment_id FROM courier_settlement_allocations)),
    'bucket_8_15', (SELECT count(*) FROM courier_shipments WHERE booking_status = 'delivered' AND delivered_at BETWEEN CURRENT_DATE - INTERVAL '15 days' AND CURRENT_DATE - INTERVAL '8 days' AND id NOT IN (SELECT shipment_id FROM courier_settlement_allocations)),
    'bucket_15_plus', (SELECT count(*) FROM courier_shipments WHERE booking_status = 'delivered' AND delivered_at < CURRENT_DATE - INTERVAL '15 days' AND id NOT IN (SELECT shipment_id FROM courier_settlement_allocations)),
    'total_unsettled_amount', COALESCE((SELECT sum(customer_total_amount) FROM courier_shipments WHERE booking_status = 'delivered' AND id NOT IN (SELECT shipment_id FROM courier_settlement_allocations)), 0),
    'total_unsettled_count', (SELECT count(*) FROM courier_shipments WHERE booking_status = 'delivered' AND id NOT IN (SELECT shipment_id FROM courier_settlement_allocations))
  ) INTO result;
  RETURN result;
END;
$$;

-- ─── Finance Supplier Payables Snapshot ───
CREATE OR REPLACE FUNCTION public.fin_supplier_payables_snapshot()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  FROM (
    SELECT 
      s.name as supplier_name,
      COALESCE(sum(po.total_amount - po.paid_amount), 0) as due_amount,
      count(*) as po_count
    FROM purchase_orders po
    JOIN suppliers s ON s.id = po.supplier_id
    WHERE po.payment_status != 'paid' AND (po.total_amount - po.paid_amount) > 0
    GROUP BY s.name
    ORDER BY due_amount DESC
    LIMIT 5
  ) t INTO result;
  RETURN result;
END;
$$;

-- ─── Finance Expense Breakdown ───
CREATE OR REPLACE FUNCTION public.fin_expense_breakdown(p_from date DEFAULT NULL, p_to date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  result jsonb;
  v_from date := COALESCE(p_from, date_trunc('month', CURRENT_DATE)::date);
  v_to date := COALESCE(p_to, CURRENT_DATE);
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  FROM (
    SELECT 
      COALESCE(ec.name, e.category) as category,
      sum(e.amount) as total,
      count(*) as entries
    FROM expenses e
    LEFT JOIN expense_categories ec ON ec.id::text = e.category
    WHERE e.expense_date BETWEEN v_from AND v_to
    GROUP BY COALESCE(ec.name, e.category)
    ORDER BY total DESC
    LIMIT 8
  ) t INTO result;
  RETURN result;
END;
$$;

-- ─── Finance Cashflow Trend ───
CREATE OR REPLACE FUNCTION public.fin_cashflow_trend(p_days int DEFAULT 14)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.day), '[]'::jsonb)
  FROM (
    SELECT 
      d::date as day,
      COALESCE((SELECT sum(amount) FROM account_ledger WHERE direction = 'credit' AND ledger_date::date = d::date), 0) as inflow,
      COALESCE((SELECT sum(amount) FROM account_ledger WHERE direction = 'debit' AND ledger_date::date = d::date), 0) as outflow
    FROM generate_series(CURRENT_DATE - (p_days || ' days')::interval, CURRENT_DATE, '1 day') d
  ) t INTO result;
  RETURN result;
END;
$$;
