
-- ============================================
-- FUNCTIONS
-- ============================================

CREATE SEQUENCE IF NOT EXISTS invoice_seq START 1;

CREATE OR REPLACE FUNCTION generate_invoice_id()
RETURNS text AS $$
DECLARE
  yr text := to_char(now() AT TIME ZONE 'Asia/Dhaka', 'YYYY');
  seq text := lpad(nextval('invoice_seq')::text, 5, '0');
BEGIN
  RETURN 'INV-' || yr || '-' || seq;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION fn_assign_invoice_id()
RETURNS trigger AS $$
BEGIN
  IF NEW.invoice_id IS NULL AND OLD.status = 'pending' AND NEW.status != 'pending' THEN
    NEW.invoice_id := generate_invoice_id();
    NEW.confirmed_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_validate_status_transition()
RETURNS trigger AS $$
BEGIN
  IF OLD.status IN ('shipped', 'in_transit') AND NEW.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot cancel order in status: %. Must go through return flow.', OLD.status;
  END IF;
  IF NEW.status = 'partially_delivered' AND NEW.partial_confirmed = false THEN
    RAISE EXCEPTION 'Partial delivery must be confirmed first.';
  END IF;
  IF NEW.status = 'returned' AND NEW.return_condition IS NULL THEN
    RAISE EXCEPTION 'Must set return_condition before marking as returned.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_exchange_rate(p_currency text, p_date date)
RETURNS numeric AS $$
DECLARE r numeric;
BEGIN
  SELECT rate INTO r FROM exchange_rates
  WHERE currency = p_currency AND rate_date <= p_date
  ORDER BY rate_date DESC LIMIT 1;
  RETURN COALESCE(r, 110);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION calc_cod_fee(p_courier text, p_zone text, p_cod_amount numeric)
RETURNS numeric AS $$
DECLARE
  v_rate courier_rate_cards%ROWTYPE;
  fee numeric;
BEGIN
  SELECT * INTO v_rate FROM courier_rate_cards
  WHERE courier_name = p_courier AND service_area = p_zone AND is_active = true
  AND effective_from <= CURRENT_DATE AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
  ORDER BY effective_from DESC LIMIT 1;
  IF NOT FOUND THEN RETURN 0; END IF;
  fee := p_cod_amount * COALESCE(v_rate.cod_fee_percent, 1) / 100;
  fee := GREATEST(fee, COALESCE(v_rate.cod_minimum, 0));
  fee := LEAST(fee, COALESCE(v_rate.cod_maximum, 999999));
  RETURN ROUND(fee, 2);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION calc_weighted_avg_cost(p_product_id uuid, p_new_qty integer, p_new_cost numeric)
RETURNS numeric AS $$
DECLARE
  curr_available integer := 0;
  curr_avg numeric := 0;
  new_avg numeric;
BEGIN
  SELECT
    COALESCE(SUM(CASE WHEN txn_type IN ('stock_in','release','return_good','adjust_in') THEN qty_in ELSE 0 END)
    - SUM(CASE WHEN txn_type IN ('reserve','damage_write_off','adjust_out') THEN qty_out ELSE 0 END), 0),
    COALESCE((SELECT running_avg_cost FROM inventory_ledger WHERE product_id = p_product_id ORDER BY created_at DESC LIMIT 1), 0)
  INTO curr_available, curr_avg
  FROM inventory_ledger WHERE product_id = p_product_id;
  IF curr_available <= 0 THEN RETURN p_new_cost; END IF;
  new_avg := ((curr_available * curr_avg) + (p_new_qty * p_new_cost)) / (curr_available + p_new_qty);
  RETURN ROUND(new_avg, 4);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION reverse_ledger_entry(p_entry_id uuid, p_reason text, p_user_id uuid)
RETURNS uuid AS $$
DECLARE
  orig account_ledger%ROWTYPE;
  new_id uuid;
BEGIN
  SELECT * INTO orig FROM account_ledger WHERE id = p_entry_id AND COALESCE(is_reversal, false) = false;
  IF NOT FOUND THEN RAISE EXCEPTION 'Entry not found or already reversed'; END IF;
  INSERT INTO account_ledger (ledger_date, account_id, direction, amount, ref_type, ref_id, note, created_by)
  VALUES (CURRENT_DATE, orig.account_id, CASE WHEN orig.direction = 'in' THEN 'out' ELSE 'in' END,
    orig.amount, 'reversal', orig.id, 'REVERSAL: ' || p_reason, p_user_id)
  RETURNING id INTO new_id;
  UPDATE account_ledger SET is_reversal = true, reversed_entry_id = new_id, reversed_by = p_user_id, reversed_at = now()
  WHERE id = p_entry_id;
  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION adjust_inventory(p_product_id uuid, p_sku text, p_qty_change integer, p_reason text, p_user_id uuid)
RETURNS void AS $$
BEGIN
  IF p_qty_change > 0 THEN
    INSERT INTO inventory_ledger (product_id, sku, txn_type, qty_in, reference_type, note, created_by)
    VALUES (p_product_id, p_sku, 'adjust_in', p_qty_change, 'adjustment', 'ADJUSTMENT: ' || p_reason, p_user_id);
  ELSE
    INSERT INTO inventory_ledger (product_id, sku, txn_type, qty_out, reference_type, note, created_by)
    VALUES (p_product_id, p_sku, 'adjust_out', ABS(p_qty_change), 'adjustment', 'ADJUSTMENT: ' || p_reason, p_user_id);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION fn_audit_log()
