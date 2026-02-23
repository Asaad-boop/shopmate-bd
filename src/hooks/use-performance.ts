import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Reviews ──
export function usePerformanceReviews(employeeId?: string) {
  return useQuery({
    queryKey: ["hrm-reviews", employeeId],
    queryFn: async () => {
      let q = supabase
        .from("hrm_performance_reviews")
        .select("*, employees(full_name, employee_id, departments(name))")
        .order("review_date", { ascending: false });
      if (employeeId) q = q.eq("employee_id", employeeId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });
}

export function useAddReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (review: any) => {
      const { data, error } = await supabase
        .from("hrm_performance_reviews")
        .insert(review)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hrm-reviews"] });
      toast.success("Review added");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...rest }: any) => {
      const { data, error } = await supabase
        .from("hrm_performance_reviews")
        .update(rest)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hrm-reviews"] });
      toast.success("Review updated");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ── Goals ──
export function useGoals(employeeId?: string) {
  return useQuery({
    queryKey: ["hrm-goals", employeeId],
    queryFn: async () => {
      let q = supabase
        .from("hrm_goals")
        .select("*, employees(full_name, employee_id)")
        .order("created_at", { ascending: false });
      if (employeeId) q = q.eq("employee_id", employeeId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });
}

export function useAddGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (goal: any) => {
      const { data, error } = await supabase
        .from("hrm_goals")
        .insert(goal)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hrm-goals"] });
      toast.success("Goal added");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...rest }: any) => {
      const { data, error } = await supabase
        .from("hrm_goals")
        .update({ ...rest, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hrm-goals"] });
      toast.success("Goal updated");
    },
    onError: (e: any) => toast.error(e.message),
  });
}
