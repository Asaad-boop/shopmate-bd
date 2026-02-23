import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBDT, formatNumber } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { Link } from "react-router-dom";
import {
  ShoppingCart, TrendingUp, TrendingDown, AlertTriangle, Package, Truck, RotateCcw,
  CreditCard, Archive, Clock, CheckCircle2, XCircle, CornerDownLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Helpers ───
const fmt = (n?: number | null) => n != null ? `৳${n.toLocaleString()}` : "৳0";
const fmtL = (n?: number | null) => {
  if (n == null) return "৳0";
  if (Math.abs(n) >= 100000) return `৳${(n / 100000).toFixed(2)}L`;
  if (Math.abs(n) >= 1000) return `৳${(n / 1000).toFixed(1)}k`;
  return `৳${n.toLocaleString()}`;
};

export default function Dashboard() {
  // ─── Today Stats ───
  const { data: todayStats, isLoading: l1 } = useQuery({
    queryKey: ["dash-today"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("orders")
        .select("id, total_amount, gross_profit, status")
        .gte("order_date", today);
      const orders = data || [];
      const revenue = orders.reduce((s, o) => s + (o.total_amount || 0), 0);
      const profit = orders.reduce((s, o) => s + (o.gross_profit || 0), 0);
      const pending = orders.filter((o) => o.status === "pending" || o.status === "processing").length;
      return { count: orders.length, revenue, profit, pending, margin: revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : "0" };
    },
    refetchInterval: 300000,
  });

  // ─── Low Stock ───
  const { data: lowStock } = useQuery({
    queryKey: ["dash-low-stock"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, stock_quantity, reorder_point, sku")
        .eq("status", "active");
      return (data || []).filter((p) => (p.stock_quantity || 0) <= (p.reorder_point || 10));
    },
  });

  // ─── Monthly Stats ───
  const { data: monthStats, isLoading: l2 } = useQuery({
    queryKey: ["dash-month"],
    queryFn: async () => {
      const now = new Date();
      const startCur = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const startPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];
      const endPrev = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];

      const [{ data: cur }, { data: prev }] = await Promise.all([
        supabase.from("orders").select("total_amount, gross_profit, status").gte("order_date", startCur),
        supabase.from("orders").select("total_amount, gross_profit, status").gte("order_date", startPrev).lte("order_date", endPrev),
      ]);
      const curOrders = cur || [];
      const prevOrders = prev || [];

      const curRevenue = curOrders.reduce((s, o) => s + (o.total_amount || 0), 0);
      const prevRevenue = prevOrders.reduce((s, o) => s + (o.total_amount || 0), 0);
      const curProfit = curOrders.reduce((s, o) => s + (o.gross_profit || 0), 0);
      const prevProfit = prevOrders.reduce((s, o) => s + (o.gross_profit || 0), 0);
      const returned = curOrders.filter((o) => o.status === "returned").length;
      const returnRate = curOrders.length > 0 ? ((returned / curOrders.length) * 100).toFixed(1) : "0";
      const profitMargin = curRevenue > 0 ? ((curProfit / curRevenue) * 100).toFixed(1) : "0";

      const trendOrders = prevOrders.length > 0 ? (((curOrders.length - prevOrders.length) / prevOrders.length) * 100).toFixed(0) : "0";
      const trendRevenue = prevRevenue > 0 ? (((curRevenue - prevRevenue) / prevRevenue) * 100).toFixed(0) : "0";
      const trendProfit = prevProfit > 0 ? (((curProfit - prevProfit) / prevProfit) * 100).toFixed(0) : "0";

      return {
        orders: curOrders.length, revenue: curRevenue, profit: curProfit,
        returnRate, profitMargin,
        trendOrders, trendRevenue, trendProfit,
      };
    },
  });

  // ─── Chart Data (7 days) ───
  const { data: chartData, isLoading: l3 } = useQuery({
    queryKey: ["dash-chart-7d"],
    queryFn: async () => {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      const { data } = await supabase
        .from("daily_sales_view")
        .select("*")
        .gte("date", d.toISOString().split("T")[0])
        .order("date");
      return (data || []).map((r) => ({
        date: new Date(r.date!).getDate().toString(),
        orders: Number(r.total_orders || 0),
        revenue: Number(r.total_revenue || 0),
      }));
    },
  });

  // ─── Order Status (month) ───
  const { data: statusData } = useQuery({
    queryKey: ["dash-status-month"],
    queryFn: async () => {
      const start = new Date();
      start.setDate(1);
      const { data } = await supabase.from("orders").select("status").gte("order_date", start.toISOString().split("T")[0]);
      const orders = data || [];
      const total = orders.length || 1;
      const count = (s: string) => orders.filter((o) => o.status === s).length;
      return {
        processing: count("processing"), delivered: count("delivered"),
        cancelled: count("cancelled"), returned: count("returned"), total,
      };
    },
  });

  // ─── Top Products ───
  const { data: topProducts } = useQuery({
    queryKey: ["dash-top-products"],
    queryFn: async () => {
      const { data } = await supabase
        .from("order_items")
        .select("product_id, quantity, total_price, products(name, sku)");
      const map: Record<string, { name: string; sku: string; qty: number; revenue: number }> = {};
      (data || []).forEach((i: any) => {
        const id = i.product_id || "unknown";
        if (!map[id]) map[id] = { name: i.products?.name || "Unknown", sku: i.products?.sku || "", qty: 0, revenue: 0 };
        map[id].qty += i.quantity || 0;
        map[id].revenue += i.total_price || 0;
      });
      return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 5);
    },
  });

  // ─── Alerts ───
  const { data: alerts } = useQuery({
    queryKey: ["dash-alerts"],
    queryFn: async () => {
      const [{ data: overdue }, { data: followups }] = await Promise.all([
        supabase.from("payables").select("party_name, total_amount, paid_amount, due_date").lt("due_date", new Date().toISOString().split("T")[0]).neq("status", "paid"),
        supabase.from("customer_followups").select("customer_phone, note, due_at").eq("is_done", false).lte("due_at", new Date().toISOString()),
      ]);
      return { overdue: overdue || [], followups: followups || [] };
    },
  });

  // ─── Courier Performance ───
  const { data: courierPerf } = useQuery({
    queryKey: ["dash-courier"],
    queryFn: async () => {
      const start = new Date();
      start.setDate(1);
      const { data } = await supabase.from("courier_history").select("courier_name, status").gte("created_at", start.toISOString());
      const map: Record<string, { sent: number; delivered: number }> = {};
      (data || []).forEach((c) => {
        if (!map[c.courier_name]) map[c.courier_name] = { sent: 0, delivered: 0 };
        map[c.courier_name].sent++;
        if (c.status === "delivered") map[c.courier_name].delivered++;
      });
      return Object.entries(map).map(([name, v]) => ({
        name, sent: v.sent, rate: v.sent > 0 ? Math.round((v.delivered / v.sent) * 100) : 0,
      })).sort((a, b) => b.sent - a.sent);
    },
  });

  const alertCount = (lowStock?.length || 0) + (alerts?.overdue?.length || 0);

  const productIcons = ["🥇", "🥈", "🥉", "4", "5"];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ─── TODAY HERO BANNER ─── */}
      <div className="rounded-xl bg-card border border-border p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-live-pulse" />
            <span className="text-xs font-semibold text-green-600 uppercase tracking-wider">LIVE — TODAY'S PERFORMANCE</span>
          </div>
          <span className="text-[10px] text-muted-foreground">Auto-updates every 5 min</span>
        </div>
        {l1 ? (
          <div className="grid grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:divide-x divide-border">
            <HeroPill label="ORDERS TODAY" value={todayStats?.count?.toString() || "0"} sub="↑ 8 vs yesterday" color="text-foreground" />
            <HeroPill label="REVENUE" value={fmt(todayStats?.revenue)} sub="↑ 12% vs avg" color="text-green-600" />
            <HeroPill label="EST. PROFIT" value={fmt(todayStats?.profit)} sub={`${todayStats?.margin}% margin`} color="text-blue-600" />
            <HeroPill label="PENDING" value={todayStats?.pending?.toString() || "0"} sub="Need action" color="text-orange-600" />
            <HeroPill label="ALERTS" value={alertCount.toString()} sub="Low stock" color="text-red-600" />
          </div>
        )}
      </div>

      {/* ─── METRIC CARDS ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={<ShoppingCart className="w-4 h-4" />}
          label="ORDERS THIS MONTH"
          value={formatNumber(monthStats?.orders)}
          trend={monthStats?.trendOrders}
          borderColor="border-blue-500"
          iconBg="bg-blue-50 text-blue-600"
          loading={l2}
        />
        <MetricCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="REVENUE THIS MONTH"
          value={fmtL(monthStats?.revenue)}
          trend={monthStats?.trendRevenue}
          borderColor="border-green-500"
          iconBg="bg-green-50 text-green-600"
          loading={l2}
        />
        <MetricCard
          icon={<RotateCcw className="w-4 h-4" />}
          label="RETURN RATE"
          value={`${monthStats?.returnRate || 0}%`}
          trend={undefined}
          borderColor="border-red-500"
          iconBg="bg-red-50 text-red-600"
          loading={l2}
          warn={Number(monthStats?.returnRate || 0) > 15}
        />
        <MetricCard
          icon={<CreditCard className="w-4 h-4" />}
          label="NET PROFIT"
          value={fmtL(monthStats?.profit)}
          trend={monthStats?.trendProfit}
          borderColor="border-purple-500"
          iconBg="bg-purple-50 text-purple-600"
          loading={l2}
        />
      </div>

      {/* ─── ROW 3: Charts + Status + Activity ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr_1fr] gap-4">
        {/* Chart */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-xs font-semibold text-foreground uppercase tracking-wider">ORDERS & REVENUE</span>
            <span className="text-[10px] text-muted-foreground ml-auto">LAST 7 DAYS</span>
          </div>
          {l3 ? <Skeleton className="h-[240px]" /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(228 16% 90%)" />
                <XAxis dataKey="date" fontSize={11} tick={{ fill: "hsl(220 9% 46%)" }} />
                <YAxis fontSize={11} tick={{ fill: "hsl(220 9% 46%)" }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#fff", border: "1px solid hsl(228 16% 90%)", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "hsl(222 47% 11%)" }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="orders" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} name="Orders" />
                <Bar dataKey="revenue" fill="hsl(160, 84%, 39%)" radius={[4, 4, 0, 0]} name="Revenue" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Order Status */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-xs font-semibold uppercase tracking-wider">ORDER STATUS</span>
            </div>
            <span className="text-[10px] text-blue-400">This Month</span>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-4">
            <StatusBox icon={<Clock className="w-3 h-3" />} label="Processing" count={statusData?.processing || 0} total={statusData?.total || 1} color="text-blue-400" dotColor="bg-blue-400" />
            <StatusBox icon={<CheckCircle2 className="w-3 h-3" />} label="Delivered" count={statusData?.delivered || 0} total={statusData?.total || 1} color="text-green-400" dotColor="bg-green-400" />
            <StatusBox icon={<XCircle className="w-3 h-3" />} label="Cancelled" count={statusData?.cancelled || 0} total={statusData?.total || 1} color="text-red-400" dotColor="bg-red-400" />
            <StatusBox icon={<CornerDownLeft className="w-3 h-3" />} label="Returned" count={statusData?.returned || 0} total={statusData?.total || 1} color="text-orange-400" dotColor="bg-orange-400" />
          </div>
          <div className="border-t border-border pt-3">
            <p className="text-[10px] text-muted-foreground uppercase mb-2">7-Day Profit Trend</p>
            <div className="flex items-end gap-1 h-10">
              {(chartData || []).slice(-7).map((d, i) => {
                const maxR = Math.max(...(chartData || []).map((c) => c.revenue), 1);
                const h = Math.max((d.revenue / maxR) * 100, 10);
                return <div key={i} className="flex-1 rounded-sm bg-green-500/80" style={{ height: `${h}%` }} />;
              })}
            </div>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              <span className="text-xs font-semibold uppercase tracking-wider">ACTIVITY FEED</span>
            </div>
            <span className="text-[10px] text-muted-foreground">Live</span>
          </div>
          <ActivityFeed />
        </div>
      </div>

      {/* ─── ROW 4: Alerts + Top Products + Courier + Follow-ups ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr_1fr] gap-4">
        {/* Alerts */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-xs font-semibold uppercase tracking-wider">ALERTS</span>
            </div>
            {alertCount > 0 && (
              <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-semibold">{alertCount} active</span>
            )}
          </div>
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {lowStock?.slice(0, 4).map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg bg-accent/50">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <Package className="w-4 h-4 text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground">Only {p.stock_quantity} pcs left — reorder level: {p.reorder_point}</p>
                </div>
                <Link to="/purchase-orders" className="text-[10px] bg-red-500/20 text-red-400 px-2 py-1 rounded-md font-semibold hover:bg-red-500/30 transition-colors">
                  Reorder
                </Link>
              </div>
            ))}
            {alerts?.overdue?.slice(0, 2).map((p, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-accent/50">
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <CreditCard className="w-4 h-4 text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{p.party_name}</p>
                  <p className="text-[10px] text-muted-foreground">{fmt(p.total_amount - p.paid_amount)} overdue</p>
                </div>
                <Link to="/finance" className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-1 rounded-md font-semibold hover:bg-orange-500/30 transition-colors">
                  Pay
                </Link>
              </div>
            ))}
            {alertCount === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">No active alerts ✓</p>
            )}
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-500" />
              <span className="text-xs font-semibold uppercase tracking-wider">TOP PRODUCTS</span>
            </div>
            <span className="text-[10px] text-blue-400">This Month</span>
          </div>
          <div className="space-y-2">
            {topProducts?.map((p, i) => (
              <div key={i} className="flex items-center gap-3 p-1.5">
                <span className="text-sm w-6 text-center">{i < 3 ? productIcons[i] : <span className="font-mono-num text-xs text-muted-foreground">{i + 1}</span>}</span>
                <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
                  <Package className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground font-mono-num">{p.sku}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold font-mono-num text-foreground">{p.qty}</p>
                  <p className="text-[10px] text-muted-foreground font-mono-num">{fmtL(p.revenue)}</p>
                </div>
              </div>
            ))}
            {(!topProducts || topProducts.length === 0) && (
              <p className="text-xs text-muted-foreground text-center py-6">No data yet</p>
            )}
          </div>
        </div>

        {/* Courier Performance */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-xs font-semibold uppercase tracking-wider">COURIER PERFORMANCE</span>
            </div>
            <span className="text-[10px] text-blue-400">This Month</span>
          </div>
          <div className="space-y-1">
            <div className="grid grid-cols-3 gap-2 text-[10px] text-muted-foreground font-semibold uppercase pb-1 border-b border-border">
              <span>COURIER</span><span className="text-center">SENT</span><span className="text-right">RATE</span>
            </div>
            {courierPerf?.map((c, i) => (
              <div key={i} className="grid grid-cols-3 gap-2 items-center py-1.5">
                <span className="text-xs text-foreground">{c.name}</span>
                <span className="text-xs font-mono-num text-center text-muted-foreground">{c.sent}</span>
                <span className={cn(
                  "text-xs font-mono-num font-bold text-right px-2 py-0.5 rounded-md w-fit ml-auto",
                  c.rate >= 85 ? "bg-green-500/20 text-green-400" : c.rate >= 75 ? "bg-orange-500/20 text-orange-400" : "bg-red-500/20 text-red-400"
                )}>
                  {c.rate}%
                </span>
              </div>
            ))}
            {(!courierPerf || courierPerf.length === 0) && (
              <p className="text-xs text-muted-foreground text-center py-6">No courier data</p>
            )}
          </div>
        </div>

        {/* Follow-ups */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-yellow-500" />
              <span className="text-xs font-semibold uppercase tracking-wider">FOLLOW-UPS</span>
            </div>
            {(alerts?.followups?.length || 0) > 0 && (
              <span className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full font-semibold">{alerts?.followups?.length} today</span>
            )}
          </div>
          <div className="space-y-2">
            {alerts?.followups?.slice(0, 4).map((f, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-accent/50">
                <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center text-[10px] font-bold text-orange-400">
                  {f.customer_phone?.slice(-2) || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{f.customer_phone}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{f.note || "Follow-up due"}</p>
                </div>
                <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-md font-semibold">Overdue</span>
              </div>
            ))}
            {(!alerts?.followups || alerts.followups.length === 0) && (
              <p className="text-xs text-muted-foreground text-center py-6">No follow-ups due ✓</p>
            )}
          </div>

          {/* Payable mini */}
          {(alerts?.overdue?.length || 0) > 0 && (
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-[10px] text-muted-foreground uppercase mb-2">Urgent Payments</p>
              {alerts?.overdue?.slice(0, 2).map((p, i) => (
                <div key={i} className="flex items-center justify-between py-1">
                  <span className="text-xs text-foreground">{p.party_name}</span>
                  <span className="text-xs font-mono-num text-red-400">{fmt(p.total_amount - p.paid_amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-Components ───

function HeroPill({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="pl-4 first:pl-0">
      <p className={cn("text-2xl font-bold font-mono-num", color)}>{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{label}</p>
      <p className="text-[10px] text-green-600 mt-0.5">{sub}</p>
    </div>
  );
}

function MetricCard({ icon, label, value, trend, borderColor, iconBg, loading, warn }: {
  icon: React.ReactNode; label: string; value: string; trend?: string; borderColor: string; iconBg: string; loading?: boolean; warn?: boolean;
}) {
  if (loading) return <div className={cn("bg-card rounded-xl border-t-2 border border-border p-4", borderColor)}><Skeleton className="h-14" /></div>;
  const trendNum = Number(trend || 0);
  return (
    <div className={cn("bg-card rounded-xl border border-border p-4 border-t-2", borderColor)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-2xl font-bold font-mono-num text-foreground">{value}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">{label}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", iconBg)}>{icon}</div>
          {trend !== undefined && (
            <span className={cn(
              "text-[10px] font-semibold px-1.5 py-0.5 rounded-md",
              trendNum >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
            )}>
              {trendNum >= 0 ? "↑" : "↓"} {Math.abs(trendNum)}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBox({ icon, label, count, total, color, dotColor }: {
  icon: React.ReactNode; label: string; count: number; total: number; color: string; dotColor: string;
}) {
  const pct = ((count / total) * 100).toFixed(1);
  return (
    <div className="bg-accent/50 rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <span className={cn("w-1.5 h-1.5 rounded-full", dotColor)} />
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
      <p className={cn("text-lg font-bold font-mono-num", color)}>{count}</p>
      <p className="text-[10px] text-muted-foreground font-mono-num">{pct}%</p>
    </div>
  );
}

function ActivityFeed() {
  const { data: recentOrders } = useQuery({
    queryKey: ["dash-activity"],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, status, created_at, total_amount")
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
  });

  const iconMap: Record<string, { icon: React.ElementType; bg: string; color: string }> = {
    pending: { icon: ShoppingCart, bg: "bg-green-500/10", color: "text-green-400" },
    processing: { icon: Truck, bg: "bg-blue-500/10", color: "text-blue-400" },
    delivered: { icon: CheckCircle2, bg: "bg-green-500/10", color: "text-green-400" },
    cancelled: { icon: XCircle, bg: "bg-red-500/10", color: "text-red-400" },
    returned: { icon: CornerDownLeft, bg: "bg-orange-500/10", color: "text-orange-400" },
  };

  return (
    <div className="space-y-2">
      {recentOrders?.map((o) => {
        const cfg = iconMap[o.status || "pending"] || iconMap.pending;
        const Icon = cfg.icon;
        const ago = getTimeAgo(o.created_at);
        return (
          <div key={o.id} className="flex items-start gap-3 py-1.5">
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", cfg.bg)}>
              <Icon className={cn("w-3.5 h-3.5", cfg.color)} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground">
                {o.status === "pending" ? "New order" : o.status === "processing" ? "Dispatched" : o.status === "delivered" ? "Delivered" : o.status === "returned" ? "Return" : "Order"}{" "}
                <span className="font-semibold">#{o.order_number}</span>
              </p>
              <p className="text-[10px] text-muted-foreground">{fmt(o.total_amount)}</p>
            </div>
            <span className="text-[10px] text-muted-foreground shrink-0">{ago}</span>
          </div>
        );
      })}
      {(!recentOrders || recentOrders.length === 0) && (
        <p className="text-xs text-muted-foreground text-center py-6">No recent activity</p>
      )}
    </div>
  );
}

function getTimeAgo(dateStr?: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}
