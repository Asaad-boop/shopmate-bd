
-- Indexes for fast order searching/filtering
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_channel ON orders(channel);
CREATE INDEX IF NOT EXISTS idx_orders_invoice_id_trgm ON orders USING gin(invoice_id gin_trgm_ops);

-- RPC: list_all_orders with server-side filtering + pagination
CREATE OR REPLACE FUNCTION public.list_all_orders(
  p_search text DEFAULT NULL,
  p_status text[] DEFAULT NULL,
  p_source text[] DEFAULT NULL,
  p_courier text[] DEFAULT NULL,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_delivered_from date DEFAULT NULL,
  p_delivered_to date DEFAULT NULL,
  p_has_advance text DEFAULT NULL,
  p_exceptions_only boolean DEFAULT false,
  p_settlement_status text DEFAULT NULL,
  p_sync_status text DEFAULT NULL,
  p_amount_min numeric DEFAULT NULL,
  p_amount_max numeric DEFAULT NULL,
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 50
)
RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      LEFT JOIN courier_shipments cs ON cs.order_id = o.id
      WHERE (p_status IS NULL OR o.status = ANY(p_status))
        AND (p_source IS NULL OR o.channel = ANY(p_source))
        AND (p_date_from IS NULL OR o.created_at::date >= p_date_from)
        AND (p_date_to IS NULL OR o.created_at::date <= p_date_to)
        AND (p_delivered_from IS NULL OR COALESCE(o.delivered_at, o.updated_at)::date >= p_delivered_from)
        AND (p_delivered_to IS NULL OR COALESCE(o.delivered_at, o.updated_at)::date <= p_delivered_to)
        AND (p_has_advance IS NULL
             OR (p_has_advance = 'yes' AND COALESCE(o.advance_amount, 0) > 0)
             OR (p_has_advance = 'no' AND COALESCE(o.advance_amount, 0) = 0))
        AND (p_settlement_status IS NULL
             OR (p_settlement_status = 'posted' AND o.settlement_posted = true)
             OR (p_settlement_status = 'pending' AND (o.settlement_posted IS NOT TRUE) AND o.status = 'delivered'))
        AND (p_sync_status IS NULL
             OR o.courier_sync_status = p_sync_status)
        AND (p_amount_min IS NULL OR COALESCE(o.total_amount, 0) >= p_amount_min)
        AND (p_amount_max IS NULL OR COALESCE(o.total_amount, 0) <= p_amount_max)
        AND (p_courier IS NULL OR cs.courier_id::text = ANY(p_courier))
        AND (p_exceptions_only = false OR EXISTS (SELECT 1 FROM order_exceptions oe WHERE oe.order_id = o.id AND oe.resolved_at IS NULL))
        AND (q_like IS NULL
             OR o.invoice_id ILIKE q_like
             OR c.full_name ILIKE q_like
             OR c.phone ILIKE q_like
             OR o.pathao_tracking_code ILIKE q_like
             OR o.legacy_tracking_id ILIKE q_like
             OR o.order_number ILIKE q_like)
    ),
    'rows', COALESCE((
      SELECT json_agg(row_to_json(r))
      FROM (
        SELECT
          o.id,
          o.invoice_id,
          o.order_number,
          o.channel as source,
          o.created_at,
          o.status,
          o.total_amount as customer_total,
          o.delivery_charge,
          o.advance_amount,
          o.advance_method,
          o.discount,
          o.notes,
          o.courier_sync_status as sync_status,
          CASE WHEN o.settlement_posted = true THEN 'Posted'
               WHEN o.status = 'delivered' THEN 'Pending'
               ELSE NULL END as settlement_status,
          o.pathao_tracking_code,
          o.legacy_tracking_id,
          o.legacy_batch_id,
          c.full_name as customer_name,
          c.phone,
          o.delivery_district as district,
          o.delivery_thana as thana,
          cs.courier_id,
          cr.name as courier_name,
          COALESCE(cs.tracking_id, o.pathao_tracking_code, o.legacy_tracking_id) as tracking_id,
          cs.courier_total_cost,
          cs.courier_net_payable as net_payable,
          (SELECT count(*) FROM order_exceptions oe WHERE oe.order_id = o.id AND oe.resolved_at IS NULL)::int as exception_count
        FROM orders o
        LEFT JOIN customers c ON c.id = o.customer_id
        LEFT JOIN courier_shipments cs ON cs.order_id = o.id
        LEFT JOIN couriers cr ON cr.id = cs.courier_id
        WHERE (p_status IS NULL OR o.status = ANY(p_status))
          AND (p_source IS NULL OR o.channel = ANY(p_source))
          AND (p_date_from IS NULL OR o.created_at::date >= p_date_from)
          AND (p_date_to IS NULL OR o.created_at::date <= p_date_to)
          AND (p_delivered_from IS NULL OR COALESCE(o.delivered_at, o.updated_at)::date >= p_delivered_from)
          AND (p_delivered_to IS NULL OR COALESCE(o.delivered_at, o.updated_at)::date <= p_delivered_to)
          AND (p_has_advance IS NULL
               OR (p_has_advance = 'yes' AND COALESCE(o.advance_amount, 0) > 0)
               OR (p_has_advance = 'no' AND COALESCE(o.advance_amount, 0) = 0))
          AND (p_settlement_status IS NULL
               OR (p_settlement_status = 'posted' AND o.settlement_posted = true)
               OR (p_settlement_status = 'pending' AND (o.settlement_posted IS NOT TRUE) AND o.status = 'delivered'))
          AND (p_sync_status IS NULL
               OR o.courier_sync_status = p_sync_status)
          AND (p_amount_min IS NULL OR COALESCE(o.total_amount, 0) >= p_amount_min)
          AND (p_amount_max IS NULL OR COALESCE(o.total_amount, 0) <= p_amount_max)
          AND (p_courier IS NULL OR cs.courier_id::text = ANY(p_courier))
          AND (p_exceptions_only = false OR EXISTS (SELECT 1 FROM order_exceptions oe WHERE oe.order_id = o.id AND oe.resolved_at IS NULL))
          AND (q_like IS NULL
               OR o.invoice_id ILIKE q_like
               OR c.full_name ILIKE q_like
               OR c.phone ILIKE q_like
               OR o.pathao_tracking_code ILIKE q_like
               OR o.legacy_tracking_id ILIKE q_like
               OR o.order_number ILIKE q_like)
        ORDER BY o.created_at DESC
        OFFSET p_offset
        LIMIT p_limit
      ) r
    ), '[]'::json)
  ) INTO result;

  RETURN result;
