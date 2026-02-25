
-- Add agent_id FK to suppliers
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS agent_id uuid REFERENCES public.agents(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_suppliers_agent_id ON public.suppliers(agent_id);

-- Create a view for supplier financial summary
CREATE OR REPLACE VIEW public.v_supplier_financials AS
SELECT
  s.id AS supplier_id,
  COALESCE(po_agg.total_purchase_value, 0) AS total_purchase_value,
  COALESCE(po_agg.open_po_count, 0) AS open_po_count,
  COALESCE(pay_agg.total_paid, 0) AS total_paid,
  COALESCE(po_agg.total_purchase_value, 0) - COALESCE(pay_agg.total_paid, 0) AS total_due
FROM public.suppliers s
LEFT JOIN LATERAL (
  SELECT
    SUM(po.total_landed_cost_bdt) AS total_purchase_value,
    COUNT(*) FILTER (WHERE po.status NOT IN ('closed', 'cancelled')) AS open_po_count
  FROM public.purchase_orders po
  WHERE po.supplier_id = s.id
) po_agg ON true
LEFT JOIN LATERAL (
  SELECT SUM(sp.amount) AS total_paid
  FROM public.supplier_payments sp
  WHERE sp.supplier_id = s.id AND sp.status = 'posted'
) pay_agg ON true;
