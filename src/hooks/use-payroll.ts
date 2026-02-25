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
    mutationFn: async ({ id, payment_method, post_to_gl }: { id: string; payment_method: string; post_to_gl?: boolean }) => {
      // Fetch the payroll row first
      const { data: row, error: fetchErr } = await supabase
        .from("hrm_payroll")
        .select("*, employees(full_name, employee_id)")
        .eq("id", id)
        .single();
      if (fetchErr) throw fetchErr;

      // Mark as paid
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

      // GL posting: Dr Salary Expense / Cr Bank/Cash
      if (post_to_gl && row.net_salary > 0) {
        // Get account mappings
        const { data: accounts } = await supabase
          .from("chart_of_accounts")
          .select("id, code")
          .in("code", ["6200", "1100"]); // 6200=Salaries, 1100=Cash & Bank

        const salaryAcct = accounts?.find((a) => a.code === "6200")?.id;
        const bankAcct = accounts?.find((a) => a.code === "1100")?.id;

        if (salaryAcct && bankAcct) {
          const empName = (row.employees as any)?.full_name || "Employee";
          const empCode = (row.employees as any)?.employee_id || "";
          const monthStr = `${row.year}-${String(row.month).padStart(2, "0")}`;

          const { data: je, error: jeErr } = await supabase
            .from("journal_entries")
            .insert({
              entry_date: new Date().toISOString().slice(0, 10),
              description: `Payroll: ${empName} (${empCode}) — ${monthStr}`,
              reference_type: "payroll",
              reference_id: id,
              status: "posted",
              is_auto: true,
            })
            .select("id")
            .single();
          if (jeErr) throw jeErr;

          await supabase.from("journal_lines").insert([
            { journal_id: je.id, account_id: salaryAcct, debit: row.net_salary, credit: 0, description: `Salary expense — ${empName} ${monthStr}` },
            { journal_id: je.id, account_id: bankAcct, debit: 0, credit: row.net_salary, description: `Salary payment — ${empName} ${monthStr}` },
          ]);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hrm-payroll"] });
      qc.invalidateQueries({ queryKey: ["journal-entries"] });
      toast.success("Marked as paid");
    },
    onError: (e: any) => toast.error(e.message),
  });
}
