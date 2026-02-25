import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSearchParams } from "react-router-dom";
import { ExceptionsQueueTab } from "@/components/exceptions/ExceptionsQueueTab";
import { RulesChecksTab } from "@/components/exceptions/RulesChecksTab";
import { ResolutionLogTab } from "@/components/exceptions/ResolutionLogTab";
import { HealthDashboardTab } from "@/components/exceptions/HealthDashboardTab";
import { useExceptionStats } from "@/hooks/use-exceptions";
import { KpiCard } from "@/components/ui/kpi-card";
import { XCircle, AlertTriangle, Clock, CheckCircle, ShieldAlert, Info } from "lucide-react";

const tabs = [
  { value: "queue", label: "Exceptions Queue" },
  { value: "health", label: "Health Dashboard" },
  { value: "rules", label: "Rules & Checks" },
  { value: "log", label: "Resolution Log" },
];

export default function ExceptionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "queue";
  const setTab = (t: string) => setSearchParams({ tab: t });
  const { data: stats, isLoading } = useExceptionStats();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Exceptions Center</h1>
        <p className="text-sm text-muted-foreground mt-1">Unified control tower for operational & financial inconsistencies</p>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard
          title="Total Open"
          value={String(stats?.total_open || 0)}
          icon={<ShieldAlert className="w-4 h-4" />}
          loading={isLoading}
          className={stats?.total_open ? "border-amber-500/30" : ""}
        />
        <KpiCard
          title="Critical"
          value={String(stats?.critical || 0)}
          icon={<XCircle className="w-4 h-4" />}
          loading={isLoading}
          className={stats?.critical ? "border-destructive/50 bg-destructive/5" : ""}
        />
        <KpiCard
          title="High"
          value={String(stats?.high || 0)}
          icon={<AlertTriangle className="w-4 h-4" />}
          loading={isLoading}
          className={stats?.high ? "border-orange-500/30" : ""}
        />
        <KpiCard
          title="Medium"
          value={String(stats?.medium || 0)}
          icon={<Clock className="w-4 h-4" />}
          loading={isLoading}
        />
        <KpiCard
          title="Low"
          value={String(stats?.low || 0)}
          icon={<Info className="w-4 h-4" />}
          loading={isLoading}
        />
        <KpiCard
          title="Resolved Today"
          value={String(stats?.resolved_today || 0)}
          icon={<CheckCircle className="w-4 h-4" />}
          loading={isLoading}
          className="border-emerald-500/30"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setTab}>
        <TabsList>
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="queue"><ExceptionsQueueTab /></TabsContent>
        <TabsContent value="health"><HealthDashboardTab /></TabsContent>
        <TabsContent value="rules"><RulesChecksTab /></TabsContent>
        <TabsContent value="log"><ResolutionLogTab /></TabsContent>
      </Tabs>
    </div>
  );
}
