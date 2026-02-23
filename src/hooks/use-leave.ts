import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useLeaveRequests(status?: string) {
  return useQuery({
    queryKey: ["hrm-leave-requests", status],
    queryFn: async () => {
      let query = supabase
        .from("hrm_leave_requests")
        .select("*, employees(full_name, employee_id, department_id, departments(name))")
        .order("created_at", { ascending: false });
      if (status && status !== "all") {
        query = query.eq("status", status);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });
}

export function useLeaveBalances(year?: number) {
  const currentYear = year || new Date().getFullYear();
  return useQuery({
    queryKey: ["hrm-leave-balances", currentYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hrm_leave_balances")
        .select("*, employees(full_name, employee_id)")
        .eq("year", currentYear);
      if (error) throw error;
      return data || [];
    },
  });
}

export function useApplyLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (req: {
      employee_id: string;
      leave_type: string;
      start_date: string;
      end_date: string;
      days: number;
      reason?: string;
    }) => {
      const { data, error } = await supabase
        .from("hrm_leave_requests")
        .insert(req)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hrm-leave-requests"] });
      toast.success("Leave request submitted");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useApproveLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, approved_by }: { id: string; status: "approved" | "rejected"; approved_by?: string }) => {
      const update: any = { status, approved_at: new Date().toISOString() };
      if (approved_by) update.approved_by = approved_by;
      
      const { data: request, error: fetchErr } = await supabase
        .from("hrm_leave_requests")
        .select("*")
        .eq("id", id)
        .single();
      if (fetchErr) throw fetchErr;

      const { error } = await supabase
        .from("hrm_leave_requests")
        .update(update)
        .eq("id", id);
      if (error) throw error;

      // If approved, update leave balance
      if (status === "approved" && request) {
        const year = new Date(request.start_date).getFullYear();
        const leaveType = request.leave_type;
        const days = request.days;

        // Ensure balance record exists
        const { data: existing } = await supabase
          .from("hrm_leave_balances")
          .select("*")
          .eq("employee_id", request.employee_id)
          .eq("year", year)
          .single();

        if (!existing) {
          await supabase.from("hrm_leave_balances").insert({
            employee_id: request.employee_id,
            year,
          });
        }

        const colMap: Record<string, string> = {
          paid: "paid_leave_used",
          sick: "sick_leave_used",
          casual: "casual_leave_used",
          unpaid: "unpaid_leave_used",
        };

        const col = colMap[leaveType];
        if (col) {
          const { data: bal } = await supabase
            .from("hrm_leave_balances")
            .select("*")
            .eq("employee_id", request.employee_id)
            .eq("year", year)
            .single();

          if (bal) {
            await supabase
              .from("hrm_leave_balances")
              .update({ [col]: (bal as any)[col] + days })
              .eq("id", bal.id);
          }
        }
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["hrm-leave-requests"] });
      qc.invalidateQueries({ queryKey: ["hrm-leave-balances"] });
      toast.success(`Leave ${vars.status}`);
    },
    onError: (e: any) => toast.error(e.message),
  });
}
