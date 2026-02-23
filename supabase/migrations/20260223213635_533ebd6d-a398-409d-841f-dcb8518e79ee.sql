
-- ══════════════════════════════════════════
-- Phase 4: Task Management Tables
-- ══════════════════════════════════════════

-- ── HRM Tasks ──
CREATE TABLE public.hrm_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar NOT NULL,
  description text,
  assigned_to uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  created_by_name varchar,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  priority varchar NOT NULL DEFAULT 'medium',
  status varchar NOT NULL DEFAULT 'todo',
  due_date date,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hrm_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to hrm_tasks" ON public.hrm_tasks FOR ALL USING (true) WITH CHECK (true);

-- ── Task Comments ──
CREATE TABLE public.hrm_task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.hrm_tasks(id) ON DELETE CASCADE,
  author_name varchar NOT NULL DEFAULT 'System',
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hrm_task_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to hrm_task_comments" ON public.hrm_task_comments FOR ALL USING (true) WITH CHECK (true);
