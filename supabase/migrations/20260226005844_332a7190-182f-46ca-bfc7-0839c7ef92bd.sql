
-- ============================================================
-- EXCHANGE MODULE: 3 core tables
-- ============================================================

-- 1. exchange_requests: master record per exchange
CREATE TABLE public.exchange_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id),
  exchange_number text UNIQUE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','reverse_in_transit','reverse_received','replacement_sent','completed','cancelled')),
  reason text NOT NULL,
  exchange_type text NOT NULL DEFAULT 'different'
    CHECK (exchange_type IN ('same','different')),
  customer_phone text,
  customer_name text,
  price_difference numeric(12,2) NOT NULL DEFAULT 0,
  courier_cost_total numeric(12,2) NOT NULL DEFAULT 0,
  damaged_loss numeric(12,2) NOT NULL DEFAULT 0,
  net_exchange_cost numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  approved_at timestamptz,
  approved_by text,
  reverse_received_at timestamptz,
  replacement_sent_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Auto-generate exchange number
CREATE OR REPLACE FUNCTION public.generate_exchange_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  seq_num int;
BEGIN
  SELECT COUNT(*) + 1 INTO seq_num FROM public.exchange_requests;
  NEW.exchange_number := 'EXC-' || LPAD(seq_num::text, 6, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_exchange_number
  BEFORE INSERT ON public.exchange_requests
  FOR EACH ROW
  WHEN (NEW.exchange_number IS NULL)
  EXECUTE FUNCTION public.generate_exchange_number();

-- 2. exchange_items: old → new product mapping
CREATE TABLE public.exchange_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_id uuid NOT NULL REFERENCES public.exchange_requests(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('return','replacement')),
  product_id uuid REFERENCES public.products(id),
  product_name text NOT NULL,
  sku text,
  quantity int NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  condition text DEFAULT 'good' CHECK (condition IN ('good','damaged','defective')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. exchange_shipments: reverse & replacement courier tracking
CREATE TABLE public.exchange_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_id uuid NOT NULL REFERENCES public.exchange_requests(id) ON DELETE CASCADE,
  shipment_type text NOT NULL CHECK (shipment_type IN ('reverse','replacement')),
  courier_name text,
  tracking_id text,
  cod_amount numeric(12,2) NOT NULL DEFAULT 0,
  courier_cost numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','booked','in_transit','delivered','returned','failed')),
  shipped_at timestamptz,
  delivered_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_exchange_requests_order ON public.exchange_requests(order_id);
CREATE INDEX idx_exchange_requests_status ON public.exchange_requests(status);
CREATE INDEX idx_exchange_items_exchange ON public.exchange_items(exchange_id);
CREATE INDEX idx_exchange_shipments_exchange ON public.exchange_shipments(exchange_id);

-- RLS
ALTER TABLE public.exchange_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON public.exchange_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON public.exchange_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON public.exchange_shipments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Anon read for dev
CREATE POLICY "Allow anon read exchange_requests" ON public.exchange_requests FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon all exchange_requests" ON public.exchange_requests FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon all exchange_items" ON public.exchange_items FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon all exchange_shipments" ON public.exchange_shipments FOR ALL TO anon USING (true) WITH CHECK (true);
