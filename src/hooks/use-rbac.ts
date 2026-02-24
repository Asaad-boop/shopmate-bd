import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SecurityRole {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface SecurityPermission {
  id: string;
  module: string;
  action: string;
  description: string | null;
}

export interface RolePermission {
  id: string;
  role_id: string;
  permission_id: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role_id: string;
  assigned_at: string;
  assigned_by: string | null;
}

export function useSecurityRoles() {
  return useQuery({
    queryKey: ["security-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("security_roles").select("*").order("name");
      if (error) throw error;
      return data as SecurityRole[];
    },
  });
}

export function useSecurityPermissions() {
  return useQuery({
    queryKey: ["security-permissions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("security_permissions").select("*").order("module, action");
      if (error) throw error;
      return data as SecurityPermission[];
    },
  });
}

export function useRolePermissions(roleId?: string) {
  return useQuery({
    queryKey: ["security-role-permissions", roleId],
    enabled: !!roleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("security_role_permissions")
        .select("*, security_permissions(*)")
        .eq("role_id", roleId!);
      if (error) throw error;
      return data as (RolePermission & { security_permissions: SecurityPermission })[];
    },
  });
}

export function useAllRolePermissions() {
  return useQuery({
    queryKey: ["security-role-permissions-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("security_role_permissions").select("role_id, permission_id");
      if (error) throw error;
      return data as { role_id: string; permission_id: string }[];
    },
  });
}

export function useUserRoles() {
  return useQuery({
    queryKey: ["security-user-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("security_user_roles")
        .select("*, security_roles(name)")
        .order("assigned_at", { ascending: false });
      if (error) throw error;
      return data as (UserRole & { security_roles: { name: string } })[];
    },
  });
}

export function useAuditLogs(filters?: { module?: string; action?: string; dateFrom?: string; dateTo?: string; entityId?: string }) {
  return useQuery({
    queryKey: ["audit-logs", filters],
    queryFn: async () => {
      let q = supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200);
      if (filters?.module && filters.module !== "all") q = q.eq("entity_type", filters.module);
      if (filters?.action && filters.action !== "all") q = q.eq("action", filters.action);
      if (filters?.dateFrom) q = q.gte("created_at", filters.dateFrom);
      if (filters?.dateTo) q = q.lte("created_at", filters.dateTo + "T23:59:59");
      if (filters?.entityId) q = q.eq("entity_id", filters.entityId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}
