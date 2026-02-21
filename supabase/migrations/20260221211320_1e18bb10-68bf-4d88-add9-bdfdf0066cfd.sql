
-- Create address_corrections table for learning from manual corrections
CREATE TABLE public.address_corrections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  raw_address TEXT NOT NULL,
  raw_area_text TEXT,
  detected_zone TEXT,
  detected_area TEXT,
  corrected_zone TEXT,
  corrected_area TEXT,
  detected_city TEXT,
  corrected_city TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.address_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to address_corrections"
ON public.address_corrections
FOR ALL
USING (true)
WITH CHECK (true);

-- Add address parsing columns to orders
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS parsed_address_confidence REAL DEFAULT NULL,
ADD COLUMN IF NOT EXISTS needs_address_review BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS address_parse_log JSONB DEFAULT NULL;
