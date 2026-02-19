
CREATE TABLE public.damage_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id),
  product_id UUID REFERENCES public.products(id),
  quantity INTEGER,
  condition VARCHAR(50),
  description TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.damage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to damage_log" ON public.damage_log FOR ALL USING (true) WITH CHECK (true);
