
-- ============================================================
-- Phase 5: Exceptions Center
-- ============================================================

-- 1) exceptions table
CREATE TABLE public.exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  title text NOT NULL,
  description text,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','ignored')),
  source_module text NOT NULL CHECK (source_module IN ('orders','inventory','courier','accounting','expenses','purchasing','import','hrm')),
  source_entity_type text,
  source_entity_id text,
  detected_at timestamptz NOT NULL DEFAULT now(),
  detected_by text NOT NULL DEFAULT 'system' CHECK (detected_by IN ('system','user')),
  assigned_to text,
  resolution_notes text,
  resolved_at timestamptz,
  resolved_by text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_exceptions_status_severity ON public.exceptions (status, severity);
CREATE INDEX idx_exceptions_source_module ON public.exceptions (source_module);
CREATE INDEX idx_exceptions_source_entity ON public.exceptions (source_entity_id);
CREATE INDEX idx_exceptions_code ON public.exceptions (code);

-- 2) exception_rules table
CREATE TABLE public.exception_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  module text NOT NULL CHECK (module IN ('orders','inventory','courier','accounting','expenses','purchasing','import','hrm')),
  schedule text NOT NULL DEFAULT 'daily',
  is_active boolean NOT NULL DEFAULT true,
  config_json jsonb DEFAULT '{}',
  last_run_at timestamptz,
  last_run_result text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3) exception_events table
CREATE TABLE public.exception_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exception_id uuid NOT NULL REFERENCES public.exceptions(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('created','assigned','status_changed','commented','resolved','ignored','reopened')),
  message text,
  actor text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_exception_events_exception ON public.exception_events (exception_id);

-- Seed exception rules
INSERT INTO public.exception_rules (code, name, module, schedule) VALUES
  ('NEGATIVE_STOCK', 'Negative Stock Detection', 'inventory', 'daily'),
  ('RESERVED_EXCEEDS_ONHAND', 'Reserved Exceeds On-Hand', 'inventory', 'daily'),
  ('STOCK_LEDGER_MISMATCH', 'Stock Ledger vs Product Mismatch', 'inventory', 'daily'),
  ('DELIVERED_NOT_POSTED_TO_GL', 'Delivered Order Missing GL Posting', 'orders', 'daily'),
  ('COD_RECEIVED_NOT_POSTED', 'COD Settlement Missing GL Posting', 'orders', 'daily'),
  ('STATUS_INCONSISTENT', 'Order vs Courier Status Mismatch', 'orders', 'daily'),
  ('COURIER_COST_MISSING', 'Courier Cost Missing', 'courier', 'daily'),
  ('COURIER_COST_MISMATCH', 'Courier Cost Mismatch with Statement', 'courier', 'daily'),
  ('SHORT_PAYMENT', 'Short Payment from Courier', 'courier', 'daily'),
  ('UNKNOWN_TRACKING_ID', 'Unknown Tracking ID in Statement', 'courier', 'daily'),
  ('UNBALANCED_JOURNAL', 'Unbalanced Journal Entry', 'accounting', 'daily'),
  ('PERIOD_LOCK_VIOLATION', 'Period Lock Violation', 'accounting', 'daily'),
  ('ACCOUNT_MAPPING_MISSING', 'Required Account Mapping Missing', 'accounting', 'daily'),
  ('UNPOSTED_EXPENSE_STALE', 'Draft Expense Older Than Threshold', 'expenses', 'daily'),
  ('UNALLOCATED_MARKETING', 'Unallocated Marketing Expense', 'expenses', 'daily'),
  ('ALLOCATION_SUM_MISMATCH', 'Allocation Sum Mismatch', 'expenses', 'daily'),
  ('GRN_NOT_POSTED', 'GRN Not Posted', 'purchasing', 'daily'),
  ('PAYABLE_AGING_HIGH', 'High Supplier Payable Aging', 'purchasing', 'daily'),
  ('LANDED_COST_NOT_ALLOCATED', 'Landed Cost Not Allocated', 'purchasing', 'daily');
