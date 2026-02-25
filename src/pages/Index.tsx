import { formatBDT } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import {
  useTodayKpis,
  useCashPosition,
  useWorkingCapital,
  use14DayTrend,
  useDashboardAlerts,
  useRefreshDashboard,
} from "@/hooks/use-executive-dashboard";
import {
  ShoppingCart,
  Truck,
  RotateCcw,
  DollarSign,
  TrendingUp,
  Wallet,
  Landmark,
  Smartphone,
  Banknote,
  Boxes,
  Users,
  CreditCard,
  RefreshCw,
  Plus,
  Upload,
  Receipt,
  Package,
  AlertTriangle,
  ShieldAlert,
  ArrowRight,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const mono = "font-mono";

function KpiTile({
  label,
  value,
  icon: Icon,
  loading,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  loading?: boolean;
  accent?: string;
}) {
  if (loading) return <Skeleton className="h-[88px] rounded-xl" />;
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${accent || "bg-primary/10 text-primary"}`}>
        <Icon className="w-4.5 h-4.5" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider truncate">{label}</p>
        <p className={`text-lg font-bold mt-0.5 ${mono} truncate`}>{value}</p>
      </div>
    </div>
  );
}

function AlertRow({
  label,
  count,
  to,
  severity,
}: {
  label: string;
  count: number;
  to: string;
  severity: "destructive" | "warning" | "default";
}) {
  const nav = useNavigate();
  if (count === 0) return null;
  return (
    <button
      onClick={() => nav(to)}
      className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-accent/60 transition-colors text-left group"
    >
      <div className="flex items-center gap-2.5">
        <ShieldAlert className={`w-4 h-4 ${severity === "destructive" ? "text-destructive" : severity === "warning" ? "text-warning" : "text-muted-foreground"}`} />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={severity === "destructive" ? "destructive" : severity === "warning" ? "outline" : "secondary"} className="text-xs">
          {count}
        </Badge>
        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </button>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const refresh = useRefreshDashboard();

  const { data: kpis, isLoading: kpiLoading } = useTodayKpis();
  const { data: cash, isLoading: cashLoading } = useCashPosition();
  const { data: wc, isLoading: wcLoading } = useWorkingCapital();
  const { data: trend, isLoading: trendLoading } = use14DayTrend();
  const { data: alerts, isLoading: alertsLoading } = useDashboardAlerts();

  const todayProfit = (kpis?.today_revenue || 0) - (kpis?.today_cogs || 0) - (kpis?.today_courier_cost || 0);
  const totalLiquid = (cash?.cash || 0) + (cash?.bank || 0) + (cash?.bkash || 0) + (cash?.nagad || 0);
  const totalAlerts = alerts
    ? alerts.not_synced + alerts.settlement_pending + alerts.negative_stock + alerts.advance_not_posted + alerts.supplier_overdue + alerts.unposted_journals
    : 0;

  const chartData = (trend || []).map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Control Tower</h1>
          <p className="text-muted-foreground text-sm">Real-time executive overview</p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} className="gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {/* SECTION 1: Today KPIs */}
      <section>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Today's Snapshot</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiTile label="Orders Created" value={String(kpis?.orders_created ?? "—")} icon={ShoppingCart} loading={kpiLoading} />
          <KpiTile label="Delivered" value={String(kpis?.orders_delivered ?? "—")} icon={Truck} loading={kpiLoading} accent="bg-success/10 text-success" />
          <KpiTile label="Returns" value={String(kpis?.returns_today ?? "—")} icon={RotateCcw} loading={kpiLoading} accent="bg-destructive/10 text-destructive" />
          <KpiTile label="Revenue" value={formatBDT(kpis?.today_revenue)} icon={DollarSign} loading={kpiLoading} />
          <KpiTile label="Net Profit" value={formatBDT(todayProfit)} icon={TrendingUp} loading={kpiLoading} accent="bg-success/10 text-success" />
        </div>
      </section>

      {/* SECTION 2 + 3: Cash Position & Working Capital */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Cash Position */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Cash Position</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <KpiTile label="Cash" value={formatBDT(cash?.cash)} icon={Banknote} loading={cashLoading} />
              <KpiTile label="Bank" value={formatBDT(cash?.bank)} icon={Landmark} loading={cashLoading} />
              <KpiTile label="bKash" value={formatBDT(cash?.bkash)} icon={Smartphone} loading={cashLoading} />
              <KpiTile label="Nagad" value={formatBDT(cash?.nagad)} icon={Smartphone} loading={cashLoading} />
            </div>
            <div className="bg-primary/5 rounded-lg p-3 flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Total Liquid Cash</span>
              <span className={`text-lg font-bold ${mono}`}>{cashLoading ? "..." : formatBDT(totalLiquid)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Working Capital */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Working Capital</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <KpiTile label="Inventory Value" value={formatBDT(wc?.inventory_value)} icon={Boxes} loading={wcLoading} />
              <KpiTile label="Courier Receivable" value={formatBDT(wc?.courier_receivable)} icon={Truck} loading={wcLoading} accent="bg-warning/10 text-warning" />
              <KpiTile label="Supplier Payable" value={formatBDT(wc?.supplier_payable)} icon={CreditCard} loading={wcLoading} accent="bg-destructive/10 text-destructive" />
              <KpiTile label="Customer Advances" value={formatBDT(wc?.customer_advances)} icon={Users} loading={wcLoading} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SECTION 4 + 5: Chart & Alerts side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 14-Day Chart */}
        <Card className="lg:col-span-2 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">14-Day Performance</CardTitle>
          </CardHeader>
          <CardContent>
            {trendLoading ? (
              <Skeleton className="h-[260px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(v: number) => formatBDT(v)}
                    contentStyle={{ borderRadius: 8, fontSize: 12, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                  />
                  <Line type="monotone" dataKey="revenue" name="Revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="profit" name="Profit" stroke="hsl(var(--success))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Alerts Panel */}
        <Card className="border-border">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Alerts
            </CardTitle>
            {totalAlerts > 0 && (
              <Badge variant="destructive" className="text-xs">{totalAlerts}</Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-0.5">
            {alertsLoading ? (
              <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : totalAlerts === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">All clear — no critical alerts 🎉</p>
            ) : (
              <>
                <AlertRow label="Courier not synced" count={alerts?.not_synced || 0} to="/old-orders" severity="warning" />
                <AlertRow label="Settlement pending >5d" count={alerts?.settlement_pending || 0} to="/old-orders" severity="destructive" />
                <AlertRow label="Negative stock items" count={alerts?.negative_stock || 0} to="/inventory" severity="destructive" />
                <AlertRow label="Advance not posted" count={alerts?.advance_not_posted || 0} to="/finance/posting-queue" severity="warning" />
                <AlertRow label="Supplier payment overdue" count={alerts?.supplier_overdue || 0} to="/purchasing?tab=payables" severity="warning" />
                <AlertRow label="Unposted journals" count={alerts?.unposted_journals || 0} to="/accounting?tab=journal" severity="default" />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* SECTION 6: Quick Actions */}
      <section>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Quick Actions</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => navigate("/orders/new")} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> New Order
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/orders/import-legacy")} className="gap-1.5">
            <Upload className="w-3.5 h-3.5" /> Import Legacy
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/expenses")} className="gap-1.5">
            <Receipt className="w-3.5 h-3.5" /> Add Expense
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/finance/posting-queue")} className="gap-1.5">
            <Wallet className="w-3.5 h-3.5" /> Post Settlements
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/purchasing")} className="gap-1.5">
            <Package className="w-3.5 h-3.5" /> Receive Import
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/exceptions")} className="gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Exceptions
          </Button>
        </div>
      </section>
    </div>
  );
}
