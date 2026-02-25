
INSERT INTO public.account_mappings (mapping_key, description)
VALUES ('opening_balance_equity', 'Opening Balance Equity – credited when entering opening stock')
ON CONFLICT (mapping_key) DO NOTHING;