END;
$$;

-- Export RPC returns CSV-ready data for filtered results
CREATE OR REPLACE FUNCTION public.export_all_orders(
  p_search text DEFAULT NULL,
  p_status text[] DEFAULT NULL,
  p_source text[] DEFAULT NULL,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_limit integer DEFAULT 10000
)
RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result json;
  q_like text;
BEGIN
  IF p_search IS NOT NULL AND trim(p_search) != '' THEN
    q_like := '%' || trim(p_search) || '%';
  END IF;

  SELECT COALESCE(json_agg(row_to_json(r)), '[]'::json) INTO result
  FROM (
    SELECT
      o.invoice_id,
      o.order_number,
      o.channel as source,
      o.created_at,
      o.status,
      c.full_name as customer_name,
      c.phone,
      o.delivery_district as district,
      o.delivery_thana as thana,
      o.total_amount as customer_total,
      o.delivery_charge,
      o.advance_amount,
      o.advance_method,
      o.discount,
      COALESCE(cs.tracking_id, o.pathao_tracking_code, o.legacy_tracking_id) as tracking_id,
      cr.name as courier_name,
      cs.courier_total_cost,
      cs.courier_net_payable as net_payable,
      CASE WHEN o.settlement_posted = true THEN 'Posted'
           WHEN o.status = 'delivered' THEN 'Pending'
           ELSE '' END as settlement_status,
      o.courier_sync_status as sync_status,
      o.notes,
      (SELECT string_agg(COALESCE(p.sku, 'N/A') || ' x' || oi.quantity::text, ', ')
       FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = o.id) as items_summary
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    LEFT JOIN courier_shipments cs ON cs.order_id = o.id
    LEFT JOIN couriers cr ON cr.id = cs.courier_id
    WHERE (p_status IS NULL OR o.status = ANY(p_status))
      AND (p_source IS NULL OR o.channel = ANY(p_source))
      AND (p_date_from IS NULL OR o.created_at::date >= p_date_from)
      AND (p_date_to IS NULL OR o.created_at::date <= p_date_to)
      AND (q_like IS NULL
           OR o.invoice_id ILIKE q_like
           OR c.full_name ILIKE q_like
           OR c.phone ILIKE q_like
           OR o.pathao_tracking_code ILIKE q_like
           OR o.legacy_tracking_id ILIKE q_like)
    ORDER BY o.created_at DESC
    LIMIT p_limit
  ) r;

  RETURN result;
END;
$$;
