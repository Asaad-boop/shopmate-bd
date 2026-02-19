
-- Add web_order_status column to orders for the web orders workflow
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS web_order_status character varying DEFAULT NULL;

-- Add tags column to orders
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- Create index for web order queries
CREATE INDEX IF NOT EXISTS idx_orders_web_order_status ON public.orders(web_order_status);
CREATE INDEX IF NOT EXISTS idx_orders_channel_web_status ON public.orders(channel, web_order_status);

-- Create web_order_notes table for call logs, notes, and activity
CREATE TABLE IF NOT EXISTS public.web_order_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  note_type character varying NOT NULL DEFAULT 'note', -- 'note', 'call_log', 'status_change', 'activity'
  content text,
  call_result character varying, -- 'answered', 'no_answer', 'busy', 'voicemail'
  old_status character varying,
  new_status character varying,
  created_by character varying, -- staff name or id
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on web_order_notes
ALTER TABLE public.web_order_notes ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (no auth implemented)
CREATE POLICY "Allow all access to web_order_notes" ON public.web_order_notes FOR ALL USING (true) WITH CHECK (true);

-- Update existing shopify orders to have web_order_status = 'processing' if they are pending
UPDATE public.orders 
SET web_order_status = 'processing' 
WHERE channel = 'shopify' AND status = 'pending' AND web_order_status IS NULL;
