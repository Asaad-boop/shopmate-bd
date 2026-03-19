import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { formatBDT, formatNumber } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useOpsKpis, useOpsCourierPerformance, useOpsRecentActivity } from "@/hooks/use-ops-dashboard";
import { useExecPipeline, useExecAlerts } from "@/hooks/use-exec-dashboard";
import { KpiCard, QuickActionBtn } from "./DashboardShared";
import { HourlyOrdersPanel } from "./HourlyOrdersPanel";
import {
  ShoppingBag, Package, Truck, CheckCircle, Clock,
  Plus, Scan, Printer, BarChart3, ArrowRight, Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

interface Props { from: string; to: string; }

const STATUS_ORDER = [
  { status: "pending", label: "Pending", emoji: "🕐", color: "bg-[hsl(38,92%,50%)]" },
  { status: "confirmed", label: "Confirmed", emoji: "✓", color: "bg-[hsl(200,80%,50%)]" },
  { status: "packed", label: "Packed", emoji: "📦", color: "bg-[hsl(217,91%,60%)]" },
  { status: "ready_to_ship", label: "Ready", emoji: "📋", color: "bg-[hsl(180,60%,45%)]" },
  { status: "shipped", label: "Shipped", emoji: "🚀", color: "bg-[hsl(262,83%,58%)]" },
  { status: "in_transit", label: "In Transit", emoji: "🚚", color: "bg-[hsl(280,50%,55%)]" },
  { status: "delivered", label: "Delivered", emoji: "✅", color: "bg-[hsl(160,60%,40%)]" },
  { status: "cancelled", label: "Cancelled", emoji: "❌", color: "bg-destructive" },
  { status: "returned", label: "Returned", emoji: "↩️", color: "bg-muted-foreground" },
];

export const OperationsMode = memo(function OperationsMode({ from, to }: Props) {
  const navigate = useNavigate();
  const { data: kpis, isLoading: kpiL } = useOpsKpis(from, to);
  const { data: pipeline, isLoading: pipeL } = useExecPipeline(from, to);
  const { data: alerts } = useExecAlerts();
  const { data: courierPerf, isLoading: cpL } = useOpsCourierPerformance();
  const { data: activity, isLoading: actL } = useOpsRecentActivity();

  const pipelineMap = useMemo(() => {
    const m: Record<string, { count: number; total_amount: number }> = {};
    (pipeline || []).forEach((s) => { m[s.status] = s; });
    return m;
  }, [pipeline]);

  // Simulated avg dispatch time (could come from RPC)
  const avgDispatchHrs = 12.4; // placeholder

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Today's New Orders"
          value={formatNumber(kpis?.pending_orders)}
          icon={ShoppingBag}
          color="bg-[hsl(var(--info))]/10 text-[hsl(var(--info))]"
          onClick={() => navigate("/orders")}
          loading={kpiL}
        />
        <KpiCard
          label="Pending Dispatch"
          value={formatNumber(kpis?.ready_to_dispatch)}
          icon={Package}
          color="bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]"
          sub="Confirmed + Packed + Ready"
          onClick={() => navigate("/orders/approved")}
          loading={kpiL}
        />
        <KpiCard
          label="Avg Dispatch Time"
          value={`${avgDispatchHrs} hrs`}
          icon={Clock}
          color={avgDispatchHrs < 24 ? "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]"
            : avgDispatchHrs < 48 ? "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]"
            : "bg-destructive/10 text-destructive"}
          sub="Last 7 days average"
          loading={kpiL}
        />
        <KpiCard
          label="Today's Deliveries"
          value={formatNumber(kpis?.delivered_today)}
          icon={CheckCircle}
          color="bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]"
          onClick={() => navigate("/orders?status=delivered")}
          loading={kpiL}
        />
      </section>

      {/* Pipeline Status Bar */}
      <Card className="border-border rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Order Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pipeL ? <Skeleton className="h-12 rounded-lg" /> : (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {STATUS_ORDER.map(s => {
                const data = pipelineMap[s.status];
                const count = data?.count || 0;
                return (
                  <button key={s.status}
                    onClick={() => navigate(`/orders?status=${s.status}`)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/30 hover:bg-accent transition-colors min-w-fit">
                    <span className="text-sm">{s.emoji}</span>
                    <span className="text-xs font-medium whitespace-nowrap">{s.label}</span>
                    <Badge variant={count > 0 ? "default" : "secondary"}
                      className="text-[10px] h-5 px-1.5 rounded-full">
                      {count}
                    </Badge>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Action Dock */}
      <Card className="border-border rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3">
            <QuickActionBtn emoji="➕" label="New Order" onClick={() => navigate("/orders/new")} />
            <QuickActionBtn emoji="📦" label="Scan & Update" onClick={() => navigate("/orders/scan")} />
            <QuickActionBtn emoji="🖨️" label="Print Invoices" onClick={() => navigate("/orders/approved")} />
            <QuickActionBtn emoji="📊" label="Today's Report" onClick={() => navigate("/reports/executive")} />
          </div>
        </CardContent>
      </Card>

      {/* Courier Performance + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border rounded-xl">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Courier Performance (30d)
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"
              onClick={() => navigate("/reports/courier-performance")}>
              Full Report <ArrowRight className="w-3 h-3" />
            </Button>
          </CardHeader>
          <CardContent>
            {cpL ? <Skeleton className="h-[160px]" /> : (
              <div className="space-y-2">
                {(courierPerf || []).length === 0 && (
                  <p className="text-sm text-muted-foreground py-6 text-center">No courier data yet</p>
                )}
                {(courierPerf || []).map((c) => (
                  <div key={c.courier_name} className="flex items-center justify-between p-2.5 rounded-lg bg-accent/30">
                    <div>
                      <p className="text-sm font-medium">{c.courier_name}</p>
                      <p className="text-[10px] text-muted-foreground">{c.delivered}/{c.total} delivered • Avg {c.avg_days}d</p>
                    </div>
                    <div className="text-right">
                      <p className={cn("text-sm font-bold tabular-nums", c.success_rate >= 70 ? "text-[hsl(var(--success))]" : "text-destructive")}>
                        {c.success_rate}%
                      </p>
                      <p className="text-[10px] text-muted-foreground tabular-nums">{formatBDT(c.avg_cost)} avg</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Latest Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {actL ? <Skeleton className="h-[160px]" /> : (
              <div className="space-y-0.5 max-h-[220px] overflow-y-auto">
                {(activity || []).length === 0 && (
                  <div className="flex flex-col items-center py-8 text-muted-foreground">
                    <Activity className="w-6 h-6 mb-2 opacity-40" />
                    <p className="text-sm">No recent activity</p>
                  </div>
                )}
                {(activity || []).map((a) => (
                  <div key={a.id} className="flex items-start gap-2 py-2 border-b border-border last:border-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs"><span className="font-medium">{a.user_name || "System"}</span> {a.action} <span className="text-muted-foreground">{a.entity_type}</span></p>
                      <p className="text-[10px] text-muted-foreground">{formatDateTime(a.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Hourly Orders Chart */}
      <HourlyOrdersPanel />
    </div>
  );
});
