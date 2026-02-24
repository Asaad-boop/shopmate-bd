
-- Phase 6: RBAC Tables

-- 1) security_roles
CREATE TABLE public.security_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.security_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to security_roles" ON public.security_roles FOR ALL USING (true) WITH CHECK (true);

-- 2) security_permissions
CREATE TABLE public.security_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module text NOT NULL,
  action text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(module, action)
);
ALTER TABLE public.security_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to security_permissions" ON public.security_permissions FOR ALL USING (true) WITH CHECK (true);

-- 3) security_role_permissions
CREATE TABLE public.security_role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES public.security_roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.security_permissions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(role_id, permission_id)
);
ALTER TABLE public.security_role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to security_role_permissions" ON public.security_role_permissions FOR ALL USING (true) WITH CHECK (true);

-- 4) security_user_roles
CREATE TABLE public.security_user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  role_id uuid NOT NULL REFERENCES public.security_roles(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by text,
  UNIQUE(user_id, role_id)
);
ALTER TABLE public.security_user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to security_user_roles" ON public.security_user_roles FOR ALL USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX idx_security_user_roles_user ON public.security_user_roles(user_id);
CREATE INDEX idx_security_role_permissions_role ON public.security_role_permissions(role_id);

-- Extend audit_logs with new columns
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS performed_by text;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS device_info text;

-- Seed default roles
INSERT INTO public.security_roles (name, description) VALUES
  ('Admin', 'Full system access'),
  ('Finance', 'Accounting, expenses, payments, period close'),
  ('Operations', 'Orders, courier, shipping management'),
  ('Inventory Manager', 'Stock, GRN, inventory adjustments'),
  ('HR', 'Payroll, attendance, employee management'),
  ('Viewer', 'Read-only access across all modules');

-- Seed permissions
INSERT INTO public.security_permissions (module, action, description) VALUES
  ('ORDERS', 'VIEW', 'View orders'),
  ('ORDERS', 'CREATE', 'Create orders'),
  ('ORDERS', 'EDIT', 'Edit orders'),
  ('ORDERS', 'EDIT_DELIVERED_ORDER', 'Edit delivered orders'),
  ('INVENTORY', 'VIEW', 'View inventory'),
  ('INVENTORY', 'CREATE', 'Create stock entries'),
  ('INVENTORY', 'EDIT', 'Edit inventory'),
  ('INVENTORY', 'ADJUST', 'Adjust stock with reason'),
  ('ACCOUNTING', 'VIEW', 'View accounting'),
  ('ACCOUNTING', 'POST', 'Post journal entries'),
  ('ACCOUNTING', 'REVERSE', 'Reverse journal entries'),
  ('ACCOUNTING', 'CLOSE_PERIOD', 'Close accounting periods'),
  ('COURIER', 'VIEW', 'View courier data'),
  ('COURIER', 'CREATE', 'Create shipments'),
  ('COURIER', 'EDIT_COST', 'Edit courier cost after delivery'),
  ('EXPENSES', 'VIEW', 'View expenses'),
  ('EXPENSES', 'CREATE', 'Create expenses'),
  ('EXPENSES', 'POST', 'Post expenses'),
  ('EXPENSES', 'EDIT', 'Edit expenses'),
  ('PURCHASING', 'VIEW', 'View purchasing'),
  ('PURCHASING', 'CREATE', 'Create purchase orders'),
  ('PURCHASING', 'POST', 'Post GRN and payments'),
  ('PURCHASING', 'REVERSE', 'Reverse GRN'),
  ('HRM', 'VIEW', 'View HR data'),
  ('HRM', 'CREATE', 'Create HR records'),
  ('HRM', 'EDIT', 'Edit HR records'),
  ('HRM', 'PAYROLL', 'Manage payroll'),
  ('EXCEPTIONS', 'VIEW', 'View exceptions'),
  ('EXCEPTIONS', 'RESOLVE', 'Resolve exceptions'),
  ('EXCEPTIONS', 'IGNORE_CRITICAL', 'Ignore critical exceptions'),
  ('SETTINGS', 'VIEW', 'View settings'),
  ('SETTINGS', 'EDIT', 'Edit settings');

-- Assign all permissions to Admin role
INSERT INTO public.security_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.security_roles r, public.security_permissions p WHERE r.name = 'Admin';

-- Assign Finance permissions
INSERT INTO public.security_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.security_roles r, public.security_permissions p
WHERE r.name = 'Finance' AND (
  p.module IN ('ACCOUNTING', 'EXPENSES', 'PURCHASING') OR
  (p.module = 'COURIER' AND p.action IN ('VIEW', 'EDIT_COST')) OR
  (p.module = 'ORDERS' AND p.action = 'VIEW') OR
  (p.module = 'INVENTORY' AND p.action = 'VIEW') OR
  (p.module = 'EXCEPTIONS' AND p.action IN ('VIEW', 'RESOLVE'))
);

-- Assign Operations permissions
INSERT INTO public.security_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.security_roles r, public.security_permissions p
WHERE r.name = 'Operations' AND (
  (p.module = 'ORDERS' AND p.action IN ('VIEW', 'CREATE', 'EDIT')) OR
  (p.module = 'COURIER' AND p.action IN ('VIEW', 'CREATE')) OR
  (p.module = 'INVENTORY' AND p.action = 'VIEW') OR
  (p.module = 'EXCEPTIONS' AND p.action = 'VIEW')
);

-- Assign Inventory Manager permissions
INSERT INTO public.security_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.security_roles r, public.security_permissions p
WHERE r.name = 'Inventory Manager' AND (
  (p.module = 'INVENTORY') OR
  (p.module = 'PURCHASING' AND p.action IN ('VIEW', 'CREATE', 'POST')) OR
  (p.module = 'ORDERS' AND p.action = 'VIEW') OR
  (p.module = 'EXCEPTIONS' AND p.action = 'VIEW')
);

-- Assign HR permissions
INSERT INTO public.security_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.security_roles r, public.security_permissions p
WHERE r.name = 'HR' AND (
  p.module = 'HRM' OR
  (p.module = 'EXCEPTIONS' AND p.action = 'VIEW')
);

-- Assign Viewer permissions
INSERT INTO public.security_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.security_roles r, public.security_permissions p
WHERE r.name = 'Viewer' AND p.action = 'VIEW';
