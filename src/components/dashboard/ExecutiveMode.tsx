import { useMemo, memo } from "react";
import { useNavigate } from "react-router-dom";
import { formatBDT, formatNumber } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  useExecKpis, useExecPipeline, useExecAlerts, useExecCharts, useExecFinance,
} from "@/hooks/use-exec-dashboard";
import { AlertItem, PipelineStage, delta } from "./DashboardShared";
import {
  ShoppingCart, DollarSign, TrendingUp, Wallet, AlertTriangle,
  ArrowRight, Activity, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import { OrdersBySourcePanel } from "./OrdersBySourcePanel";
import { TopProductsPanel } from "./TopProductsPanel";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { cn } from "@/lib/utils";

interface Props { from: string; to: string; }

/* ─── Premium KPI Card ─── */
const ExecKpiCard = memo(function ExecKpiCard({
  label, value, sub, icon: Icon, delta: d, onClick, loading, accentBg, accentText,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  delta?: { pct: number; positive: boolean };
  onClick?: () => void;
  loading?: boolean;
  accentBg?: string;
  accentText?: string;
}) {
  if (loading) return <Skeleton className="h-[110px] rounded-2xl" />;
  return (
    <button
      onClick={onClick}
      className={cn(
        "bg-card rounded-2xl p-5 text-left w-full border border-border/50",
        "transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]",
        "hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:-translate-y-[2px]",
        "active:scale-[0.985] group"
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center",
          accentBg || "bg-primary/8",
          accentText || "text-primary"
        )}>
          <Icon className="w-5 h-5" />
        </div>
        {d && d.pct > 0 && (
          <span className={cn(
            "inline-flex items-center gap-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-full",
            d.positive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
          )}>
            {d.positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {d.pct}%
          </span>
        )}
      </div>
      <AnimatedCounter value={value} className="text-2xl font-bold font-mono tracking-tight text-foreground" />
      <p className="text-[11px] font-semibold text-muted-foreground mt-1.5 uppercase tracking-wider">{label}</p>
      {sub && <p className="text-xs text-muted-foreground/70 mt-0.5">{sub}</p>}
    </button>
  );
});

export const ExecutiveMode = memo(function ExecutiveMode({ from, to }: Props) {
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
      {/* ─── KPI Cards ─── */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <ExecKpiCard label="Total Orders" value={formatNumber(kpis?.total_orders)} icon={ShoppingCart}
          delta={kpis ? delta(kpis.total_orders, kpis.prev_total_orders) : undefined}
          onClick={() => navigate("/orders")} loading={kpiL} />
        <ExecKpiCard label="Delivered Revenue" value={formatBDT(kpis?.delivered_revenue)} icon={DollarSign}
          delta={kpis ? delta(kpis.delivered_revenue, kpis.prev_delivered_revenue) : undefined}
          onClick={() => navigate("/reports/pnl")} loading={kpiL}
          accentBg="bg-success/10" accentText="text-success" />
        <ExecKpiCard label="Gross Profit" value={formatBDT(kpis?.gross_profit)} icon={TrendingUp}
          delta={kpis ? delta(kpis.gross_profit, kpis.prev_gross_profit) : undefined}
          onClick={() => navigate("/reports/pnl")} loading={kpiL}
          accentBg="bg-success/10" accentText="text-success" />
        <ExecKpiCard label="Net Profit" value={formatBDT((kpis?.gross_profit ?? 0) * 0.7)} icon={TrendingUp}
          onClick={() => navigate("/reports/pnl")} loading={kpiL}
          accentBg="bg-success/10" accentText="text-success" />
        <ExecKpiCard label="Liquid Cash" value={formatBDT(finance?.total_liquid)} icon={Wallet}
          onClick={() => navigate("/finance/accounts")} loading={finL}
          accentBg="bg-info/10" accentText="text-info" />
        <ExecKpiCard label="Exceptions" value={String(alerts?.exceptions_open ?? 0)} icon={AlertTriangle}
          sub={totalAlerts > 0 ? `${totalAlerts} total alerts` : "All clear"}
          onClick={() => navigate("/exceptions")} loading={alertL}
          accentBg={totalAlerts > 0 ? "bg-warning/10" : "bg-success/10"}
          accentText={totalAlerts > 0 ? "text-warning" : "text-success"} />
      </section>

      {/* ─── Smart Alerts ─── */}
      <Card className="border-border/50 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-1.5 h-5 rounded-full bg-primary" />
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Smart Alerts
            </CardTitle>
          </div>
          {totalAlerts > 0 && (
            <Badge variant="destructive" className="text-xs font-bold px-2.5 py-0.5">
              {totalAlerts}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-0.5 max-h-[280px] overflow-y-auto">
          {alertL ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-11 rounded-xl" />)}</div>
          ) : totalAlerts === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Activity className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm font-medium">All systems healthy</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">No alerts at this time</p>
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

      {/* ─── Pipeline ─── */}
      <section>
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-1.5 h-5 rounded-full bg-primary/60" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Order Pipeline</p>
        </div>
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

      {/* ─── 14-Day Charts ─── */}
      <section>
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-1.5 h-5 rounded-full bg-primary/60" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">14-Day Performance</p>
        </div>
        {chartL ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-[220px] rounded-2xl" />)}</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="border-border/50 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
              <CardHeader className="pb-1"><CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Revenue</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={chartData}>
                    <defs><linearGradient id="gRevE" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.12} /><stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => formatBDT(v)} contentStyle={{ borderRadius: 12, fontSize: 12, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#gRevE)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
              <CardHeader className="pb-1"><CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Net Profit</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={chartData}>
                    <defs><linearGradient id="gProfE" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.12} /><stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => formatBDT(v)} contentStyle={{ borderRadius: 12, fontSize: 12, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    <Area type="monotone" dataKey="profit" stroke="hsl(var(--success))" strokeWidth={2} fill="url(#gProfE)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
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

      {/* ─── Bottom Panels ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TopProductsPanel from={from} to={to} />
        <OrdersBySourcePanel from={from} to={to} />
      </div>
    </div>
  );
});
