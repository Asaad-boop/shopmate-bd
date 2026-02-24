ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS courier_promo_discount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS courier_additional_charge numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS courier_compensation_cost numeric DEFAULT 0;

ALTER TABLE public.courier_shipments 
ADD COLUMN IF NOT EXISTS courier_promo_discount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS courier_additional_charge numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS courier_compensation_cost numeric DEFAULT 0;