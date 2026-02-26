import { useNavigate } from "react-router-dom";
import { formatBDT, formatNumber, formatDateTime } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOpsKpis, useOpsCourierPerformance, useOpsRecentActivity } from "@/hooks/use-ops-dashboard";
import { useExecAlerts } from "@/hooks/use-exec-dashboard";
import { HeroKpi, QuickActionBtn } from "./DashboardShared";
import { HourlyOrdersPanel } from "./HourlyOrdersPanel";
import {
  Clock, Truck, CheckCircle, RotateCcw, AlertTriangle, Package,
  Plus, Globe, Scan, Printer, Upload, ArrowRight, Activity,
} from "lucide-react";

interface Props { from: string; to: string; }

export function OperationsMode({ from, to }: Props) {
  const navigate = useNavigate();
  const { data: kpis, isLoading: kpiL } = useOpsKpis(from, to);
  const { data: alerts, isLoading: alertL } = useExecAlerts();
  const { data: courierPerf, isLoading: cpL } = useOpsCourierPerformance();
  const { data: activity, isLoading: actL } = useOpsRecentActivity();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* KPI Strip */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <HeroKpi label="Pending Orders" value={formatNumber(kpis?.pending_orders)} icon={Clock}
          onClick={() => navigate("/orders?status=pending")} loading={kpiL} accent="bg-warning/10 text-warning" />
        <HeroKpi label="Ready to Dispatch" value={formatNumber(kpis?.ready_to_dispatch)} icon={Package}
          onClick={() => navigate("/orders/approved")} loading={kpiL} accent="bg-info/10 text-info" />
        <HeroKpi label="In Transit" value={formatNumber(kpis?.in_transit)} icon={Truck}
          onClick={() => navigate("/orders?status=in_transit")} loading={kpiL} />
        <HeroKpi label="Delivered Today" value={formatNumber(kpis?.delivered_today)} icon={CheckCircle}
          onClick={() => navigate("/orders?status=delivered")} loading={kpiL} accent="bg-success/10 text-success" />
        <HeroKpi label="Returned Today" value={formatNumber(kpis?.returned_today)} icon={RotateCcw}
          onClick={() => navigate("/orders?status=returned")} loading={kpiL} accent="bg-destructive/10 text-destructive" />
        <HeroKpi label="Sync Errors" value={formatNumber(kpis?.courier_sync_errors)} icon={AlertTriangle}
          onClick={() => navigate("/exceptions")} loading={kpiL}
          accent={(kpis?.courier_sync_errors ?? 0) > 0 ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"} />
      </section>

      {/* Quick Action Dock */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
            <QuickActionBtn icon={Plus} label="New Order" onClick={() => navigate("/orders/new")} />
            <QuickActionBtn icon={Globe} label="Web Orders" onClick={() => navigate("/web-orders")} />
            <QuickActionBtn icon={Printer} label="Print Picking" onClick={() => navigate("/orders/approved")} />
            <QuickActionBtn icon={Truck} label="Courier Sync" onClick={() => navigate("/orders")} />
            <QuickActionBtn icon={Scan} label="Scan Update" onClick={() => navigate("/orders/scan")} />
            <QuickActionBtn icon={Upload} label="Courier Entry" onClick={() => navigate("/orders")} />
            <QuickActionBtn icon={RotateCcw} label="Returns" onClick={() => navigate("/orders?status=returned")} />
          </div>
        </CardContent>
      </Card>

      {/* Ops Queue Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Pending > 24h", count: alerts?.pending_24h ?? 0, severity: "high" as const, to: "/orders?status=pending", icon: "🕐" },
          { label: "In Transit > 5 days", count: alerts?.intransit_5d ?? 0, severity: "critical" as const, to: "/orders?status=in_transit", icon: "🚚" },
          { label: "Delivered not settled", count: alerts?.delivered_unsettled ?? 0, severity: "high" as const, to: "/finance/settlements", icon: "💰", amount: alerts?.delivered_unsettled_amt },
        ].map((q) => (
          <button key={q.label} onClick={() => navigate(q.to)}
            className="bg-card rounded-2xl p-5 text-left hover:shadow-lg transition-all group">
            {alertL ? <Skeleton className="h-16" /> : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg">{q.icon}</span>
                  <Badge className={`text-xs ${q.severity === "critical" ? "bg-destructive text-destructive-foreground" : "bg-warning text-warning-foreground"}`}>
                    {q.count}
                  </Badge>
                </div>
                <p className="text-sm font-medium">{q.label}</p>
                {q.amount != null && q.amount > 0 && (
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{formatBDT(q.amount)}</p>
                )}
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground mt-2 opacity-0 group-hover:opacity-100 transition-opacity" />
              </>
            )}
          </button>
        ))}
      </div>

      {/* Courier Performance + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Courier Performance Mini */}
        <Card className="border-0 shadow-sm cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate("/reports/courier-performance")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Courier Performance (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            {cpL ? <Skeleton className="h-[160px]" /> : (
              <div className="space-y-2.5">
                {(courierPerf || []).length === 0 && (
                  <p className="text-sm text-muted-foreground py-4 text-center">No courier data yet</p>
                )}
                {(courierPerf || []).map((c) => (
                  <div key={c.courier_name} className="flex items-center justify-between p-2.5 rounded-xl bg-accent/30">
                    <div>
                      <p className="text-sm font-medium">{c.courier_name}</p>
                      <p className="text-[10px] text-muted-foreground">{c.delivered}/{c.total} delivered • Avg {c.avg_days}d</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold font-mono ${c.success_rate >= 70 ? "text-success" : "text-destructive"}`}>
                        {c.success_rate}%
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono">{formatBDT(c.avg_cost)} avg</p>
                    </div>
                  </div>
                ))}
                <Button variant="ghost" size="sm" className="w-full text-xs gap-1" onClick={(e) => { e.stopPropagation(); navigate("/reports/courier-performance"); }}>
                  View Full Report <ArrowRight className="w-3 h-3" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Latest Activity */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Latest Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {actL ? <Skeleton className="h-[160px]" /> : (
              <div className="space-y-1 max-h-[240px] overflow-y-auto">
                {(activity || []).length === 0 && (
                  <div className="flex flex-col items-center py-6 text-muted-foreground">
                    <Activity className="w-6 h-6 mb-1 opacity-40" />
                    <p className="text-xs">No recent activity</p>
                  </div>
                )}
                {(activity || []).map((a) => (
                  <div key={a.id} className="flex items-start gap-2.5 py-2 border-b border-border/50 last:border-0">
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

      {/* Hourly Orders */}
      <HourlyOrdersPanel />
    </div>
  );
}
