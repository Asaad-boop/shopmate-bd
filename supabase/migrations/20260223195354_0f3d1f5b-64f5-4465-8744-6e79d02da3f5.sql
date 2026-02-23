
-- ============================================
-- ACCOUNTING-GRADE ERP SCHEMA UPGRADE
-- Phase 1: Add missing columns to existing tables
-- ============================================

-- 1A: orders — add delivered_at, cancelled_at for date-based P&L
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz DEFAULT NULL;

-- 1B: products — add avg_cost (weighted average) and cost_method
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS avg_cost numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_method varchar DEFAULT 'WAVG';

-- 1C: inventory_movements — add qty_in, qty_out, unit_cost for proper ledger
ALTER TABLE public.inventory_movements
  ADD COLUMN IF NOT EXISTS qty_in integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qty_out integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unit_cost numeric DEFAULT 0;

-- 1D: order_items — add cogs_total (finalized on delivery)
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS cogs_total numeric DEFAULT 0;
