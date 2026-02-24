
-- FULL FRESH RESET
SET session_replication_role = 'replica';

TRUNCATE TABLE
  public.order_items, public.order_costs, public.order_activity_log, public.orders,
  public.returns, public.damage_log,
  public.courier_cost_events, public.courier_settlement_allocations, public.courier_shipments,
  public.courier_statement_lines, public.courier_statements, public.courier_settlements_v2,
  public.cod_settlement_lines, public.cod_settlements, public.courier_history,
  public.shipments, public.settlement_exceptions, public.reconciliation_exceptions,
  public.expense_allocation_lines, public.expense_allocations,
  public.expenses, public.expenses_v2, public.ad_expenses,
  public.po_payments, public.po_timeline, public.purchase_order_items, public.purchase_orders,
  public.goods_receipt_items, public.goods_receipts,
  public.landed_cost_allocation_lines, public.landed_cost_allocations, public.landed_costs,
  public.supplier_payments, public.suppliers,
  public.inventory_movements, public.inventory_ledger,
  public.journal_lines, public.journal_entries,
  public.accounting_periods, public.accounting_period_locks, public.account_ledger,
  public.product_costs, public.product_cost_buckets, public.campaign_products, public.products,
  public.customer_followups, public.customer_qc_cache, public.customers,
  public.exception_events, public.exceptions,
  public.daily_pnl_cache, public.ad_campaigns, public.leads, public.notifications,
  public.receivables, public.address_corrections, public.legacy_import_batches, public.agents,
  public.audit_logs
CASCADE;

SET session_replication_role = 'origin';

ALTER SEQUENCE IF EXISTS public.invoice_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS public.employee_id_seq RESTART WITH 1;

INSERT INTO public.accounting_periods (period_key, start_date, end_date, status)
VALUES (
  to_char(CURRENT_DATE, 'YYYY-MM'),
  date_trunc('month', CURRENT_DATE)::date,
  (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day')::date,
  'open'
);

INSERT INTO public.settings (key, value, updated_at)
VALUES ('shopify_sync_enabled', 'false', now())
ON CONFLICT (key) DO UPDATE SET value = 'false', updated_at = now();

INSERT INTO public.audit_logs (entity_type, entity_id, action, after_json)
VALUES (
  'system',
  gen_random_uuid(),
  'FULL_FRESH_RESET',
  jsonb_build_object('timestamp', now(), 'description', 'Complete ERP data reset - all transactional data deleted, sequences reset, Shopify sync disabled')
);
