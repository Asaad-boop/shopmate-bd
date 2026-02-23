import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function usePayrollList(month?: number, year?: number) {
  return useQuery({
    queryKey: ["hrm-payroll", month, year],
    queryFn: async () => {
      let q = supabase
        .from("hrm_payroll")
        .select("*, employees(full_name, employee_id, department_id, departments(name))")
        .order("created_at", { ascending: false });
      if (month) q = q.eq("month", month);
      if (year) q = q.eq("year", year);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });
}

export function useGeneratePayroll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ month, year }: { month: number; year: number }) => {
      // Fetch active employees
      const { data: employees, error: empErr } = await supabase
        .from("employees")
        .select("id, basic_salary")
        .eq("status", "active");
      if (empErr) throw empErr;

      // Fetch overtime hours for this month
      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const endDate = month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, "0")}-01`;

      const { data: attendance } = await supabase
        .from("hrm_attendance")
        .select("employee_id, overtime_hours")
        .gte("date", startDate)
        .lt("date", endDate);

      const overtimeMap: Record<string, number> = {};
      (attendance || []).forEach((a) => {
        overtimeMap[a.employee_id] = (overtimeMap[a.employee_id] || 0) + (a.overtime_hours || 0);
      });

      // Check existing payroll for this month
      const { data: existing } = await supabase
        .from("hrm_payroll")
        .select("employee_id")
        .eq("month", month)
        .eq("year", year);
      const existingSet = new Set((existing || []).map((e) => e.employee_id));

      const newRows = (employees || [])
        .filter((e) => !existingSet.has(e.id))
        .map((e) => {
          const basic = e.basic_salary || 0;
          const otHours = overtimeMap[e.id] || 0;
          const otRate = basic > 0 ? (basic / 26 / 8) * 1.5 : 0; // 1.5x hourly rate
          const otAmount = Math.round(otHours * otRate);
          const net = basic + otAmount;
          return {
            employee_id: e.id,
            month,
            year,
            basic_salary: basic,
            overtime_hours: otHours,
            overtime_amount: otAmount,
            net_salary: net,
          };
        });

      if (newRows.length === 0) {
        toast.info("All employees already have payroll for this month");
        return [];
      }

      const { data, error } = await supabase
        .from("hrm_payroll")
        .insert(newRows)
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["hrm-payroll"] });
      toast.success(`Payroll generated for ${data?.length || 0} employees`);
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdatePayroll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...rest }: any) => {
      const { data, error } = await supabase
        .from("hrm_payroll")
        .update({ ...rest, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hrm-payroll"] });
      toast.success("Payroll updated");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useMarkPayrollPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payment_method }: { id: string; payment_method: string }) => {
      const { error } = await supabase
        .from("hrm_payroll")
        .update({
          payment_status: "paid",
          payment_method,
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hrm-payroll"] });
      toast.success("Marked as paid");
    },
    onError: (e: any) => toast.error(e.message),
  });
}
