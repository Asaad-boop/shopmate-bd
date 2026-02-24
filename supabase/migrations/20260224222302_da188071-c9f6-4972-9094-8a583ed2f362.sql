ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS courier_delivery_fee numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS courier_cod_fee numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS courier_discount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS courier_total_cost numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS courier_net_payable numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS courier_return_cost numeric DEFAULT 0;