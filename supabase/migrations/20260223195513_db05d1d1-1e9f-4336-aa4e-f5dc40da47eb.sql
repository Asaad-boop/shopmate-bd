
-- ============================================
-- PHASE 4: INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_account_ledger_account ON public.account_ledger(account_id);
CREATE INDEX IF NOT EXISTS idx_account_ledger_date ON public.account_ledger(ledger_date);
CREATE INDEX IF NOT EXISTS idx_account_ledger_ref ON public.account_ledger(ref_type, ref_id);

CREATE INDEX IF NOT EXISTS idx_shipments_order ON public.shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_consignment ON public.shipments(consignment_id);

CREATE INDEX IF NOT EXISTS idx_cod_lines_settlement ON public.cod_settlement_lines(settlement_id);
CREATE INDEX IF NOT EXISTS idx_cod_lines_order ON public.cod_settlement_lines(order_id);
CREATE INDEX IF NOT EXISTS idx_cod_lines_consignment ON public.cod_settlement_lines(consignment_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_delivered_at ON public.orders(delivered_at);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);

CREATE INDEX IF NOT EXISTS idx_inv_movements_product ON public.inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inv_movements_type ON public.inventory_movements(movement_type);

CREATE INDEX IF NOT EXISTS idx_order_costs_order ON public.order_costs(order_id);

-- ============================================
-- PHASE 5: REPORTING VIEWS
-- ============================================

-- 5A: Account balances from ledger (source of truth)
CREATE OR REPLACE VIEW public.v_account_balances AS
SELECT
  a.id,
  a.name,
  a.type,
  a.account_number,
  COALESCE(SUM(CASE WHEN al.direction = 'in' THEN al.amount ELSE 0 END), 0) AS total_in,
  COALESCE(SUM(CASE WHEN al.direction = 'out' THEN al.amount ELSE 0 END), 0) AS total_out,
  COALESCE(SUM(CASE WHEN al.direction = 'in' THEN al.amount ELSE -al.amount END), 0) AS balance
FROM public.accounts a
LEFT JOIN public.account_ledger al ON al.account_id = a.id
WHERE a.is_active = true
GROUP BY a.id, a.name, a.type, a.account_number;

-- 5B: Stock on hand from inventory movements (ledger-based)
CREATE OR REPLACE VIEW public.v_stock_on_hand AS
SELECT
  p.id AS product_id,
  p.name,
  p.sku,
  p.avg_cost,
  COALESCE(SUM(im.qty_in - im.qty_out), 0) AS on_hand_qty,
  COALESCE(SUM(CASE WHEN im.movement_type = 'reserve' THEN im.qty_out
                     WHEN im.movement_type = 'release' THEN -im.qty_out ELSE 0 END), 0) AS reserved_qty,
  COALESCE(SUM(im.qty_in - im.qty_out), 0) -
  COALESCE(SUM(CASE WHEN im.movement_type = 'reserve' THEN im.qty_out
                     WHEN im.movement_type = 'release' THEN -im.qty_out ELSE 0 END), 0) AS available_qty,
  COALESCE(SUM(im.qty_in - im.qty_out), 0) * COALESCE(p.avg_cost, 0) AS stock_value
FROM public.products p
LEFT JOIN public.inventory_movements im ON im.product_id = p.id
WHERE p.status = 'active'
GROUP BY p.id, p.name, p.sku, p.avg_cost;

-- 5C: Daily P&L view (delivered-based)
CREATE OR REPLACE VIEW public.v_daily_pnl AS
SELECT
  DATE(o.delivered_at) AS pnl_date,
  COUNT(DISTINCT o.id) AS delivered_orders,
  COALESCE(SUM(o.total_amount), 0) AS revenue,
  COALESCE(SUM(oi_agg.cogs), 0) AS cogs,
  COALESCE(SUM(oc.courier_actual_charge), SUM(oc.courier_expected_charge), 0) AS courier_cost,
  COALESCE(SUM(oc.packaging_cost), 0) AS packaging_cost,
  COALESCE(SUM(oc.payment_gateway_fee), 0) AS gateway_fee,
  COALESCE(SUM(oc.cod_fee), 0) AS cod_fee,
  COALESCE(SUM(oc.return_handling_cost), 0) AS return_cost,
  COALESCE(SUM(o.total_amount), 0)
    - COALESCE(SUM(oi_agg.cogs), 0)
    - COALESCE(SUM(COALESCE(oc.courier_actual_charge, oc.courier_expected_charge)), 0)
    - COALESCE(SUM(oc.packaging_cost), 0)
    - COALESCE(SUM(oc.payment_gateway_fee), 0)
    - COALESCE(SUM(oc.cod_fee), 0)
    - COALESCE(SUM(oc.return_handling_cost), 0) AS gross_profit,
  COALESCE(SUM(COALESCE(oc.courier_actual_charge, oc.courier_expected_charge) - o.delivery_charge), 0) AS courier_subsidy
FROM public.orders o
LEFT JOIN public.order_costs oc ON oc.order_id = o.id
LEFT JOIN (
  SELECT order_id, SUM(cogs_total) AS cogs
  FROM public.order_items
  GROUP BY order_id
) oi_agg ON oi_agg.order_id = o.id
WHERE o.delivered_at IS NOT NULL
  AND o.status IN ('delivered', 'completed')
GROUP BY DATE(o.delivered_at);

-- 5D: Monthly P&L view
CREATE OR REPLACE VIEW public.v_monthly_pnl AS
SELECT
  DATE_TRUNC('month', pnl_date)::date AS pnl_month,
  SUM(delivered_orders) AS delivered_orders,
  SUM(revenue) AS revenue,
  SUM(cogs) AS cogs,
  SUM(courier_cost) AS courier_cost,
  SUM(packaging_cost) AS packaging_cost,
  SUM(gateway_fee) AS gateway_fee,
  SUM(cod_fee) AS cod_fee,
  SUM(return_cost) AS return_cost,
  SUM(gross_profit) AS gross_profit,
  SUM(courier_subsidy) AS courier_subsidy
FROM public.v_daily_pnl
GROUP BY DATE_TRUNC('month', pnl_date);

-- 5E: Daily cashflow view
CREATE OR REPLACE VIEW public.v_daily_cashflow AS
SELECT
  al.ledger_date,
  a.name AS account_name,
  a.type AS account_type,
  COALESCE(SUM(CASE WHEN al.direction = 'in' THEN al.amount ELSE 0 END), 0) AS cash_in,
  COALESCE(SUM(CASE WHEN al.direction = 'out' THEN al.amount ELSE 0 END), 0) AS cash_out,
  COALESCE(SUM(CASE WHEN al.direction = 'in' THEN al.amount ELSE -al.amount END), 0) AS net_flow
FROM public.account_ledger al
JOIN public.accounts a ON a.id = al.account_id
GROUP BY al.ledger_date, a.name, a.type
ORDER BY al.ledger_date DESC;
