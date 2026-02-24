import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSecurityRoles, useSecurityPermissions, useAllRolePermissions, useUserRoles } from "@/hooks/use-rbac";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Shield, Plus, Users, Grid3X3, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const MODULES = ["ORDERS", "INVENTORY", "ACCOUNTING", "COURIER", "EXPENSES", "PURCHASING", "HRM", "EXCEPTIONS", "SETTINGS"];

export default function RolesPermissionsPage() {
  const { data: roles, isLoading: rolesLoading } = useSecurityRoles();
  const { data: permissions } = useSecurityPermissions();
  const { data: rolePerms } = useAllRolePermissions();
  const { data: userRoles } = useUserRoles();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignUserId, setAssignUserId] = useState("");
  const [assignRoleId, setAssignRoleId] = useState("");

  const createRole = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("security_roles").insert({ name: newRoleName, description: newRoleDesc || null });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["security-roles"] });
      setCreateOpen(false);
      setNewRoleName("");
      setNewRoleDesc("");
      toast({ title: "Role created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const togglePermission = useMutation({
    mutationFn: async ({ roleId, permId, enabled }: { roleId: string; permId: string; enabled: boolean }) => {
      if (enabled) {
        const { error } = await supabase.from("security_role_permissions").insert({ role_id: roleId, permission_id: permId });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("security_role_permissions").delete().eq("role_id", roleId).eq("permission_id", permId);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["security-role-permissions-all"] }),
  });

  const assignUserRole = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("security_user_roles").insert({ user_id: assignUserId, role_id: assignRoleId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["security-user-roles"] });
      setAssignOpen(false);
      setAssignUserId("");
      toast({ title: "User role assigned" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removeUserRole = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("security_user_roles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["security-user-roles"] });
      toast({ title: "Role removed" });
    },
  });

  const hasPermission = (roleId: string, permId: string) =>
    rolePerms?.some((rp) => rp.role_id === roleId && rp.permission_id === permId) || false;

  // Group permissions by module
  const permsByModule = MODULES.map((mod) => ({
    module: mod,
    perms: (permissions || []).filter((p) => p.module === mod),
  }));

  if (rolesLoading) {
    return <div className="space-y-4 p-6"><Skeleton className="h-8 w-64" /><Skeleton className="h-96" /></div>;
  }

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Roles & Permissions</h1>
            <p className="text-sm text-muted-foreground">Manage access control across all modules</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setAssignOpen(true)}>
            <Users className="w-4 h-4 mr-1" /> Assign User
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)} className="bg-primary text-primary-foreground">
            <Plus className="w-4 h-4 mr-1" /> New Role
          </Button>
        </div>
      </div>

      <Tabs defaultValue="matrix">
        <TabsList>
          <TabsTrigger value="matrix"><Grid3X3 className="w-4 h-4 mr-1" /> Permission Matrix</TabsTrigger>
          <TabsTrigger value="users"><Users className="w-4 h-4 mr-1" /> User Assignments</TabsTrigger>
        </TabsList>

        <TabsContent value="matrix" className="mt-4">
          <Card className="border-border overflow-x-auto">
            <CardContent className="p-0">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left p-3 font-semibold sticky left-0 bg-muted/50 min-w-[160px]">Module / Action</th>
                    {(roles || []).map((r) => (
                      <th key={r.id} className="text-center p-3 font-semibold min-w-[100px]">
                        <div>{r.name}</div>
                        <div className="text-[10px] text-muted-foreground font-normal">{r.description?.slice(0, 30)}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {permsByModule.map(({ module, perms }) => (
                    perms.map((perm, idx) => (
                      <tr key={perm.id} className={`border-b border-border/50 ${idx === 0 ? "border-t-2 border-t-border" : ""}`}>
                        <td className="p-2.5 sticky left-0 bg-background">
                          {idx === 0 && (
                            <Badge variant="outline" className="text-[9px] mb-1 block w-fit">{module}</Badge>
                          )}
                          <span className="text-muted-foreground">{perm.action}</span>
                        </td>
                        {(roles || []).map((role) => (
                          <td key={role.id} className="p-2.5 text-center">
                            <Checkbox
                              checked={hasPermission(role.id, perm.id)}
                              onCheckedChange={(checked) =>
                                togglePermission.mutate({ roleId: role.id, permId: perm.id, enabled: !!checked })
                              }
                              disabled={role.name === "Admin"}
                            />
                          </td>
                        ))}
                      </tr>
                    ))
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <Card className="border-border">
            <CardHeader><CardTitle className="text-base">User Role Assignments</CardTitle></CardHeader>
            <CardContent>
              {(userRoles || []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No user roles assigned yet</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-2 font-semibold">User ID</th>
                      <th className="text-left p-2 font-semibold">Role</th>
                      <th className="text-left p-2 font-semibold">Assigned At</th>
                      <th className="text-right p-2 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(userRoles || []).map((ur: any) => (
                      <tr key={ur.id} className="border-b border-border/50">
                        <td className="p-2 font-mono text-xs">{ur.user_id.slice(0, 12)}...</td>
                        <td className="p-2"><Badge variant="secondary">{ur.security_roles?.name}</Badge></td>
                        <td className="p-2 text-xs text-muted-foreground">
                          {new Date(ur.assigned_at).toLocaleDateString()}
                        </td>
                        <td className="p-2 text-right">
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeUserRole.mutate(ur.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Role Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle>Create New Role</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Role Name</Label>
              <Input value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} placeholder="e.g. Warehouse Lead" />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={newRoleDesc} onChange={(e) => setNewRoleDesc(e.target.value)} placeholder="Optional description" />
            </div>
            <Button className="w-full" onClick={() => createRole.mutate()} disabled={!newRoleName || createRole.isPending}>
              Create Role
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign User Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle>Assign Role to User</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>User ID</Label>
              <Input value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)} placeholder="Enter user ID or email" />
            </div>
            <div>
              <Label>Role</Label>
              <select
                value={assignRoleId}
                onChange={(e) => setAssignRoleId(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select role...</option>
                {(roles || []).map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <Button className="w-full" onClick={() => assignUserRole.mutate()} disabled={!assignUserId || !assignRoleId || assignUserRole.isPending}>
              Assign Role
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
