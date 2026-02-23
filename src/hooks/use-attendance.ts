import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useAttendanceByDate(date: string) {
  return useQuery({
    queryKey: ["hrm-attendance", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hrm_attendance")
        .select("*, employees(full_name, employee_id, department_id, departments(name))")
        .eq("date", date)
        .order("check_in", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useAttendanceByEmployee(employeeId: string | undefined, month?: string) {
  return useQuery({
    queryKey: ["hrm-attendance-employee", employeeId, month],
    queryFn: async () => {
      let query = supabase
        .from("hrm_attendance")
        .select("*")
        .eq("employee_id", employeeId!)
        .order("date", { ascending: false });

      if (month) {
        const start = `${month}-01`;
        const endDate = new Date(parseInt(month.split("-")[0]), parseInt(month.split("-")[1]), 0);
        const end = `${month}-${endDate.getDate().toString().padStart(2, "0")}`;
        query = query.gte("date", start).lte("date", end);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!employeeId,
  });
}

export function useMonthlyAttendanceSummary(month: string) {
  return useQuery({
    queryKey: ["hrm-attendance-summary", month],
    queryFn: async () => {
      const start = `${month}-01`;
      const endDate = new Date(parseInt(month.split("-")[0]), parseInt(month.split("-")[1]), 0);
      const end = `${month}-${endDate.getDate().toString().padStart(2, "0")}`;

      const { data, error } = await supabase
        .from("hrm_attendance")
        .select("*, employees(full_name, employee_id, department_id, departments(name))")
        .gte("date", start)
        .lte("date", end)
        .order("date");
      if (error) throw error;

      // Group by employee
      const byEmployee: Record<string, any> = {};
      (data || []).forEach((row: any) => {
        if (!byEmployee[row.employee_id]) {
          byEmployee[row.employee_id] = {
            employee_id: row.employee_id,
            full_name: row.employees?.full_name,
            emp_code: row.employees?.employee_id,
            department: row.employees?.departments?.name,
            present: 0,
            absent: 0,
            late: 0,
            totalHours: 0,
            overtimeHours: 0,
            records: [],
          };
        }
        const emp = byEmployee[row.employee_id];
        emp.records.push(row);
        if (row.status === "present" || row.status === "late") emp.present++;
        if (row.status === "absent") emp.absent++;
        if (row.is_late) emp.late++;
        emp.totalHours += row.working_hours || 0;
        emp.overtimeHours += row.overtime_hours || 0;
      });

      return Object.values(byEmployee);
    },
  });
}

export function useCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ employee_id, date, notes }: { employee_id: string; date: string; notes?: string }) => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("hrm_attendance")
        .upsert(
          { employee_id, date, check_in: now, status: "present", notes },
          { onConflict: "employee_id,date" }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hrm-attendance"] });
      toast.success("Checked in successfully");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useCheckOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ employee_id, date }: { employee_id: string; date: string }) => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("hrm_attendance")
        .update({ check_out: now })
        .eq("employee_id", employee_id)
        .eq("date", date)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hrm-attendance"] });
      toast.success("Checked out successfully");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useMarkAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (record: {
      employee_id: string;
      date: string;
      check_in?: string;
      check_out?: string;
      status: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from("hrm_attendance")
        .upsert(record, { onConflict: "employee_id,date" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hrm-attendance"] });
      toast.success("Attendance recorded");
    },
    onError: (e: any) => toast.error(e.message),
  });
}
