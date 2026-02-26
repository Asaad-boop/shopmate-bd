
-- Add new columns to accounts table for the enhanced Add Account form
ALTER TABLE public.accounts 
  ADD COLUMN IF NOT EXISTS owner_name text,
  ADD COLUMN IF NOT EXISTS account_nature text NOT NULL DEFAULT 'business',
  ADD COLUMN IF NOT EXISTS opening_balance numeric(12,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS opening_date date DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS ledger_classification text;

-- Create unique index on type + account_number to prevent duplicate accounts
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_type_number 
  ON public.accounts(type, account_number) 
  WHERE account_number IS NOT NULL AND account_number != '';
