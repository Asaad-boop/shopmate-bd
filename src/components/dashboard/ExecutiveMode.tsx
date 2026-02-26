import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { formatBDT, formatNumber } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  useExecKpis, useExecPipeline, useExecAlerts, useExecCharts, useExecFinance,
} from "@/hooks/use-exec-dashboard";
import { HeroKpi, AlertItem, PipelineStage, delta } from "./DashboardShared";
import {
  ShoppingCart, DollarSign, TrendingUp, Wallet, RotateCcw, AlertTriangle,
  ArrowRight, Activity,
} from "lucide-react";
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import { OrdersBySourcePanel } from "./OrdersBySourcePanel";
import { TopProductsPanel } from "./TopProductsPanel";

interface Props { from: string; to: string; }

export function ExecutiveMode({ from, to }: Props) {
  const navigate = useNavigate();
  const { data: kpis, isLoading: kpiL } = useExecKpis(from, to);
  const { data: pipeline, isLoading: pipeL } = useExecPipeline(from, to);
  const { data: alerts, isLoading: alertL } = useExecAlerts();
  const { data: finance, isLoading: finL } = useExecFinance();
  const { data: charts, isLoading: chartL } = useExecCharts(14);

  const pipelineMap = useMemo(() => {
    const m: Record<string, { count: number; total_amount: number }> = {};
    (pipeline || []).forEach((s) => { m[s.status] = s; });
    return m;
  }, [pipeline]);
  const stageOf = (status: string) => pipelineMap[status] || { count: 0, total_amount: 0 };

  const chartData = useMemo(() =>
    (charts || []).map((d) => ({
      ...d,
      label: new Date(d.day).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
      return_rate: d.delivered > 0 ? Math.round((d.returns / (d.delivered + d.returns)) * 100) : 0,
    })), [charts]);

  const totalAlerts = alerts
    ? alerts.pending_24h + alerts.intransit_5d + alerts.delivered_unsettled + alerts.missing_courier_cost + alerts.negative_stock + alerts.unposted_2d + alerts.exceptions_open
    : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* KPI Strip */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <HeroKpi label="Total Orders" value={formatNumber(kpis?.total_orders)} icon={ShoppingCart}
          delta={kpis ? delta(kpis.total_orders, kpis.prev_total_orders) : undefined}
          onClick={() => navigate("/orders")} loading={kpiL} />
        <HeroKpi label="Delivered Revenue" value={formatBDT(kpis?.delivered_revenue)} icon={DollarSign}
          delta={kpis ? delta(kpis.delivered_revenue, kpis.prev_delivered_revenue) : undefined}
          onClick={() => navigate("/reports/pnl")} loading={kpiL} accent="bg-success/10 text-success" />
        <HeroKpi label="Gross Profit" value={formatBDT(kpis?.gross_profit)} icon={TrendingUp}
          delta={kpis ? delta(kpis.gross_profit, kpis.prev_gross_profit) : undefined}
          onClick={() => navigate("/reports/pnl")} loading={kpiL} accent="bg-success/10 text-success" />
        <HeroKpi label="Net Profit" value={formatBDT((kpis?.gross_profit ?? 0) * 0.7)} icon={TrendingUp}
          onClick={() => navigate("/reports/pnl")} loading={kpiL} accent="bg-success/10 text-success" />
        <HeroKpi label="Liquid Cash" value={formatBDT(finance?.total_liquid)} icon={Wallet}
          onClick={() => navigate("/finance/accounts")} loading={finL} accent="bg-info/10 text-info" />
        <HeroKpi label="Exceptions" value={String(alerts?.exceptions_open ?? 0)} icon={AlertTriangle}
          sub={totalAlerts > 0 ? `${totalAlerts} total alerts` : "All clear"}
          onClick={() => navigate("/exceptions")} loading={alertL}
          accent={totalAlerts > 0 ? "bg-warning/10 text-warning" : "bg-success/10 text-success"} />
      </section>

      {/* Smart Alerts */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Smart Alerts</CardTitle>
          {totalAlerts > 0 && <Badge variant="destructive" className="text-xs">{totalAlerts}</Badge>}
        </CardHeader>
        <CardContent className="space-y-0.5 max-h-[240px] overflow-y-auto">
          {alertL ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-11 rounded-xl" />)}</div>
          ) : totalAlerts === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
              <Activity className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm font-medium">All systems healthy</p>
            </div>
          ) : (
            <>
              <AlertItem label="Pending > 24h" count={alerts?.pending_24h || 0} severity="high" to="/orders?status=pending" />
              <AlertItem label="In transit > 5 days" count={alerts?.intransit_5d || 0} severity="critical" to="/orders?status=in_transit" />
              <AlertItem label="Delivered, not settled" count={alerts?.delivered_unsettled || 0} amount={alerts?.delivered_unsettled_amt} severity="high" to="/finance/settlements" />
              <AlertItem label="Missing courier cost" count={alerts?.missing_courier_cost || 0} severity="medium" to="/exceptions" />
              <AlertItem label="Negative stock SKUs" count={alerts?.negative_stock || 0} severity="critical" to="/inventory" />
              <AlertItem label="Open exceptions" count={alerts?.exceptions_open || 0} severity="high" to="/exceptions" />
            </>
          )}
        </CardContent>
      </Card>

      {/* Pipeline */}
      <section>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Order Pipeline</p>
        {pipeL ? (
          <div className="grid grid-cols-5 gap-3">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-[110px] rounded-2xl" />)}</div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {[
              { status: "pending", label: "Pending", emoji: "🕐" },
              { status: "in_transit", label: "In Transit", emoji: "🚚" },
              { status: "delivered", label: "Delivered", emoji: "✅" },
              { status: "returned", label: "Returned", emoji: "↩️" },
              { status: "cancelled", label: "Cancelled", emoji: "❌" },
            ].map((s) => (
              <PipelineStage key={s.status} label={s.label} emoji={s.emoji}
                count={stageOf(s.status).count} amount={stageOf(s.status).total_amount}
                onClick={() => navigate(`/orders?status=${s.status}`)} />
            ))}
          </div>
        )}
      </section>

      {/* Charts */}
      <section>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">14-Day Performance</p>
        {chartL ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-[220px] rounded-2xl" />)}</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-1"><CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Revenue</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={chartData}>
                    <defs><linearGradient id="gRevE" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15} /><stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => formatBDT(v)} contentStyle={{ borderRadius: 12, fontSize: 12, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#gRevE)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-1"><CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Net Profit</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={chartData}>
                    <defs><linearGradient id="gProfE" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.15} /><stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => formatBDT(v)} contentStyle={{ borderRadius: 12, fontSize: 12, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    <Area type="monotone" dataKey="profit" stroke="hsl(var(--success))" strokeWidth={2} fill="url(#gProfE)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-1"><CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Return Rate %</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                    <Tooltip formatter={(v: number) => `${v}%`} contentStyle={{ borderRadius: 12, fontSize: 12, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    <Line type="monotone" dataKey="return_rate" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}
      </section>

      {/* Bottom: Top Products + Source */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TopProductsPanel from={from} to={to} />
        <OrdersBySourcePanel from={from} to={to} />
      </div>
    </div>
  );
}
