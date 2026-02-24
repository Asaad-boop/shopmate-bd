
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS legacy_status text,
  ADD COLUMN IF NOT EXISTS courier_final_status text;

COMMENT ON COLUMN public.orders.legacy_status IS 'Original status from Excel import — read-only, never overwritten';
COMMENT ON COLUMN public.orders.courier_final_status IS 'Final status from courier sync/statement — source of truth';
