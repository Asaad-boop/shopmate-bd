import { useState, useMemo, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { formatBDT, formatNumber } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useExecKpis,
  useExecPipeline,
  useExecAlerts,
  useExecInventory,
  useExecFinance,
  useExecCharts,
  useExecMarketing,
} from "@/hooks/use-exec-dashboard";
import {
  ShoppingCart, Truck, RotateCcw, DollarSign, TrendingUp, TrendingDown,
  Wallet, Landmark, Smartphone, Banknote, Boxes, CreditCard, RefreshCw,
  Plus, Upload, Receipt, Package, AlertTriangle, ShieldAlert, ArrowRight,
  ArrowUpRight, ArrowDownRight, Scan, Printer, Globe, Megaphone,
  BarChart3, FileDown, PackageOpen, CircleDollarSign, Activity,
} from "lucide-react";
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import { WebOrderPerformancePanel } from "@/components/dashboard/WebOrderPerformancePanel";
import { OrdersBySourcePanel } from "@/components/dashboard/OrdersBySourcePanel";
import { OrderFlowTrendPanel } from "@/components/dashboard/OrderFlowTrendPanel";
import { HourlyOrdersPanel } from "@/components/dashboard/HourlyOrdersPanel";
import { TopProductsPanel } from "@/components/dashboard/TopProductsPanel";

// ─── Date range helpers ───
function getDateRange(preset: string): { from: string; to: string; label: string } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  switch (preset) {
    case "yesterday": {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return { from: fmt(y), to: fmt(y), label: "Yesterday" };
    }
    case "7d": {
      const s = new Date(today);
      s.setDate(s.getDate() - 6);
      return { from: fmt(s), to: fmt(today), label: "Last 7 Days" };
    }
    case "month": {
      const s = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: fmt(s), to: fmt(today), label: "This Month" };
    }
    case "30d": {
      const s = new Date(today);
      s.setDate(s.getDate() - 29);
      return { from: fmt(s), to: fmt(today), label: "Last 30 Days" };
    }
    default:
      return { from: fmt(today), to: fmt(today), label: "Today" };
  }
}

function delta(cur: number, prev: number): { pct: number; positive: boolean } {
  if (prev === 0) return { pct: cur > 0 ? 100 : 0, positive: cur >= 0 };
  const pct = ((cur - prev) / Math.abs(prev)) * 100;
  return { pct: Math.abs(Math.round(pct * 10) / 10), positive: pct >= 0 };
}

// ─── Components ───

function HeroKpi({
  label, value, sub, icon: Icon, delta: d, onClick, loading, accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  delta?: { pct: number; positive: boolean };
  onClick?: () => void;
  loading?: boolean;
  accent?: string;
}) {
  if (loading) return <Skeleton className="h-[120px] rounded-2xl" />;
  return (
    <button
      onClick={onClick}
      className="bg-card rounded-2xl p-5 text-left transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 group border border-transparent hover:border-primary/10 w-full"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accent || "bg-primary/10 text-primary"}`}>
          <Icon className="w-5 h-5" />
        </div>
        {d && d.pct > 0 && (
          <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${d.positive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
            {d.positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {d.pct}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold font-mono tracking-tight">{value}</p>
      <p className="text-[11px] font-medium text-muted-foreground mt-1 uppercase tracking-wider">{label}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </button>
  );
}

function AlertItem({
  label, count, amount, severity, to,
}: {
  label: string;
  count: number;
  amount?: number;
  severity: "critical" | "high" | "medium";
  to: string;
}) {
  const nav = useNavigate();
  if (count === 0) return null;
  const colors = {
    critical: "bg-destructive text-destructive-foreground",
    high: "bg-warning text-warning-foreground",
    medium: "bg-muted text-muted-foreground",
  };
  return (
    <button
      onClick={() => nav(to)}
      className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl hover:bg-accent/60 transition-colors text-left group"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className={`w-2 h-2 rounded-full shrink-0 ${severity === "critical" ? "bg-destructive" : severity === "high" ? "bg-warning" : "bg-muted-foreground/40"}`} />
        <span className="text-sm font-medium truncate">{label}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {amount != null && amount > 0 && (
          <span className="text-xs text-muted-foreground font-mono">{formatBDT(amount)}</span>
        )}
        <Badge className={`text-xs ${colors[severity]}`}>{count}</Badge>
        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </button>
  );
}

function PipelineStage({
  label, emoji, count, amount, onClick, active,
}: {
  label: string;
  emoji: string;
  count: number;
  amount: number;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 min-w-[120px] rounded-xl p-4 text-center transition-all duration-200 hover:shadow-md ${active ? "bg-primary/10 ring-1 ring-primary/20" : "bg-card hover:bg-accent/50"}`}
    >
      <span className="text-lg">{emoji}</span>
      <p className="text-xl font-bold font-mono mt-1">{formatNumber(count)}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-0.5">{label}</p>
      <p className="text-xs text-muted-foreground font-mono mt-0.5">{formatBDT(amount)}</p>
    </button>
  );
}

