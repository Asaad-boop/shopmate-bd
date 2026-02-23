import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Tasks ──
export function useTasks(departmentId?: string) {
  return useQuery({
    queryKey: ["hrm-tasks", departmentId],
    queryFn: async () => {
      let q = supabase
        .from("hrm_tasks")
        .select("*, employees(full_name, employee_id), departments(name)")
        .order("created_at", { ascending: false });
      if (departmentId && departmentId !== "all") q = q.eq("department_id", departmentId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });
}

export function useAddTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (task: any) => {
      const { data, error } = await supabase.from("hrm_tasks").insert(task).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hrm-tasks"] });
      toast.success("Task created");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...rest }: any) => {
      const updates: any = { ...rest, updated_at: new Date().toISOString() };
      if (rest.status === "done" && !rest.completed_at) {
        updates.completed_at = new Date().toISOString();
      }
      const { data, error } = await supabase.from("hrm_tasks").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hrm-tasks"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("hrm_tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hrm-tasks"] });
      toast.success("Task deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ── Task Comments ──
export function useTaskComments(taskId: string | undefined) {
  return useQuery({
    queryKey: ["hrm-task-comments", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hrm_task_comments")
        .select("*")
        .eq("task_id", taskId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!taskId,
  });
}

export function useAddTaskComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (comment: { task_id: string; author_name: string; content: string }) => {
      const { data, error } = await supabase.from("hrm_task_comments").insert(comment).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["hrm-task-comments", vars.task_id] });
      toast.success("Comment added");
    },
    onError: (e: any) => toast.error(e.message),
  });
}
