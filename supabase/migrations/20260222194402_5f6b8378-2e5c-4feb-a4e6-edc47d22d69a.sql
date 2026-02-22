
-- Add missing columns to suppliers
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS alipay_id varchar,
  ADD COLUMN IF NOT EXISTS usdt_wallet varchar,
  ADD COLUMN IF NOT EXISTS usdt_network varchar DEFAULT 'TRC20',
  ADD COLUMN IF NOT EXISTS bank_account_name varchar,
  ADD COLUMN IF NOT EXISTS bank_account_number varchar,
  ADD COLUMN IF NOT EXISTS bank_name varchar,
  ADD COLUMN IF NOT EXISTS swift_code varchar,
  ADD COLUMN IF NOT EXISTS preferred_payment varchar DEFAULT 'alipay';

-- Create po_additional_costs table
CREATE TABLE IF NOT EXISTS public.po_additional_costs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  po_id uuid REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  label varchar NOT NULL,
  amount_bdt numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.po_additional_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to po_additional_costs" ON public.po_additional_costs FOR ALL USING (true) WITH CHECK (true);

-- Create po_payments table
CREATE TABLE IF NOT EXISTS public.po_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  po_id uuid REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL DEFAULT 0,
  currency varchar NOT NULL DEFAULT 'BDT',
  payment_method varchar DEFAULT 'alipay',
  transaction_id varchar,
  note text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.po_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to po_payments" ON public.po_payments FOR ALL USING (true) WITH CHECK (true);

-- Create po_timeline table
CREATE TABLE IF NOT EXISTS public.po_timeline (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  po_id uuid REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  stage integer NOT NULL,
  completed_at timestamptz,
  note text,
  done_by text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.po_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to po_timeline" ON public.po_timeline FOR ALL USING (true) WITH CHECK (true);

-- Add missing columns to purchase_orders
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS shipping_agent varchar,
  ADD COLUMN IF NOT EXISTS tracking_number varchar,
  ADD COLUMN IF NOT EXISTS port_of_entry varchar DEFAULT 'Chittagong',
  ADD COLUMN IF NOT EXISTS additional_costs_bdt numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS grand_total_bdt numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_per_unit_bdt numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- Add missing columns to purchase_order_items
ALTER TABLE public.purchase_order_items
  ADD COLUMN IF NOT EXISTS product_name varchar,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS unit varchar DEFAULT 'pcs',
  ADD COLUMN IF NOT EXISTS variant_note text,
  ADD COLUMN IF NOT EXISTS condition varchar DEFAULT 'good';
