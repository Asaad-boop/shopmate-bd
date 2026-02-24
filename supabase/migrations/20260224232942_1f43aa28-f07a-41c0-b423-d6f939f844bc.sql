
-- Fix precision on orders table courier charge columns
ALTER TABLE public.orders
  ALTER COLUMN courier_delivery_fee TYPE numeric(12,2),
  ALTER COLUMN courier_cod_fee TYPE numeric(12,2),
  ALTER COLUMN courier_discount TYPE numeric(12,2),
  ALTER COLUMN courier_promo_discount TYPE numeric(12,2),
  ALTER COLUMN courier_additional_charge TYPE numeric(12,2),
  ALTER COLUMN courier_compensation_cost TYPE numeric(12,2),
  ALTER COLUMN courier_total_cost TYPE numeric(12,2),
  ALTER COLUMN courier_net_payable TYPE numeric(12,2),
  ALTER COLUMN courier_return_cost TYPE numeric(12,2);

-- Fix precision on courier_shipments columns that are missing it
ALTER TABLE public.courier_shipments
  ALTER COLUMN courier_promo_discount TYPE numeric(12,2),
  ALTER COLUMN courier_additional_charge TYPE numeric(12,2),
  ALTER COLUMN courier_compensation_cost TYPE numeric(12,2);
