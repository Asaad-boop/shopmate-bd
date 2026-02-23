
-- Add missing columns to accounts
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS account_number character varying;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Add missing columns to transactions
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS auto_generated boolean DEFAULT false;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS source_module character varying;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS source_id uuid;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS payment_method character varying;

-- Create payables table
CREATE TABLE public.payables (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  party_name character varying NOT NULL,
  category character varying DEFAULT 'other',
  description text,
  total_amount numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
  due_date date,
  status character varying DEFAULT 'upcoming',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.payables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to payables" ON public.payables FOR ALL USING (true) WITH CHECK (true);

-- Create receivables table
CREATE TABLE public.receivables (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source character varying NOT NULL DEFAULT 'cod',
  description text,
  reference character varying,
  expected_date date,
  amount numeric NOT NULL DEFAULT 0,
  status character varying DEFAULT 'expected',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.receivables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to receivables" ON public.receivables FOR ALL USING (true) WITH CHECK (true);

-- Enable RLS on accounts if not already
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to accounts" ON public.accounts;
CREATE POLICY "Allow all access to accounts" ON public.accounts FOR ALL USING (true) WITH CHECK (true);
