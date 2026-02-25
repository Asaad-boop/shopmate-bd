
-- Fast scan lookup RPC: finds order by invoice_id, order_number, tracking_id, or pathao_tracking_code
CREATE OR REPLACE FUNCTION public.find_order_by_scan(p_scan_text text)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result json;
  q text := trim(p_scan_text);
BEGIN
  SELECT row_to_json(r) INTO result
  FROM (
    SELECT
      o.id,
      o.invoice_id,
      o.order_number,
      o.status,
      o.total_amount,
      o.delivery_charge,
      o.advance_amount,
      o.advance_method,
      o.discount,
      o.channel,
      o.pathao_tracking_code,
      o.legacy_tracking_id,
      o.courier_sync_status,
      o.delivery_district,
      o.delivery_thana,
      o.created_at,
      c.full_name as customer_name,
      c.phone as customer_phone,
      cs.tracking_id as shipment_tracking_id,
      cs.courier_id,
      cr.name as courier_name,
      cs.booking_status as shipment_status
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    LEFT JOIN courier_shipments cs ON cs.order_id = o.id
    LEFT JOIN couriers cr ON cr.id = cs.courier_id
    WHERE o.invoice_id = q
       OR o.order_number = q
       OR o.pathao_tracking_code = q
       OR o.legacy_tracking_id = q
       OR cs.tracking_id = q
    LIMIT 1
  ) r;
  RETURN result;
END;
$$;

-- Apply scan action: updates status with validation and audit logging
CREATE OR REPLACE FUNCTION public.apply_scan_action(
  p_order_id uuid,
  p_action text,
  p_reason text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_new_status text;
  v_allowed boolean := false;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- Determine new status based on action
  CASE p_action
    WHEN 'pack' THEN v_new_status := 'packed';
    WHEN 'ship' THEN v_new_status := 'shipped';
    WHEN 'return' THEN v_new_status := 'returned';
    ELSE RETURN json_build_object('success', false, 'error', 'Unknown action: ' || p_action);
  END CASE;

  -- Validate transitions
  CASE p_action
    WHEN 'pack' THEN v_allowed := v_order.status IN ('pending', 'ready_to_ship');
    WHEN 'ship' THEN v_allowed := v_order.status IN ('packed', 'ready_to_ship', 'pending');
    WHEN 'return' THEN v_allowed := v_order.status IN ('shipped', 'in_transit', 'delivered', 'delivery_failed', 'return_in_transit');
    ELSE v_allowed := false;
  END CASE;

  IF NOT v_allowed THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Cannot ' || p_action || ' order in status: ' || v_order.status
    );
  END IF;

  -- Apply return_condition if returning
  IF p_action = 'return' THEN
    UPDATE orders SET
      status = v_new_status,
      return_condition = COALESCE(p_reason, 'undelivered'),
      updated_at = now()
    WHERE id = p_order_id;
  ELSE
    UPDATE orders SET
      status = v_new_status,
      updated_at = now()
    WHERE id = p_order_id;
  END IF;

  -- Audit log
  INSERT INTO audit_logs (entity_type, entity_id, action, before_json, after_json, reason)
  VALUES (
    'order', p_order_id::text, 'scan_' || p_action,
    json_build_object('status', v_order.status),
    json_build_object('status', v_new_status),
    p_reason
  );

  RETURN json_build_object(
    'success', true,
    'old_status', v_order.status,
    'new_status', v_new_status
  );
END;
$$;

-- Ensure indexes exist for fast scan lookups
CREATE INDEX IF NOT EXISTS idx_orders_invoice_id ON public.orders (invoice_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders (order_number);
CREATE INDEX IF NOT EXISTS idx_orders_pathao_tracking ON public.orders (pathao_tracking_code) WHERE pathao_tracking_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_legacy_tracking ON public.orders (legacy_tracking_id) WHERE legacy_tracking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_courier_shipments_tracking ON public.courier_shipments (tracking_id) WHERE tracking_id IS NOT NULL;