function QuickActionBtn({
  icon: Icon, label, onClick,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 p-3 rounded-xl bg-card hover:bg-accent/50 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 min-w-[88px]"
    >
      <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
        <Icon className="w-4.5 h-4.5" />
      </div>
      <span className="text-[11px] font-medium text-center leading-tight">{label}</span>
    </button>
  );
}

// ─── Main Dashboard ───

export default function Dashboard() {
  const navigate = useNavigate();
  const [datePreset, setDatePreset] = useState("today");
  const { from, to, label: periodLabel } = useMemo(() => getDateRange(datePreset), [datePreset]);

  const { data: kpis, isLoading: kpiL } = useExecKpis(from, to);
  const { data: pipeline, isLoading: pipeL } = useExecPipeline(from, to);
  const { data: alerts, isLoading: alertL } = useExecAlerts();
  const { data: inventory, isLoading: invL } = useExecInventory();
  const { data: finance, isLoading: finL } = useExecFinance();
  const { data: charts, isLoading: chartL } = useExecCharts(14);
  const { data: marketing, isLoading: mktL } = useExecMarketing(from, to);

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
    <div className="space-y-6 animate-fade-in max-w-[1400px] mx-auto">
      {/* ─── Row 0: Header + Filter Bar ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sticky top-0 z-10 bg-background/80 backdrop-blur-md -mx-6 px-6 py-3 -mt-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">{periodLabel} • Executive Overview</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={datePreset} onValueChange={setDatePreset}>
            <SelectTrigger className="w-[140px] h-9 text-sm bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => window.location.reload()}>
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Button variant="ghost" size="sm" className="h-9 gap-1.5">
            <FileDown className="w-3.5 h-3.5" /> PDF
          </Button>
        </div>
      </div>

      {/* ─── Row 1: Hero KPIs ─── */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <HeroKpi
          label="Total Orders" value={formatNumber(kpis?.total_orders)} icon={ShoppingCart}
          delta={kpis ? delta(kpis.total_orders, kpis.prev_total_orders) : undefined}
          onClick={() => navigate("/orders")} loading={kpiL}
        />
        <HeroKpi
          label="Delivered Revenue" value={formatBDT(kpis?.delivered_revenue)} icon={DollarSign}
          delta={kpis ? delta(kpis.delivered_revenue, kpis.prev_delivered_revenue) : undefined}
          onClick={() => navigate("/reports/pnl")} loading={kpiL}
          accent="bg-success/10 text-success"
        />
        <HeroKpi
          label="Gross Profit" value={formatBDT(kpis?.gross_profit)} icon={TrendingUp}
          delta={kpis ? delta(kpis.gross_profit, kpis.prev_gross_profit) : undefined}
          onClick={() => navigate("/reports/pnl")} loading={kpiL}
          accent="bg-success/10 text-success"
        />
        <HeroKpi
          label="Liquid Cash" value={formatBDT(finance?.total_liquid)} icon={Wallet}
          onClick={() => navigate("/finance/accounts")} loading={finL}
          accent="bg-info/10 text-info"
        />
        <HeroKpi
          label="Return Rate" value={`${kpis?.return_rate ?? 0}%`} icon={RotateCcw}
          sub={`${kpis?.returned ?? 0} returns`}
          delta={kpis ? { ...delta(kpis.return_rate, kpis.prev_return_rate), positive: kpis.return_rate <= kpis.prev_return_rate } : undefined}
          onClick={() => navigate("/orders?status=returned")} loading={kpiL}
          accent="bg-destructive/10 text-destructive"
        />
        <HeroKpi
          label="Exceptions" value={String(alerts?.exceptions_open ?? 0)} icon={AlertTriangle}
          sub={totalAlerts > 0 ? `${totalAlerts} total alerts` : "All clear"}
          onClick={() => navigate("/exceptions")} loading={alertL}
          accent={totalAlerts > 0 ? "bg-warning/10 text-warning" : "bg-success/10 text-success"}
        />
      </section>

      {/* ─── Row 2: Quick Actions + Smart Alerts ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Quick Actions */}
        <Card className="lg:col-span-2 border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-2">
              <QuickActionBtn icon={Plus} label="New Order" onClick={() => navigate("/orders/new")} />
              <QuickActionBtn icon={Globe} label="Web Orders" onClick={() => navigate("/web-orders")} />
              <QuickActionBtn icon={Scan} label="Scan Update" onClick={() => navigate("/orders/scan")} />
              <QuickActionBtn icon={Printer} label="Print List" onClick={() => navigate("/orders/approved")} />
              <QuickActionBtn icon={Truck} label="Courier Sync" onClick={() => navigate("/orders")} />
              <QuickActionBtn icon={Upload} label="Settlement" onClick={() => navigate("/finance/settlements")} />
              <QuickActionBtn icon={Receipt} label="Add Expense" onClick={() => navigate("/expenses")} />
              <QuickActionBtn icon={PackageOpen} label="Receive GRN" onClick={() => navigate("/purchasing")} />
            </div>
          </CardContent>
        </Card>

        {/* Smart Alerts */}
        <Card className="lg:col-span-3 border-0 shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Smart Alerts</CardTitle>
            {totalAlerts > 0 && <Badge variant="destructive" className="text-xs">{totalAlerts}</Badge>}
          </CardHeader>
          <CardContent className="space-y-0.5 max-h-[280px] overflow-y-auto">
            {alertL ? (
              <div className="space-y-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-11 rounded-xl" />)}</div>
            ) : totalAlerts === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Activity className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-sm font-medium">All systems healthy</p>
                <p className="text-xs">No critical alerts right now</p>
              </div>
            ) : (
              <>
                <AlertItem label="Pending orders > 24h" count={alerts?.pending_24h || 0} severity="high" to="/orders?status=pending" />
                <AlertItem label="In transit > 5 days" count={alerts?.intransit_5d || 0} severity="critical" to="/orders?status=in_transit" />
                <AlertItem label="Delivered, not settled" count={alerts?.delivered_unsettled || 0} amount={alerts?.delivered_unsettled_amt} severity="high" to="/finance/settlements" />
                <AlertItem label="Missing courier cost" count={alerts?.missing_courier_cost || 0} severity="medium" to="/exceptions" />
                <AlertItem label="Missing SKU cost" count={alerts?.missing_sku_cost || 0} severity="medium" to="/exceptions" />
                <AlertItem label="Negative stock SKUs" count={alerts?.negative_stock || 0} severity="critical" to="/inventory" />
                <AlertItem label="Unposted events > 2 days" count={alerts?.unposted_2d || 0} severity="high" to="/finance/posting-queue" />
                <AlertItem label="Open exceptions" count={alerts?.exceptions_open || 0} severity="high" to="/exceptions" />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Row 3: Pipeline Overview ─── */}
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
              <PipelineStage
                key={s.status}
                label={s.label}
                emoji={s.emoji}
                count={stageOf(s.status).count}
                amount={stageOf(s.status).total_amount}
                onClick={() => navigate(`/orders?status=${s.status}`)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ─── Row 4: Finance Executive Panel ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-0 shadow-sm cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate("/finance/accounts")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Accounts Snapshot</CardTitle>
          </CardHeader>
          <CardContent>
            {finL ? <Skeleton className="h-[140px]" /> : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Cash", value: finance?.cash, icon: Banknote },
                    { label: "Bank", value: finance?.bank, icon: Landmark },
                    { label: "bKash", value: finance?.bkash, icon: Smartphone },
                    { label: "Nagad", value: finance?.nagad, icon: Smartphone },
                  ].map((a) => (
                    <div key={a.label} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-accent/30">
                      <a.icon className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{a.label}</p>
                        <p className="text-sm font-bold font-mono">{formatBDT(a.value)}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-primary/5 rounded-xl p-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Total Liquid</span>
                  <span className="text-lg font-bold font-mono">{formatBDT(finance?.total_liquid)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate("/finance/settlements")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Settlement & Receivable</CardTitle>
          </CardHeader>
          <CardContent>
            {finL ? <Skeleton className="h-[140px]" /> : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-warning/5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Courier Receivable</p>
                    <p className="text-lg font-bold font-mono text-warning">{formatBDT(finance?.courier_receivable)}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-success/5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Settled This Month</p>
                    <p className="text-lg font-bold font-mono text-success">{finance?.settlements_posted ?? 0}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={(e) => { e.stopPropagation(); navigate("/finance/settlements"); }}>
                  <Upload className="w-3.5 h-3.5" /> Upload Settlement
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Row 5: Inventory Executive Panel ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-0 shadow-sm cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate("/reports/inventory-valuation")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Inventory Value</CardTitle>
          </CardHeader>
          <CardContent>
            {invL ? <Skeleton className="h-[100px]" /> : (
              <div className="space-y-3">
                <p className="text-2xl font-bold font-mono">{formatBDT(inventory?.total_value)}</p>
                <div className="flex gap-4">
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground font-medium">Low Stock</p>
                    <p className="text-sm font-bold text-warning">{inventory?.low_stock ?? 0} SKUs</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground font-medium">Dead Stock (60d)</p>
                    <p className="text-sm font-bold text-destructive">{inventory?.dead_stock ?? 0} SKUs</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate("/reports/sku-profit")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Top Movers (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            {invL ? <Skeleton className="h-[100px]" /> : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground font-medium mb-1.5">By Quantity</p>
                  {(inventory?.top_by_qty || []).slice(0, 3).map((p, i) => (
                    <div key={i} className="flex items-center justify-between py-1">
                      <span className="text-xs truncate max-w-[120px]">{p.name}</span>
                      <span className="text-xs font-mono font-semibold">{p.qty}</span>
                    </div>
                  ))}
                  {(!inventory?.top_by_qty?.length) && <p className="text-xs text-muted-foreground">No data yet</p>}
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground font-medium mb-1.5">By Profit</p>
                  {(inventory?.top_by_profit || []).slice(0, 3).map((p, i) => (
                    <div key={i} className="flex items-center justify-between py-1">
                      <span className="text-xs truncate max-w-[120px]">{p.name}</span>
                      <span className="text-xs font-mono font-semibold text-success">{formatBDT(p.profit)}</span>
                    </div>
                  ))}
                  {(!inventory?.top_by_profit?.length) && <p className="text-xs text-muted-foreground">No data yet</p>}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Row 6: Performance Charts ─── */}
      <section>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">14-Day Performance</p>
        {chartL ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-[220px] rounded-2xl" />)}</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Revenue Chart */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => formatBDT(v)} contentStyle={{ borderRadius: 12, fontSize: 12, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#gRev)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Profit Chart */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Net Profit</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="gProfit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => formatBDT(v)} contentStyle={{ borderRadius: 12, fontSize: 12, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    <Area type="monotone" dataKey="profit" stroke="hsl(var(--success))" strokeWidth={2} fill="url(#gProfit)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Return Rate Chart */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Return Rate %</CardTitle>
              </CardHeader>
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

      {/* ─── Row 7: Marketing Snapshot ─── */}
      <Card className="border-0 shadow-sm rounded-[18px] cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate("/marketing")}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Megaphone className="w-4 h-4" /> Marketing Snapshot
          </CardTitle>
        </CardHeader>
        <CardContent>
          {mktL ? <Skeleton className="h-[60px]" /> : (
            <div className="flex flex-wrap gap-6">
              <div>
                <p className="text-[10px] uppercase text-muted-foreground font-medium">Meta Ads Spend</p>
                <p className="text-lg font-bold font-mono">{formatBDT(marketing?.meta_spend)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground font-medium">Influencer / UGC</p>
                <p className="text-lg font-bold font-mono">{formatBDT(marketing?.influencer_spend)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground font-medium">Marketing % of Revenue</p>
                <p className="text-lg font-bold font-mono">{marketing?.marketing_pct ?? 0}%</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground font-medium">Total Marketing</p>
                <p className="text-lg font-bold font-mono">{formatBDT(marketing?.total_marketing)}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Row 8: Advanced Analytics ─── */}
      <section className="space-y-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Advanced Analytics</p>

        {/* Web Order Performance + Orders by Source */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <WebOrderPerformancePanel />
          <OrdersBySourcePanel from={from} to={to} />
        </div>

        {/* Order Flow Trend (full width) */}
        <OrderFlowTrendPanel />

        {/* Hourly Orders + Top Products */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <HourlyOrdersPanel />
          <TopProductsPanel from={from} to={to} />
        </div>
      </section>
    </div>
  );
}
