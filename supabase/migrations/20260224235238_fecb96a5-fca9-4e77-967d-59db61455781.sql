
-- Add advance payment columns to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS advance_amount numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS advance_method text,
  ADD COLUMN IF NOT EXISTS advance_posted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS advance_journal_id uuid REFERENCES public.journal_entries(id);

-- Add exchange columns
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS exchange_applied boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS exchange_reason text,
  ADD COLUMN IF NOT EXISTS exchange_applied_at timestamptz;

-- Add legacy stock sync flag to company_settings or as a simple config
-- We'll use a simple approach: add to orders table a per-order flag
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS legacy_stock_synced boolean DEFAULT false;

-- Seed account mappings for advance payments
INSERT INTO public.account_mappings (mapping_key, description)
VALUES
  ('advance_bkash', 'bKash account for advance payments'),
  ('advance_nagad', 'Nagad account for advance payments'),
  ('advance_bank', 'Bank account for advance payments'),
  ('advance_cash', 'Cash account for advance payments'),
  ('customer_advance_liability', 'Customer Advance Liability (liability account)')
ON CONFLICT (mapping_key) DO NOTHING;
