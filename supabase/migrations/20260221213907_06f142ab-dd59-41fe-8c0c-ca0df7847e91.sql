
-- Add frequency column to address_corrections for learning system
ALTER TABLE public.address_corrections ADD COLUMN IF NOT EXISTS frequency integer NOT NULL DEFAULT 1;
