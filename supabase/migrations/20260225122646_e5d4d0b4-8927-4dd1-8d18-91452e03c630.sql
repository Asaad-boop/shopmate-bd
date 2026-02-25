
-- Add courier sync tracking fields to orders table
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS courier_sync_status text NOT NULL DEFAULT 'NOT_SYNCED',
  ADD COLUMN IF NOT EXISTS courier_last_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS courier_last_sync_error text,
  ADD COLUMN IF NOT EXISTS settlement_journal_id uuid REFERENCES public.journal_entries(id),
  ADD COLUMN IF NOT EXISTS settlement_posted_at timestamptz;
