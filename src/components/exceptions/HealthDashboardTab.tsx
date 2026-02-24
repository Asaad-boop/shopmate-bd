import { useExceptionStats, useExceptions } from "@/hooks/use-exceptions";
import { KpiCard } from "@/components/ui/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, XCircle, ShieldAlert, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const MODULE_LABELS: Record<string, string> = {
  orders: "Orders", inventory: "Inventory", courier: "Courier", accounting: "Accounting",
  expenses: "Expenses", purchasing: "Purchasing", import: "Import", hrm: "HRM",
};

export function HealthDashboardTab() {
  const { data: stats, isLoading } = useExceptionStats();
  const { data: criticalExceptions } = useExceptions({ status: "open", severity: "critical" });

  return (
    <div className="space-y-6 mt-4">
      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Open Critical"
          value={String(stats?.critical || 0)}
          icon={<XCircle className="w-5 h-5" />}
          className={stats?.critical ? "border-destructive/50" : ""}
          loading={isLoading}
        />
        <KpiCard
          title="Open High"
          value={String(stats?.high || 0)}
          icon={<AlertTriangle className="w-5 h-5" />}
          loading={isLoading}
        />
        <KpiCard
          title="Total Open"
          value={String(stats?.total_open || 0)}
          icon={<ShieldAlert className="w-5 h-5" />}
          loading={isLoading}
        />
        <KpiCard
          title="Resolved"
          value={String(stats?.resolved_count || 0)}
          icon={<CheckCircle className="w-5 h-5" />}
          loading={isLoading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Module */}
        <Card>
          <CardHeader><CardTitle className="text-base">Exceptions by Module</CardTitle></CardHeader>
          <CardContent>
            {stats?.by_module?.length ? (
              <div className="space-y-3">
                {stats.by_module.map(([mod, count]) => (
                  <div key={mod} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{MODULE_LABELS[mod] || mod}</span>
                    <div className="flex items-center gap-2">
                      <div className="h-2 rounded-full bg-primary/20 w-32">
                        <div
                          className="h-2 rounded-full bg-primary transition-all"
                          style={{ width: `${Math.min(100, (count / stats.total_open) * 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold w-8 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No open exceptions 🎉</p>
            )}
          </CardContent>
        </Card>

        {/* Critical Exceptions */}
        <Card>
          <CardHeader><CardTitle className="text-base">Critical Issues</CardTitle></CardHeader>
          <CardContent>
            {criticalExceptions?.length ? (
              <div className="space-y-2">
                {criticalExceptions.slice(0, 10).map((exc) => (
                  <div key={exc.id} className="flex items-start gap-2 p-2 rounded-lg bg-destructive/5 border border-destructive/10">
                    <XCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{exc.title}</p>
                      <p className="text-xs text-muted-foreground">{MODULE_LABELS[exc.source_module]} · {exc.code}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No critical exceptions ✅</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
