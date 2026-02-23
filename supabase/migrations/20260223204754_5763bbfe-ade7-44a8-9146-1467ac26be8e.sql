
-- Departments table
CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar NOT NULL UNIQUE,
  description text,
  head_employee_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to departments" ON public.departments FOR ALL USING (true) WITH CHECK (true);

-- HRM Roles table (separate from existing roles)
CREATE TABLE public.hrm_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar NOT NULL UNIQUE,
  level varchar NOT NULL DEFAULT 'staff', -- admin, manager, staff
  permissions jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hrm_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to hrm_roles" ON public.hrm_roles FOR ALL USING (true) WITH CHECK (true);

-- Employees table
CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id varchar NOT NULL UNIQUE, -- EMP-0001
  full_name varchar NOT NULL,
  email varchar,
  phone varchar,
  nid_number varchar,
  nid_document_url text,
  photo_url text,
  department_id uuid REFERENCES public.departments(id),
  designation varchar,
  hrm_role_id uuid REFERENCES public.hrm_roles(id),
  basic_salary numeric DEFAULT 0,
  employment_type varchar DEFAULT 'full_time', -- full_time, part_time, contract, intern
  join_date date DEFAULT CURRENT_DATE,
  probation_end_date date,
  contract_end_date date,
  date_of_birth date,
  gender varchar,
  blood_group varchar,
  emergency_contact_name varchar,
  emergency_contact_phone varchar,
  address text,
  bank_name varchar,
  bank_account_number varchar,
  bkash_number varchar,
  nagad_number varchar,
  status varchar DEFAULT 'active', -- active, inactive, on_leave, terminated
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to employees" ON public.employees FOR ALL USING (true) WITH CHECK (true);

-- Add FK for department head
ALTER TABLE public.departments ADD CONSTRAINT departments_head_employee_id_fkey FOREIGN KEY (head_employee_id) REFERENCES public.employees(id);

-- Sequence for employee ID generation
CREATE SEQUENCE public.employee_id_seq START 1;

-- Function to auto-generate employee ID
CREATE OR REPLACE FUNCTION public.generate_employee_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.employee_id IS NULL OR NEW.employee_id = '' THEN
    NEW.employee_id := 'EMP-' || LPAD(nextval('public.employee_id_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generate_employee_id
  BEFORE INSERT ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_employee_id();

-- Seed default departments
INSERT INTO public.departments (name, description) VALUES
  ('Customer Support', 'Handles customer inquiries and order confirmations'),
  ('Packaging', 'Product packaging and quality check'),
  ('Warehouse', 'Stock management and dispatch'),
  ('Media Buying', 'Digital marketing and ad campaigns'),
  ('Accounts', 'Finance and accounting operations'),
  ('Management', 'Leadership and strategic planning');

-- Seed default HRM roles
INSERT INTO public.hrm_roles (name, level, permissions) VALUES
  ('Admin', 'admin', '{"all": true}'),
  ('Manager', 'manager', '{"department": true, "attendance": true, "leave_approve": true, "view_payroll": true}'),
  ('Staff', 'staff', '{"self_attendance": true, "apply_leave": true, "view_own_payroll": true}');
