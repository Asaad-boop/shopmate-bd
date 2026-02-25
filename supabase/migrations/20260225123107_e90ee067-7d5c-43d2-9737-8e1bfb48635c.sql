
INSERT INTO public.account_mappings (mapping_key, description)
VALUES ('courier_expense', 'Courier delivery/COD expense account')
ON CONFLICT (mapping_key) DO NOTHING;
