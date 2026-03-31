import { useMemo, memo } from "react";
import { useNavigate } from "react-router-dom";
import { formatBDT, formatNumber } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useExecKpis, useExecPipeline, useExecAlerts, useExecCharts, useExecFinance,
} from "@/hooks/use-exec-dashboard";
import { useTopProducts, useOrdersBySource } from "@/hooks/use-dashboard-analytics";
import { KpiCard, AlertItem, PipelineStage } from "./DashboardShared";
import {
  DollarSign, TrendingUp, Wallet, ShoppingBag, Activity,
  ArrowRight, Package, AlertTriangle, Clock, Truck,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell,
} from "recharts";

interface Props { from: string; to: string; }

const STATUS_COLORS: Record<string, string> = {
  pending: "hsl(38, 92%, 50%)",
  confirmed: "hsl(200, 80%, 50%)",
  packed: "hsl(217, 91%, 60%)",
  ready_to_ship: "hsl(180, 60%, 45%)",
  shipped: "hsl(262, 83%, 58%)",
  in_transit: "hsl(280, 50%, 55%)",
  delivered: "hsl(160, 60%, 40%)",
  cancelled: "hsl(0, 72%, 51%)",
  returned: "hsl(215, 16%, 55%)",
};

export const ExecutiveMode = memo(function ExecutiveMode({ from, to }: Props) {
  const navigate = useNavigate();
  const { data: kpis, isLoading: kpiL, isError: kpiErr } = useExecKpis(from, to);
  const { data: pipeline, isLoading: pipeL } = useExecPipeline(from, to);
  const { data: alerts, isLoading: alertL } = useExecAlerts();
  const { data: finance, isLoading: finL } = useExecFinance();
  const { data: charts, isLoading: chartL } = useExecCharts(14);
  const { data: topProducts, isLoading: tpL } = useTopProducts(from, to);
  const { data: sourceData, isLoading: srcL } = useOrdersBySource(from, to);

  // Derived values - handle RPC errors gracefully
  const revenue = kpis?.delivered_revenue ?? 0;
  const profit = kpis?.gross_profit ?? 0;
  const totalOrders = kpis?.total_orders ?? 0;
  const delivered = kpis?.delivered ?? 0;
  const liquidCash = finance?.total_liquid ?? 0;

  const prevRevenue = kpis?.prev_delivered_revenue ?? 0;
  const revDelta = useMemo(() => ({
    pct: prevRevenue > 0 ? Math.abs(Math.round(((revenue - prevRevenue) / prevRevenue) * 100)) : 0,
    positive: revenue >= prevRevenue,
  }), [revenue, prevRevenue]);

  const profitMargin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

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
    })), [charts]);

  const totalAlerts = alerts
    ? alerts.pending_24h + alerts.intransit_5d + alerts.delivered_unsettled + alerts.missing_courier_cost + alerts.negative_stock + alerts.unposted_2d + alerts.exceptions_open
    : 0;

  // Pipeline donut for status distribution
  const pipelineDonut = useMemo(() => {
    const statuses = ["pending", "confirmed", "packed", "ready_to_ship", "shipped", "in_transit", "delivered", "cancelled", "returned"];
    return statuses
      .map(s => ({ status: s, count: stageOf(s).count, fill: STATUS_COLORS[s] || "hsl(215,16%,55%)" }))
      .filter(s => s.count > 0);
  }, [pipelineMap]);

  return (
    <div className="space-y-5">
      {/* KPI Cards - 4 columns */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Revenue"
          value={formatBDT(revenue)}
          icon={DollarSign}
          color="bg-primary/10 text-primary"
          delta={revDelta}
          sub="vs previous period"
          onClick={() => navigate("/reports/pnl")}
          loading={kpiL}
        />
        <KpiCard
          label="Net Profit"
          value={formatBDT(profit)}
          icon={TrendingUp}
          color={profit >= 0 ? "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]" : "bg-destructive/10 text-destructive"}
          sub={`${profitMargin}% margin`}
          subColor={profit >= 0 ? "text-[hsl(var(--success))]" : "text-destructive"}
          onClick={() => navigate("/reports/pnl")}
          loading={kpiL}
        />
        <KpiCard
          label="Total Cash & Bank"
          value={formatBDT(liquidCash)}
          icon={Wallet}
          color="bg-[hsl(var(--info))]/10 text-[hsl(var(--info))]"
          sub={finance ? `Cash: ${formatBDT(finance.cash)} | Bank: ${formatBDT(finance.bank)} | Mobile: ${formatBDT((finance.bkash ?? 0) + (finance.nagad ?? 0))}` : "Loading..."}
          onClick={() => navigate("/finance/accounts")}
          loading={finL}
        />
        <KpiCard
          label="Orders Today"
          value={formatNumber(totalOrders)}
          icon={ShoppingBag}
          color="bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]"
          sub={`${delivered} delivered | ${kpis?.returned ?? 0} returned`}
          onClick={() => navigate("/orders")}
          loading={kpiL}
        />
      </section>

      {/* Charts Row: Revenue Trend + Order Status Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border-border rounded-xl">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              14-Day Revenue Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartL ? <Skeleton className="h-[260px] rounded-xl" /> : chartData.length === 0 ? (
              <div className="flex items-center justify-center h-[260px] text-muted-foreground text-sm">No chart data available</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="gRevExec" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(262, 83%, 58%)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="hsl(262, 83%, 58%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(v: number) => formatBDT(v)}
                    contentStyle={{
                      borderRadius: 12, fontSize: 12,
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      boxShadow: "0 4px 20px -4px rgba(0,0,0,0.1)",
                    }}
                  />
                  <Area type="monotone" dataKey="revenue" name="Revenue"
                    stroke="hsl(262, 83%, 58%)" strokeWidth={2.5}
                    fill="url(#gRevExec)" dot={false}
                    activeDot={{ r: 4, fill: "hsl(262, 83%, 58%)" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Order Status Pipeline Donut */}
        <Card className="border-border rounded-xl">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Order Status Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pipeL ? <Skeleton className="h-[260px] rounded-xl" /> : pipelineDonut.length === 0 ? (
              <div className="flex items-center justify-center h-[260px] text-muted-foreground text-sm">No orders in pipeline</div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="relative w-[160px] h-[160px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pipelineDonut} cx="50%" cy="50%" innerRadius={50} outerRadius={72}
                        dataKey="count" strokeWidth={2} stroke="hsl(var(--card))">
                        {pipelineDonut.map((s, i) => (
                          <Cell key={i} fill={s.fill} className="cursor-pointer"
                            onClick={() => navigate(`/orders?status=${s.status}`)} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-bold tabular-nums">
                      {pipelineDonut.reduce((a, b) => a + b.count, 0)}
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase">Total</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-3 w-full">
                  {pipelineDonut.map((s, i) => (
                    <button key={i}
                      onClick={() => navigate(`/orders?status=${s.status}`)}
                      className="flex items-center gap-1.5 py-1 hover:bg-accent/50 rounded px-1.5 transition-colors">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.fill }} />
                      <span className="text-[11px] capitalize truncate flex-1">{s.status.replace(/_/g, " ")}</span>
                      <span className="text-[11px] font-semibold tabular-nums">{s.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom: Top Products + Alert Center */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top 5 Products */}
        <Card className="border-border rounded-xl">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Top 5 Products This Month
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"
              onClick={() => navigate("/reports/sku-profit")}>
              View All <ArrowRight className="w-3 h-3" />
            </Button>
          </CardHeader>
          <CardContent>
            {tpL ? <Skeleton className="h-[200px] rounded-xl" /> : (!topProducts || topProducts.length === 0) ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Package className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-sm font-medium">No sales data yet</p>
              </div>
            ) : (
              <div className="space-y-1">
                {topProducts.map((p, i) => {
                  const maxRev = topProducts[0]?.revenue || 1;
                  const widthPct = Math.max(10, (p.revenue / maxRev) * 100);
                  return (
                    <button key={i}
                      onClick={() => navigate(`/reports/sku-profit?sku=${p.sku}`)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent/50 transition-colors group">
                      <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">#{i + 1}</span>
                      <div className="w-9 h-9 rounded-lg bg-accent/50 flex items-center justify-center overflow-hidden shrink-0">
                        {p.thumbnail ? (
                          <img src={p.thumbnail} alt={p.name} className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <div className="w-full bg-accent/30 rounded-full h-1.5 mt-1">
                          <div className="bg-primary rounded-full h-1.5 transition-all" style={{ width: `${widthPct}%` }} />
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold tabular-nums">{formatNumber(p.sales_count)} sold</p>
                        <p className="text-[10px] text-muted-foreground tabular-nums">{formatBDT(p.revenue)}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Alert Center */}
        <Card className="border-border rounded-xl">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Alert Center
            </CardTitle>
            {totalAlerts > 0 && (
              <Badge variant="destructive" className="text-[10px] px-2 py-0.5 rounded-full">
                {totalAlerts} active
              </Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-1.5 max-h-[280px] overflow-y-auto">
            {alertL ? (
              <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
            ) : totalAlerts === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Activity className="w-6 h-6 mb-2 opacity-30" />
                <p className="text-sm font-medium">All systems healthy</p>
                <p className="text-xs">No alerts at this time</p>
              </div>
            ) : (
              <>
                <AlertItem label="Unsettled COD > 7 days" icon="💰" count={alerts?.delivered_unsettled || 0}
                  amount={alerts?.delivered_unsettled_amt} severity="critical" to="/courier-cod" />
                <AlertItem label="Pending orders > 24h" icon="🕐" count={alerts?.pending_24h || 0}
                  severity="high" to="/orders?status=pending" />
                <AlertItem label="In transit > 5 days" icon="🚚" count={alerts?.intransit_5d || 0}
                  severity="critical" to="/orders?status=in_transit" />
                <AlertItem label="Posting queue pending" icon="📋" count={alerts?.unposted_2d || 0}
                  severity="info" to="/finance/posting-queue" />
                <AlertItem label="Low stock / negative" icon="📦" count={alerts?.negative_stock || 0}
                  severity="high" to="/inventory" />
                <AlertItem label="Missing SKU cost" icon="⚠️" count={alerts?.missing_sku_cost || 0}
                  severity="medium" to="/products" />
                <AlertItem label="Open exceptions" icon="🔴" count={alerts?.exceptions_open || 0}
                  severity="high" to="/exceptions" />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
});
