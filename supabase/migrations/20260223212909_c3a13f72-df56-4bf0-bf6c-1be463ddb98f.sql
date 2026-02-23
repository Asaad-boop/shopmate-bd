
-- ══════════════════════════════════════════
-- Phase 3: Payroll & Performance Tables
-- ══════════════════════════════════════════

-- ── HRM Payroll Runs ──
CREATE TABLE public.hrm_payroll (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  month integer NOT NULL,
  year integer NOT NULL,
  basic_salary numeric NOT NULL DEFAULT 0,
  overtime_hours numeric DEFAULT 0,
  overtime_amount numeric DEFAULT 0,
  bonus numeric DEFAULT 0,
  deductions numeric DEFAULT 0,
  net_salary numeric NOT NULL DEFAULT 0,
  payment_method varchar DEFAULT 'bank',
  payment_status varchar NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_id, month, year)
);

ALTER TABLE public.hrm_payroll ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to hrm_payroll" ON public.hrm_payroll FOR ALL USING (true) WITH CHECK (true);

-- ── Performance Review Cycles ──
CREATE TABLE public.hrm_performance_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  review_period varchar NOT NULL DEFAULT 'monthly',
  review_date date NOT NULL DEFAULT CURRENT_DATE,
  reviewer_name varchar,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  strengths text,
  improvements text,
  overall_comment text,
  status varchar NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hrm_performance_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to hrm_performance_reviews" ON public.hrm_performance_reviews FOR ALL USING (true) WITH CHECK (true);

-- ── Employee Goals / KPIs ──
CREATE TABLE public.hrm_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  title varchar NOT NULL,
  description text,
  target_value numeric,
  current_value numeric DEFAULT 0,
  unit varchar DEFAULT '%',
  due_date date,
  status varchar NOT NULL DEFAULT 'in_progress',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hrm_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to hrm_goals" ON public.hrm_goals FOR ALL USING (true) WITH CHECK (true);
