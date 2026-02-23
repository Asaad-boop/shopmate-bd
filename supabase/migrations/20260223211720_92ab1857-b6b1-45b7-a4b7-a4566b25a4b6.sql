
-- ═══ HRM Phase 2: Attendance & Leave Management ═══

-- Attendance logs table
CREATE TABLE public.hrm_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  check_in timestamptz,
  check_out timestamptz,
  working_hours numeric DEFAULT 0,
  overtime_hours numeric DEFAULT 0,
  status varchar DEFAULT 'present',
  is_late boolean DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_id, date)
);

ALTER TABLE public.hrm_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to hrm_attendance" ON public.hrm_attendance FOR ALL USING (true) WITH CHECK (true);

-- Leave requests table
CREATE TABLE public.hrm_leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type varchar NOT NULL DEFAULT 'casual',
  start_date date NOT NULL,
  end_date date NOT NULL,
  days integer NOT NULL DEFAULT 1,
  reason text,
  status varchar NOT NULL DEFAULT 'pending',
  approved_by uuid REFERENCES public.employees(id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hrm_leave_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to hrm_leave_requests" ON public.hrm_leave_requests FOR ALL USING (true) WITH CHECK (true);

-- Leave balances per employee per year
CREATE TABLE public.hrm_leave_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  year integer NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::integer,
  paid_leave_total integer DEFAULT 14,
  paid_leave_used integer DEFAULT 0,
  sick_leave_total integer DEFAULT 10,
  sick_leave_used integer DEFAULT 0,
  casual_leave_total integer DEFAULT 10,
  casual_leave_used integer DEFAULT 0,
  unpaid_leave_used integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_id, year)
);

ALTER TABLE public.hrm_leave_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to hrm_leave_balances" ON public.hrm_leave_balances FOR ALL USING (true) WITH CHECK (true);

-- Auto-calculate working hours trigger
CREATE OR REPLACE FUNCTION public.calc_attendance_hours()
RETURNS trigger AS $$
BEGIN
  IF NEW.check_in IS NOT NULL AND NEW.check_out IS NOT NULL THEN
    NEW.working_hours := ROUND(EXTRACT(EPOCH FROM (NEW.check_out - NEW.check_in)) / 3600.0, 2);
    -- Overtime: anything above 8 hours
    IF NEW.working_hours > 8 THEN
      NEW.overtime_hours := ROUND(NEW.working_hours - 8, 2);
    ELSE
      NEW.overtime_hours := 0;
    END IF;
  END IF;
  -- Late detection: check-in after 10:00 AM
  IF NEW.check_in IS NOT NULL THEN
    NEW.is_late := EXTRACT(HOUR FROM NEW.check_in AT TIME ZONE 'Asia/Dhaka') >= 10
                   AND EXTRACT(MINUTE FROM NEW.check_in AT TIME ZONE 'Asia/Dhaka') > 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calc_attendance_hours
  BEFORE INSERT OR UPDATE ON public.hrm_attendance
  FOR EACH ROW EXECUTE FUNCTION public.calc_attendance_hours();
