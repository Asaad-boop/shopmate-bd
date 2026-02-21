
-- Create courier_history table for tracking courier deliveries per customer
CREATE TABLE public.courier_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone CHARACTER VARYING NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  courier_name CHARACTER VARYING NOT NULL,
  tracking_id CHARACTER VARYING,
  status CHARACTER VARYING DEFAULT 'pending',
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.courier_history ENABLE ROW LEVEL SECURITY;

-- Allow all access (matching existing pattern)
CREATE POLICY "Allow all access to courier_history"
  ON public.courier_history
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Index for phone lookups
CREATE INDEX idx_courier_history_phone ON public.courier_history(phone);
CREATE INDEX idx_courier_history_order_id ON public.courier_history(order_id);
