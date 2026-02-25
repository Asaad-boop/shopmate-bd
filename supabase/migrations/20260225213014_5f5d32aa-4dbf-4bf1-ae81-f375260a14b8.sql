
-- Add missing exception rules
INSERT INTO exception_rules (code, name, module, schedule, is_active, config_json) VALUES
  ('STOCK_COST_MISSING', 'SKU Avg Cost Missing on Sold Items', 'inventory', 'daily', true, '{"description": "Detects SKUs that have been delivered but have null or zero average cost"}'),
  ('SETTLEMENT_MISMATCH', 'Settlement Net Payable Mismatch', 'courier', 'on_event', true, '{"tolerance": 1.00, "description": "Settlement amount differs from expected net payable beyond tolerance"}'),
  ('SETTLEMENT_DOUBLE_POST', 'Settlement Double Post Risk', 'courier', 'on_event', true, '{"description": "Order already settlement-posted but appears in new settlement batch"}'),
  ('ADVANCE_NOT_POSTED', 'Advance Payment Not Posted', 'orders', 'daily', true, '{"threshold_days": 3, "description": "Order has advance amount but no ADVANCE_RECEIVED posting event"}'),
  ('AD_SPEND_UNMAPPED', 'Ad Spend Without SKU Mapping', 'expenses', 'daily', true, '{"description": "Meta/ad spend exists without campaign-product mapping"}'),
  ('DUPLICATE_JOURNAL_RISK', 'Duplicate Journal Entry Risk', 'accounting', 'daily', true, '{"description": "Same reference posted more than once to the journal"}'),
  ('DATA_VALIDATION_ERROR', 'Data Validation Error', 'orders', 'daily', true, '{"description": "General data quality check for missing required fields"}')
ON CONFLICT DO NOTHING;

-- Add indexes for better exception query performance
CREATE INDEX IF NOT EXISTS idx_exceptions_severity_status ON exceptions (severity, status);
CREATE INDEX IF NOT EXISTS idx_exceptions_code ON exceptions (code);
CREATE INDEX IF NOT EXISTS idx_exceptions_detected_at ON exceptions (detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_exceptions_source_module ON exceptions (source_module);
