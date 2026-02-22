
-- Create agents table
CREATE TABLE public.agents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR NOT NULL,
  phone VARCHAR,
  whatsapp VARCHAR,
  bkash_number VARCHAR,
  nagad_number VARCHAR,
  bank_account VARCHAR,
  bank_name VARCHAR,
  notes TEXT,
  rating INTEGER DEFAULT 5,
  total_orders INTEGER DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add import_type and agent_id to purchase_orders
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS import_type VARCHAR DEFAULT 'DIRECT',
  ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES public.agents(id);

-- Add payment_type to po_payments
ALTER TABLE public.po_payments
  ADD COLUMN IF NOT EXISTS payment_type VARCHAR DEFAULT 'OTHER';

-- Enable RLS on agents
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

-- RLS policy for agents (public access like other tables)
CREATE POLICY "Allow all access to agents" ON public.agents FOR ALL USING (true) WITH CHECK (true);
