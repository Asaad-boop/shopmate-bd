
-- Enable trigram extension for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_orders_invoice_id ON public.orders (invoice_id);
CREATE INDEX IF NOT EXISTS idx_orders_pathao_tracking ON public.orders (pathao_tracking_code);
CREATE INDEX IF NOT EXISTS idx_orders_legacy_tracking ON public.orders (legacy_tracking_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products (sku);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers (phone);
CREATE INDEX IF NOT EXISTS idx_shipments_tracking ON public.shipments (tracking_id);

-- Global search RPC using order_summary_view for orders (has customer_name, customer_phone)
CREATE OR REPLACE FUNCTION public.global_search(p_query text, p_limit int DEFAULT 20)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result json;
  q text := trim(p_query);
  q_like text := '%' || q || '%';
BEGIN
  SELECT json_build_object(
    'orders', COALESCE((
      SELECT json_agg(row_to_json(r))
      FROM (
        SELECT o.id, o.invoice_id, o.status, o.total_amount,
               o.pathao_tracking_code, o.legacy_tracking_id,
               o.delivery_charge, o.order_date, o.order_number,
               o.shopify_order_id, o.courier_sync_status,
               c.full_name as customer_name, c.phone as customer_phone,
               s.tracking_id, s.courier_name
        FROM orders o
        LEFT JOIN customers c ON c.id = o.customer_id
        LEFT JOIN shipments s ON s.order_id = o.id
        WHERE o.invoice_id ILIKE q_like
           OR c.full_name ILIKE q_like
           OR c.phone ILIKE q_like
           OR o.pathao_tracking_code ILIKE q_like
           OR o.legacy_tracking_id ILIKE q_like
           OR s.tracking_id ILIKE q_like
           OR o.shopify_order_id ILIKE q_like
           OR o.order_number ILIKE q_like
           OR o.notes ILIKE q_like
        ORDER BY o.created_at DESC
        LIMIT p_limit
      ) r
    ), '[]'::json),
    'customers', COALESCE((
      SELECT json_agg(row_to_json(c))
      FROM (
        SELECT id, full_name, phone, address, district, total_orders, total_spent, last_order_date, segment
        FROM customers
        WHERE phone ILIKE q_like
           OR full_name ILIKE q_like
           OR address ILIKE q_like
        ORDER BY total_orders DESC NULLS LAST
        LIMIT p_limit
      ) c
    ), '[]'::json),
    'products', COALESCE((
      SELECT json_agg(row_to_json(p))
      FROM (
        SELECT id, sku, name, stock_quantity, selling_price, cost_price, status, image_url
        FROM products
        WHERE sku ILIKE q_like
           OR name ILIKE q_like
           OR barcode ILIKE q_like
        ORDER BY
          CASE WHEN lower(sku) = lower(q) THEN 0
               WHEN lower(sku) LIKE lower(q) || '%' THEN 1
               ELSE 2 END,
          name
        LIMIT p_limit
      ) p
    ), '[]'::json)
  ) INTO result;
  RETURN result;
END;
$$;
