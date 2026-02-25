-- Add avg cost before/after to allocation lines for impact tracking
ALTER TABLE public.landed_cost_allocation_lines
  ADD COLUMN IF NOT EXISTS avg_cost_before numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_cost_after numeric DEFAULT 0;

-- Add finalized flag and admin override tracking to allocations
ALTER TABLE public.landed_cost_allocations
  ADD COLUMN IF NOT EXISTS is_finalized boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS finalized_at timestamptz,
  ADD COLUMN IF NOT EXISTS finalized_by text,
  ADD COLUMN IF NOT EXISTS admin_override_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_override_by text,
  ADD COLUMN IF NOT EXISTS admin_override_reason text;