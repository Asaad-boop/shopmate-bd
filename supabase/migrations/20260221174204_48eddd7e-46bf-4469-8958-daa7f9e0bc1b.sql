
-- Fix system_issues RLS: change from RESTRICTIVE to PERMISSIVE
DROP POLICY IF EXISTS "Allow all access to system_issues" ON public.system_issues;
CREATE POLICY "Allow all access to system_issues"
ON public.system_issues
FOR ALL
USING (true)
WITH CHECK (true);
