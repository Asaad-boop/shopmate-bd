import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useHrStats, useDepartments, useEmployees } from "@/hooks/use-hrm";
import { Users, UserCheck, UserX, Banknote, Building2, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function HrDashboardTab() {
  const { data: stats, isLoading } = useHrStats();
  const { data: departments } = useDepartments();
  const { data: employees } = useEmployees();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
      </div>
    );
  }

  const kpis = [
    { label: "Total Employees", value: stats?.total || 0, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Active", value: stats?.active || 0, icon: UserCheck, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Inactive", value: stats?.inactive || 0, icon: UserX, color: "text-red-600", bg: "bg-red-50" },
    { label: "Monthly Salary Cost", value: `৳${(stats?.totalSalary || 0).toLocaleString()}`, icon: Banknote, color: "text-purple-600", bg: "bg-purple-50" },
  ];

  // Department-wise counts
  const deptCounts = departments?.map((d: any) => ({
    name: d.name,
    count: employees?.filter((e: any) => e.department_id === d.id).length || 0,
  })) || [];

  // Employment type breakdown
  const typeBreakdown = ["full_time", "part_time", "contract", "intern"].map((t) => ({
    type: t.replace("_", " "),
    count: employees?.filter((e: any) => e.employment_type === t).length || 0,
  }));

  return (
    <div className="space-y-6 mt-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="rounded-2xl border shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
                  <p className="text-2xl font-bold mt-1 font-['DM_Mono']">{kpi.value}</p>
                </div>
                <div className={`w-10 h-10 rounded-xl ${kpi.bg} flex items-center justify-center`}>
                  <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Department + Type Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Building2 className="w-4 h-4" /> Department Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {deptCounts.map((d) => (
              <div key={d.name} className="flex items-center justify-between">
                <span className="text-sm">{d.name}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${stats?.total ? (d.count / stats.total) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium font-['DM_Mono'] w-6 text-right">{d.count}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Employment Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {typeBreakdown.map((t) => (
                <div key={t.type} className="bg-muted/40 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold font-['DM_Mono']">{t.count}</p>
                  <p className="text-xs text-muted-foreground capitalize mt-1">{t.type}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