RETURNS trigger AS $$
BEGIN
  INSERT INTO audit_logs (entity_type, entity_id, action, before_json, after_json, created_at)
  VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    CASE WHEN TG_OP != 'INSERT' THEN row_to_json(OLD)::jsonb END,
    CASE WHEN TG_OP != 'DELETE' THEN row_to_json(NEW)::jsonb END,
    now()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS trg_assign_invoice ON orders;
CREATE TRIGGER trg_assign_invoice BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION fn_assign_invoice_id();

DROP TRIGGER IF EXISTS trg_validate_status ON orders;
CREATE TRIGGER trg_validate_status BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION fn_validate_status_transition();

DROP TRIGGER IF EXISTS audit_inventory_ledger ON inventory_ledger;
CREATE TRIGGER audit_inventory_ledger AFTER INSERT OR UPDATE ON inventory_ledger FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

DROP TRIGGER IF EXISTS audit_account_ledger ON account_ledger;
CREATE TRIGGER audit_account_ledger AFTER INSERT OR UPDATE ON account_ledger FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

DROP TRIGGER IF EXISTS audit_expenses ON expenses;
CREATE TRIGGER audit_expenses AFTER INSERT OR UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

DROP TRIGGER IF EXISTS audit_shipments ON shipments;
CREATE TRIGGER audit_shipments AFTER INSERT OR UPDATE ON shipments FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

DROP TRIGGER IF EXISTS audit_orders_status ON orders;
CREATE TRIGGER audit_orders_status AFTER UPDATE OF status ON orders FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ============================================
-- VIEW
-- ============================================

CREATE OR REPLACE VIEW v_stock_onhand AS
SELECT
  il.product_id,
  il.sku,
  SUM(CASE WHEN txn_type IN ('stock_in', 'release', 'return_good', 'adjust_in') THEN qty_in ELSE 0 END)
  - SUM(CASE WHEN txn_type IN ('reserve', 'damage_write_off', 'adjust_out') THEN qty_out ELSE 0 END) AS available,
  SUM(CASE WHEN txn_type = 'reserve' THEN qty_out ELSE 0 END)
  - SUM(CASE WHEN txn_type = 'release' THEN qty_in ELSE 0 END) AS reserved,
  SUM(CASE WHEN txn_type = 'shipped' THEN qty_out ELSE 0 END)
  - SUM(CASE WHEN txn_type IN ('delivered', 'return_good', 'return_damaged') THEN qty_in ELSE 0 END) AS in_transit,
  SUM(CASE WHEN txn_type = 'return_damaged' THEN qty_in ELSE 0 END)
  - SUM(CASE WHEN txn_type = 'damage_write_off' THEN qty_out ELSE 0 END) AS damaged,
  SUM(qty_in) - SUM(qty_out) AS total_physical,
  (SELECT running_avg_cost FROM inventory_ledger il2 WHERE il2.product_id = il.product_id ORDER BY il2.created_at DESC LIMIT 1) AS avg_unit_cost,
  MAX(il.created_at) AS last_movement
FROM inventory_ledger il
GROUP BY il.product_id, il.sku;

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_orders_invoice ON orders(invoice_id);
CREATE INDEX IF NOT EXISTS idx_orders_source ON orders(order_source);
CREATE INDEX IF NOT EXISTS idx_inv_ledger_product ON inventory_ledger(product_id);
CREATE INDEX IF NOT EXISTS idx_inv_ledger_txn_type ON inventory_ledger(txn_type);
CREATE INDEX IF NOT EXISTS idx_inv_ledger_date ON inventory_ledger(txn_date);
CREATE INDEX IF NOT EXISTS idx_inv_ledger_ref ON inventory_ledger(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_shipments_order ON shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_courier ON shipments(courier_name);
CREATE INDEX IF NOT EXISTS idx_shipments_settlement ON shipments(settlement_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_product ON expenses(product_id);
CREATE INDEX IF NOT EXISTS idx_pnl_cache_date ON daily_pnl_cache(pnl_date);
CREATE INDEX IF NOT EXISTS idx_pnl_cache_product ON daily_pnl_cache(product_id);
CREATE INDEX IF NOT EXISTS idx_settlement_exceptions_settlement ON settlement_exceptions(settlement_id);
CREATE INDEX IF NOT EXISTS idx_product_costs_product ON product_costs(product_id);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_lookup ON exchange_rates(currency, rate_date);

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_pnl_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_exceptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access" ON exchange_rates;
CREATE POLICY "Allow all access" ON exchange_rates FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all access" ON inventory_ledger;
CREATE POLICY "Allow all access" ON inventory_ledger FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all access" ON shipments;
CREATE POLICY "Allow all access" ON shipments FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all access" ON product_costs;
CREATE POLICY "Allow all access" ON product_costs FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all access" ON expenses;
CREATE POLICY "Allow all access" ON expenses FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all access" ON daily_pnl_cache;
CREATE POLICY "Allow all access" ON daily_pnl_cache FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all access" ON settlement_exceptions;
CREATE POLICY "Allow all access" ON settlement_exceptions FOR ALL USING (true) WITH CHECK (true);

-- No-delete on financial tables
DROP POLICY IF EXISTS "no_delete_inventory_ledger" ON inventory_ledger;
CREATE POLICY "no_delete_inventory_ledger" ON inventory_ledger FOR DELETE TO authenticated USING (false);
DROP POLICY IF EXISTS "no_delete_expenses" ON expenses;
CREATE POLICY "no_delete_expenses" ON expenses FOR DELETE TO authenticated USING (false);
DROP POLICY IF EXISTS "no_delete_shipments" ON shipments;
CREATE POLICY "no_delete_shipments" ON shipments FOR DELETE TO authenticated USING (false);
