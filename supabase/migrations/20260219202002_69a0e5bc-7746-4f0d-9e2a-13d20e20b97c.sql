
-- Create customer QC cache table for BD Courier data
CREATE TABLE public.customer_qc_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone VARCHAR NOT NULL,
  success_rate DECIMAL,
  total_orders INT DEFAULT 0,
  successful_orders INT DEFAULT 0,
  returned_orders INT DEFAULT 0,
  cancelled_orders INT DEFAULT 0,
  raw_data JSONB,
  last_fetched_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Unique on phone
CREATE UNIQUE INDEX idx_customer_qc_cache_phone ON public.customer_qc_cache(phone);

-- Enable RLS
ALTER TABLE public.customer_qc_cache ENABLE ROW LEVEL SECURITY;

-- Allow all access (no auth yet)
CREATE POLICY "Allow all access to customer_qc_cache" ON public.customer_qc_cache FOR ALL USING (true) WITH CHECK (true);
