import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Departments ──
export function useDepartments() {
  return useQuery({
    queryKey: ["hrm-departments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("*")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });
}

// ── HRM Roles ──
export function useHrmRoles() {
  return useQuery({
    queryKey: ["hrm-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hrm_roles")
        .select("*")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });
}

// ── Employees ──
export function useEmployees() {
  return useQuery({
    queryKey: ["hrm-employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*, departments(name), hrm_roles(name, level)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useEmployee(id: string | undefined) {
  return useQuery({
    queryKey: ["hrm-employee", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*, departments(name), hrm_roles(name, level)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useAddEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (emp: any) => {
      const { data, error } = await supabase
        .from("employees")
        .insert(emp)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hrm-employees"] });
      toast.success("Employee added successfully");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...rest }: any) => {
      const { data, error } = await supabase
        .from("employees")
        .update({ ...rest, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hrm-employees"] });
      toast.success("Employee updated");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("employees").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hrm-employees"] });
      toast.success("Employee deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ── HR Stats ──
export function useHrStats() {
  return useQuery({
    queryKey: ["hrm-stats"],
    queryFn: async () => {
      const { data: employees } = await supabase.from("employees").select("status, basic_salary, department_id");
      const all = employees || [];
      const active = all.filter((e) => e.status === "active").length;
      const inactive = all.filter((e) => e.status !== "active").length;
      const totalSalary = all.reduce((s, e) => s + (e.basic_salary || 0), 0);
      
      // Department breakdown
      const deptMap: Record<string, number> = {};
      all.forEach((e) => {
        const key = e.department_id || "unassigned";
        deptMap[key] = (deptMap[key] || 0) + 1;
      });

      return { total: all.length, active, inactive, totalSalary, deptMap };
    },
  });
}
