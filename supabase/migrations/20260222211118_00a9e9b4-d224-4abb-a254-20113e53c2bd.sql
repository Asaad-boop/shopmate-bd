
-- Add manual_segment and tags to customers
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS manual_segment varchar;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- Create customer_followups table
CREATE TABLE IF NOT EXISTS public.customer_followups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_phone varchar NOT NULL,
  note text,
  due_at timestamp with time zone NOT NULL,
  is_done boolean DEFAULT false,
  done_at timestamp with time zone,
  created_by varchar,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.customer_followups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to customer_followups" ON public.customer_followups FOR ALL USING (true) WITH CHECK (true);

-- Create leads table
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name varchar NOT NULL,
  phone varchar NOT NULL,
  source varchar DEFAULT 'other',
  stage varchar DEFAULT 'cold',
  note text,
  is_converted boolean DEFAULT false,
  converted_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to leads" ON public.leads FOR ALL USING (true) WITH CHECK (true);
