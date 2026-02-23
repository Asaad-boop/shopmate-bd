import { useHrmRoles } from "@/hooks/use-hrm";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, ShieldCheck, ShieldAlert } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const levelConfig: Record<string, { icon: any; color: string; bg: string }> = {
  admin: { icon: ShieldAlert, color: "text-red-600", bg: "bg-red-50" },
  manager: { icon: ShieldCheck, color: "text-amber-600", bg: "bg-amber-50" },
  staff: { icon: Shield, color: "text-blue-600", bg: "bg-blue-50" },
};

export function RolesTab() {
  const { data: roles, isLoading } = useHrmRoles();

  if (isLoading) {
    return <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>;
  }

  return (
    <div className="space-y-4 mt-4">
      <p className="text-sm text-muted-foreground">{roles?.length || 0} roles configured</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {roles?.map((role: any) => {
          const config = levelConfig[role.level] || levelConfig.staff;
          const perms = role.permissions ? Object.keys(role.permissions) : [];
          return (
            <Card key={role.id} className="rounded-2xl hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl ${config.bg} flex items-center justify-center`}>
                    <config.icon className={`w-5 h-5 ${config.color}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{role.name}</h3>
                      <Badge variant="outline" className="text-[10px]">{role.level}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {perms.map((p) => (
                        <Badge key={p} variant="secondary" className="text-[10px]">{p}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
