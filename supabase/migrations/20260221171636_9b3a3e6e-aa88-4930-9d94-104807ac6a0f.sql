
-- Storage metrics table
CREATE TABLE public.storage_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_name text NOT NULL,
  used_gb double precision NOT NULL DEFAULT 0,
  total_gb double precision NOT NULL DEFAULT 100,
  last_updated timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.storage_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to storage_metrics"
  ON public.storage_metrics FOR ALL
  USING (true) WITH CHECK (true);

-- System issues table
CREATE TABLE public.system_issues (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  severity text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open',
  module text,
  reported_at timestamp with time zone NOT NULL DEFAULT now(),
  reported_by text
);

ALTER TABLE public.system_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to system_issues"
  ON public.system_issues FOR ALL
  USING (true) WITH CHECK (true);

-- Seed storage_metrics with sample data
INSERT INTO public.storage_metrics (module_name, used_gb, total_gb) VALUES
  ('Invoices', 78.5, 200),
  ('HR Files', 45.2, 100),
  ('Products', 52.8, 150),
  ('Reports', 38.1, 100),
  ('Backups', 95.3, 200),
  ('Media Assets', 120.6, 250);

-- Seed system_issues with sample data
INSERT INTO public.system_issues (title, description, severity, status, module, reported_by) VALUES
  ('Database connection timeout', 'Intermittent timeouts on high-traffic queries', 'critical', 'open', 'Database', 'Admin'),
  ('Invoice PDF generation slow', 'PDF generation takes over 10s for large invoices', 'high', 'in_progress', 'Invoices', 'Billing Team'),
  ('Product image upload fails', 'Images over 5MB fail to upload without error message', 'high', 'open', 'Products', 'Warehouse'),
  ('HR report export broken', 'Monthly attendance export returns empty CSV', 'medium', 'open', 'HR Files', 'HR Manager'),
  ('Backup job not running', 'Nightly backup cron has not triggered in 3 days', 'critical', 'in_progress', 'Backups', 'DevOps'),
  ('Search index outdated', 'Product search returns stale results', 'medium', 'resolved', 'Products', 'Support'),
  ('Login page styling issue', 'Button alignment broken on mobile Safari', 'low', 'resolved', 'Auth', 'QA Team'),
  ('Memory leak in dashboard', 'Dashboard memory grows over time without refresh', 'high', 'open', 'Reports', 'DevOps'),
  ('Email notifications delayed', 'Order confirmation emails delayed by 15+ minutes', 'medium', 'in_progress', 'Invoices', 'Support'),
  ('API rate limit exceeded', 'Pathao API returning 429 during peak hours', 'critical', 'open', 'Courier', 'Logistics'),
  ('Chart rendering error', 'Sales chart crashes with large datasets', 'high', 'open', 'Reports', 'Admin'),
  ('File cleanup needed', 'Orphaned temp files consuming 12GB storage', 'low', 'resolved', 'Media Assets', 'DevOps');
