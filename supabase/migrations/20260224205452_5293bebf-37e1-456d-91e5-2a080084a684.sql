CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_shopify_order_id_unique 
  ON public.orders (shopify_order_id) 
  WHERE shopify_order_id IS NOT NULL;