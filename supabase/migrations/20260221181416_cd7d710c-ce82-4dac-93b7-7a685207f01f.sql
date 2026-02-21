
-- Create order_activity_log table for tracking all order actions
CREATE TABLE public.order_activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  done_by TEXT,
  details TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.order_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to order_activity_log"
ON public.order_activity_log
FOR ALL
USING (true)
WITH CHECK (true);

-- Index for fast lookups by order
CREATE INDEX idx_order_activity_log_order_id ON public.order_activity_log(order_id);
CREATE INDEX idx_order_activity_log_created_at ON public.order_activity_log(created_at DESC);
