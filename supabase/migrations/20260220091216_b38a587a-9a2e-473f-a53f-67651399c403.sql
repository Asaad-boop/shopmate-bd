ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to products"
ON public.products
FOR ALL
USING (true)
WITH CHECK (true);