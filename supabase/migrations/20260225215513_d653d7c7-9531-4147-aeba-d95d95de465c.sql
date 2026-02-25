
-- Import Shipments table
CREATE TABLE IF NOT EXISTS public.import_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_number text NOT NULL,
  supplier_id uuid REFERENCES public.suppliers(id),
  agent_id uuid REFERENCES public.agents(id),
  status text NOT NULL DEFAULT 'in_transit',
  freight_cost numeric NOT NULL DEFAULT 0,
  customs_cost numeric NOT NULL DEFAULT 0,
  local_transport numeric NOT NULL DEFAULT 0,
  other_charges numeric NOT NULL DEFAULT 0,
  total_landed_cost numeric GENERATED ALWAYS AS (freight_cost + customs_cost + local_transport + other_charges) STORED,
  is_finalized boolean NOT NULL DEFAULT false,
  finalized_at timestamptz,
  finalized_by text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Link table for import → PO relationship (many-to-many)
CREATE TABLE IF NOT EXISTS public.import_shipment_pos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_shipment_id uuid NOT NULL REFERENCES public.import_shipments(id) ON DELETE CASCADE,
  po_id uuid NOT NULL REFERENCES public.purchase_orders(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(import_shipment_id, po_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_import_shipments_status ON public.import_shipments(status);
CREATE INDEX IF NOT EXISTS idx_import_shipments_supplier ON public.import_shipments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_import_shipment_pos_shipment ON public.import_shipment_pos(import_shipment_id);
CREATE INDEX IF NOT EXISTS idx_import_shipment_pos_po ON public.import_shipment_pos(po_id);
