
-- Add import tracking columns to customers table
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS imported_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS import_batch_id uuid;

-- Create import_batches table to track import history
CREATE TABLE public.import_batches (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name text NOT NULL,
  total_rows integer NOT NULL DEFAULT 0,
  imported_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  duplicate_action text NOT NULL DEFAULT 'skip',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to import_batches"
ON public.import_batches FOR ALL
USING (true)
WITH CHECK (true);
