
CREATE TABLE IF NOT EXISTS public.bdcourier_api_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_date date NOT NULL DEFAULT CURRENT_DATE,
  phone_number text,
  success boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bdcourier_log_date ON public.bdcourier_api_log(call_date);

ALTER TABLE public.bdcourier_api_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read bdcourier logs"
  ON public.bdcourier_api_log FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert bdcourier logs"
  ON public.bdcourier_api_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Service role full access bdcourier logs"
  ON public.bdcourier_api_log FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
