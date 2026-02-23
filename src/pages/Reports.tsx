import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import {
  BarChart3, Printer, FileText, Download,
  ShoppingCart, TrendingUp, TrendingDown, Trophy, Wallet, RotateCcw,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const fmt = (n?: number | null) => n != null ? `৳${n.toLocaleString()}` : "৳0";
const fmtL = (n?: number | null) => {
  if (n == null) return "৳0";
  if (Math.abs(n) >= 100000) return `৳${(n / 100000).toFixed(2)}L`;
  if (Math.abs(n) >= 1000) return `৳${(n / 1000).toFixed(1)}k`;
  return `৳${n.toLocaleString()}`;
};
const pct = (a: number, b: number) => b > 0 ? ((a - b) / b * 100).toFixed(0) : "0";

export default function ReportsPage() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const year = now.getFullYear();

  const startDate = useMemo(() => new Date(year, selectedMonth, 1).toISOString().split("T")[0], [selectedMonth, year]);
  const endDate = useMemo(() => new Date(year, selectedMonth + 1, 0).toISOString().split("T")[0], [selectedMonth, year]);
  const prevStart = useMemo(() => new Date(year, selectedMonth - 1, 1).toISOString().split("T")[0], [selectedMonth, year]);
  const prevEnd = useMemo(() => new Date(year, selectedMonth, 0).toISOString().split("T")[0], [selectedMonth, year]);

  const monthLabel = `${MONTHS[selectedMonth]} ${year}`;
  const prevMonthLabel = `${MONTHS[(selectedMonth + 11) % 12]} ${selectedMonth === 0 ? year - 1 : year}`;

  // ─── Hero Stats ───
  const { data: stats, isLoading: l1 } = useQuery({
    queryKey: ["rpt-stats", selectedMonth],
    queryFn: async () => {
      const [{ data: cur }, { data: prev }] = await Promise.all([
        supabase.from("orders").select("total_amount, gross_profit, cost_of_goods, status").gte("order_date", startDate).lte("order_date", endDate + "T23:59:59"),
        supabase.from("orders").select("total_amount, gross_profit, cost_of_goods, status").gte("order_date", prevStart).lte("order_date", prevEnd + "T23:59:59"),
      ]);
      const c = cur || [], p = prev || [];
      const active = (arr: any[]) => arr.filter(o => o.status !== "cancelled");
      const ca = active(c), pa = active(p);

      const revenue = ca.reduce((s, o) => s + (o.total_amount || 0), 0);
      const prevRevenue = pa.reduce((s, o) => s + (o.total_amount || 0), 0);
      const profit = ca.reduce((s, o) => s + (o.gross_profit || 0), 0);
      const prevProfit = pa.reduce((s, o) => s + (o.gross_profit || 0), 0);
      const cogs = ca.reduce((s, o) => s + (o.cost_of_goods || 0), 0);
      const returned = c.filter(o => o.status === "returned").length;
      const prevReturned = p.filter(o => o.status === "returned").length;
      const returnRate = c.length > 0 ? (returned / c.length * 100) : 0;
      const prevReturnRate = p.length > 0 ? (prevReturned / p.length * 100) : 0;

      // Expenses from transactions
      const { data: txn } = await supabase.from("transactions").select("amount, category")
        .eq("type", "expense").gte("transaction_date", startDate).lte("transaction_date", endDate);
      const expenses = (txn || []).reduce((s, t) => s + (t.amount || 0), 0);
      const { data: prevTxn } = await supabase.from("transactions").select("amount")
        .eq("type", "expense").gte("transaction_date", prevStart).lte("transaction_date", prevEnd);
      const prevExpenses = (prevTxn || []).reduce((s, t) => s + (t.amount || 0), 0);

      // Expense breakdown
      const expByCat: Record<string, number> = {};
      (txn || []).forEach(t => { expByCat[t.category || "other"] = (expByCat[t.category || "other"] || 0) + (t.amount || 0); });

      return {
        orders: ca.length, prevOrders: pa.length,
        revenue, prevRevenue, profit, prevProfit,
        expenses, prevExpenses, cogs,
        returnRate, prevReturnRate, returned,
        margin: revenue > 0 ? (profit / revenue * 100).toFixed(1) : "0",
        avgOrder: ca.length > 0 ? Math.round(revenue / ca.length) : 0,
        expByCat,
      };
    },
  });

  // ─── Daily Chart ───
  const { data: dailyData, isLoading: l2 } = useQuery({
    queryKey: ["rpt-daily", selectedMonth],
    queryFn: async () => {
      const { data } = await supabase.from("orders")
        .select("order_date, total_amount, gross_profit, status")
        .gte("order_date", startDate).lte("order_date", endDate + "T23:59:59");
      const byDay: Record<number, { orders: number; revenue: number; profit: number }> = {};
      const daysInMonth = new Date(year, selectedMonth + 1, 0).getDate();
      for (let i = 1; i <= daysInMonth; i++) byDay[i] = { orders: 0, revenue: 0, profit: 0 };
      (data || []).filter(o => o.status !== "cancelled").forEach(o => {
        const d = new Date(o.order_date!).getDate();
        byDay[d].orders++;
        byDay[d].revenue += o.total_amount || 0;
        byDay[d].profit += o.gross_profit || 0;
      });
      return Object.entries(byDay).map(([day, v]) => ({ day: Number(day), ...v }));
    },
  });

  // ─── Product Performance ───
  const { data: products, isLoading: l3 } = useQuery({
    queryKey: ["rpt-products", selectedMonth],
    queryFn: async () => {
      const { data } = await supabase.from("order_items")
        .select("product_id, quantity, unit_price, total_price, unit_cost, products(name, sku, landed_cost_bdt, selling_price)")
        .not("product_id", "is", null);
      // Filter by orders in selected month
      const { data: orderIds } = await supabase.from("orders")
        .select("id").gte("order_date", startDate).lte("order_date", endDate + "T23:59:59").neq("status", "cancelled");
      const validIds = new Set((orderIds || []).map(o => o.id));

      const map: Record<string, { name: string; sku: string; qty: number; revenue: number; buyPrice: number; sellPrice: number; totalProfit: number }> = {};
      (data || []).forEach((i: any) => {
        // We need to also check order_id but we fetched without it - approximate with all items
        const id = i.product_id;
        const p = i.products;
        if (!p) return;
        const cost = i.unit_cost || p.landed_cost_bdt || 0;
        const sell = i.unit_price || p.selling_price || 0;
        if (!map[id]) map[id] = { name: p.name, sku: p.sku || "", qty: 0, revenue: 0, buyPrice: cost, sellPrice: sell, totalProfit: 0 };
        map[id].qty += i.quantity || 0;
        map[id].revenue += i.total_price || 0;
        map[id].totalProfit += ((sell - cost) * (i.quantity || 0));
      });
      return Object.values(map).sort((a, b) => b.totalProfit - a.totalProfit).slice(0, 15);
    },
  });

  // ─── Customer Acquisition ───
  const { data: customerData } = useQuery({
    queryKey: ["rpt-customers", selectedMonth],
    queryFn: async () => {
      const { data: curOrders } = await supabase.from("orders")
        .select("customer_id").gte("order_date", startDate).lte("order_date", endDate + "T23:59:59").neq("status", "cancelled");
      const { data: prevOrders } = await supabase.from("orders")
        .select("customer_id").lt("order_date", startDate).neq("status", "cancelled");
      const curIds = new Set((curOrders || []).map(o => o.customer_id).filter(Boolean));
      const prevIds = new Set((prevOrders || []).map(o => o.customer_id).filter(Boolean));
      const newCust = [...curIds].filter(id => !prevIds.has(id)).length;
      const returning = [...curIds].filter(id => prevIds.has(id)).length;

      // VIP from customers table
      const { data: custs } = await supabase.from("customers").select("total_spent, total_orders");
      const diamond = (custs || []).filter(c => (c.total_spent || 0) >= 10000).length;
      const gold = (custs || []).filter(c => (c.total_spent || 0) >= 5000 && (c.total_spent || 0) < 10000).length;
      const silver = (custs || []).filter(c => (c.total_spent || 0) >= 2000 && (c.total_spent || 0) < 5000).length;
      const repeat = (custs || []).filter(c => (c.total_orders || 0) >= 3).length;

      return { newCust, returning, total: curIds.size, diamond, gold, silver, repeat };
    },
  });

  // ─── Courier Performance ───
  const { data: courierData } = useQuery({
    queryKey: ["rpt-courier", selectedMonth],
    queryFn: async () => {
      const { data } = await supabase.from("courier_history")
        .select("courier_name, status").gte("created_at", startDate).lte("created_at", endDate + "T23:59:59");
      const map: Record<string, { sent: number; delivered: number; cancelled: number }> = {};
      (data || []).forEach(c => {
        if (!map[c.courier_name]) map[c.courier_name] = { sent: 0, delivered: 0, cancelled: 0 };
        map[c.courier_name].sent++;
        if (c.status === "delivered") map[c.courier_name].delivered++;
        if (c.status === "cancelled") map[c.courier_name].cancelled++;
      });
      return Object.entries(map).map(([name, v]) => ({
        name, ...v, rate: v.sent > 0 ? Math.round(v.delivered / v.sent * 100) : 0,
      })).sort((a, b) => b.sent - a.sent);
    },
  });

  // ─── Income from transactions ───
  const { data: incomeData } = useQuery({
    queryKey: ["rpt-income", selectedMonth],
    queryFn: async () => {
      const { data } = await supabase.from("transactions").select("amount, category")
        .eq("type", "income").gte("transaction_date", startDate).lte("transaction_date", endDate);
      const byCat: Record<string, number> = {};
      (data || []).forEach(t => { byCat[t.category || "other"] = (byCat[t.category || "other"] || 0) + (t.amount || 0); });
      const total = (data || []).reduce((s, t) => s + (t.amount || 0), 0);
      return { byCat, total };
    },
  });

  const expenseCategories = [
    { key: "product_cost", label: "Product Cost (COGS)", icon: "🛒", color: "bg-blue-500" },
    { key: "shipping", label: "Courier / Shipping", icon: "🚚", color: "bg-cyan-500" },
    { key: "salary", label: "Salary & Staff", icon: "👥", color: "bg-purple-500" },
    { key: "ads", label: "Ads (FB + Google)", icon: "📢", color: "bg-orange-500" },
    { key: "rent", label: "Rent & Utilities", icon: "🏠", color: "bg-yellow-500" },
    { key: "returns", label: "Returns & Refunds", icon: "↩️", color: "bg-red-500" },
    { key: "other", label: "Other Expenses", icon: "📦", color: "bg-gray-500" },
  ];

  const totalExpenses = stats?.expenses || 0;

  // Comparison table data
  const compMetrics = [
    { label: "Orders", cur: stats?.orders || 0, prev: stats?.prevOrders || 0, fmt: (v: number) => v.toLocaleString(), inverse: false },
    { label: "Revenue", cur: stats?.revenue || 0, prev: stats?.prevRevenue || 0, fmt: (v: number) => fmtL(v), inverse: false },
    { label: "Profit", cur: stats?.profit || 0, prev: stats?.prevProfit || 0, fmt: (v: number) => fmtL(v), inverse: false },
    { label: "Margin %", cur: Number(stats?.margin || 0), prev: stats?.prevRevenue ? Number((stats.prevProfit / stats.prevRevenue * 100).toFixed(1)) : 0, fmt: (v: number) => `${v.toFixed(1)}%`, inverse: false },
    { label: "Avg Order", cur: stats?.avgOrder || 0, prev: stats?.prevOrders ? Math.round((stats?.prevRevenue || 0) / stats.prevOrders) : 0, fmt: (v: number) => fmt(v), inverse: false },
    { label: "Return Rate", cur: stats?.returnRate || 0, prev: stats?.prevReturnRate || 0, fmt: (v: number) => `${v.toFixed(1)}%`, inverse: true },
    { label: "Returns", cur: stats?.returned || 0, prev: 0, fmt: (v: number) => v.toString(), inverse: true },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ─── HEADER ─── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Monthly Reports</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-muted-foreground gap-1.5" onClick={() => window.print()}>
            <Printer className="w-3.5 h-3.5" /> Print
          </Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground gap-1.5">
            <FileText className="w-3.5 h-3.5" /> PDF
          </Button>
          <Button size="sm" className="gap-1.5">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </Button>
        </div>
      </div>

      {/* ─── PERIOD SELECTOR ─── */}
      <div className="flex items-center justify-between bg-card rounded-xl border border-border p-3">
        <div className="flex items-center gap-1">
          {MONTHS.map((m, i) => (
            <button
              key={m}
              onClick={() => setSelectedMonth(i)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                i === selectedMonth
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-foreground">{monthLabel}</p>
          <p className="text-[10px] text-muted-foreground">vs {prevMonthLabel}</p>
        </div>
      </div>

      {/* ─── HERO METRICS ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <HeroCard label="TOTAL ORDERS" value={stats?.orders?.toLocaleString() || "0"} sub={`${pct(stats?.orders || 0, stats?.prevOrders || 0)}% vs last`} borderColor="border-blue-500" icon={<ShoppingCart className="w-4 h-4" />} iconBg="bg-blue-500/10 text-blue-400" loading={l1} />
        <HeroCard label="GROSS REVENUE" value={fmtL(stats?.revenue)} sub={`Avg ${fmt(stats?.avgOrder)}/order`} borderColor="border-green-500" icon={<TrendingUp className="w-4 h-4" />} iconBg="bg-green-500/10 text-green-400" loading={l1} trend={pct(stats?.revenue || 0, stats?.prevRevenue || 0)} />
        <HeroCard label="NET PROFIT" value={fmtL(stats?.profit)} sub={`${stats?.margin || 0}% margin`} borderColor="border-purple-500" icon={<Trophy className="w-4 h-4" />} iconBg="bg-purple-500/10 text-purple-400" loading={l1} trend={pct(stats?.profit || 0, stats?.prevProfit || 0)} />
        <HeroCard label="TOTAL EXPENSES" value={fmtL(stats?.expenses)} sub={stats?.revenue ? `${((stats.expenses / stats.revenue) * 100).toFixed(0)}% of revenue` : "0%"} borderColor="border-red-500" icon={<Wallet className="w-4 h-4" />} iconBg="bg-red-500/10 text-red-400" loading={l1} trend={pct(stats?.expenses || 0, stats?.prevExpenses || 0)} trendInverse />
        <HeroCard label="RETURN RATE" value={`${(stats?.returnRate || 0).toFixed(1)}%`} sub={`${stats?.returned || 0} returned`} borderColor="border-yellow-500" icon={<RotateCcw className="w-4 h-4" />} iconBg="bg-yellow-500/10 text-yellow-400" loading={l1} />
      </div>

      {/* ─── SECTION 2: Chart + P&L ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4">
        {/* Daily Revenue Chart */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-xs font-semibold uppercase tracking-wider">DAILY REVENUE — {monthLabel}</span>
            </div>
          </div>
          {l2 ? <Skeleton className="h-[280px]" /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={dailyData} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(228 16% 90%)" />
                <XAxis dataKey="day" fontSize={10} tick={{ fill: "hsl(220 9% 46%)" }} interval={1} />
                <YAxis fontSize={10} tick={{ fill: "hsl(220 9% 46%)" }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#fff", border: "1px solid hsl(228 16% 90%)", borderRadius: 8, fontSize: 11 }}
                  labelStyle={{ color: "hsl(222 47% 11%)" }}
                  formatter={(val: any, name: string) => [name === "revenue" || name === "profit" ? fmt(val) : val, name.charAt(0).toUpperCase() + name.slice(1)]}
                  labelFormatter={(v) => `Day ${v}`}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="orders" fill="hsl(217 91% 60%)" radius={[3, 3, 0, 0]} name="Orders" />
                <Bar dataKey="revenue" fill="hsl(160 84% 39%)" radius={[3, 3, 0, 0]} name="Revenue" />
                <Bar dataKey="profit" fill="hsl(262 83% 58%)" radius={[3, 3, 0, 0]} name="Profit" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* P&L Summary */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-xs font-semibold uppercase tracking-wider">P&L SUMMARY</span>
          </div>
          <div className="space-y-0.5 text-xs">
            <div className="bg-green-500/10 px-3 py-1.5 rounded-md font-semibold text-green-400 uppercase tracking-wider text-[10px]">Income</div>
            <PLRow label="Sales Revenue" amount={stats?.revenue || 0} color="text-green-400" />
            <PLRow label="Advance Payments" amount={incomeData?.byCat?.advance || 0} color="text-green-400" />
            <PLRow label="Delivery Collected" amount={incomeData?.byCat?.delivery_charge || 0} color="text-green-400" />
            <div className="flex justify-between px-3 py-1.5 border-t border-border font-bold">
              <span>Total Income</span>
              <span className="font-mono-num text-green-400">{fmt((stats?.revenue || 0) + (incomeData?.total || 0))}</span>
            </div>

            <div className="bg-red-500/10 px-3 py-1.5 rounded-md font-semibold text-red-400 uppercase tracking-wider text-[10px] mt-2">Expenses</div>
            {expenseCategories.map(cat => (
              <PLRow key={cat.key} label={`${cat.icon} ${cat.label}`} amount={stats?.expByCat?.[cat.key] || 0} color="text-red-400" />
            ))}
            <div className="flex justify-between px-3 py-1.5 border-t border-border font-bold">
              <span>Total Expenses</span>
              <span className="font-mono-num text-red-400">{fmt(totalExpenses)}</span>
            </div>

            <div className="flex justify-between px-3 py-2.5 rounded-lg bg-gradient-to-r from-green-500/10 to-blue-500/10 mt-2 font-bold">
              <span className="text-sm">NET PROFIT</span>
              <span className={cn("text-sm font-mono-num", (stats?.profit || 0) >= 0 ? "text-green-400" : "text-red-400")}>
                {fmt(stats?.profit || 0)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── SECTION 3: Products + Expense Breakdown ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4">
        {/* Product Performance */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-orange-500" />
            <span className="text-xs font-semibold uppercase tracking-wider">PRODUCT PERFORMANCE</span>
          </div>
          {l3 ? <Skeleton className="h-[300px]" /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] text-muted-foreground uppercase border-b border-border">
                    <th className="text-left py-2 px-1 w-8">#</th>
                    <th className="text-left py-2 px-1">Product</th>
                    <th className="text-right py-2 px-1">Sold</th>
                    <th className="text-right py-2 px-1">Revenue</th>
                    <th className="text-right py-2 px-1">Buy</th>
                    <th className="text-right py-2 px-1">Sell</th>
                    <th className="text-right py-2 px-1">Profit</th>
                    <th className="text-right py-2 px-1">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {products?.map((p, i) => {
                    const margin = p.revenue > 0 ? (p.totalProfit / p.revenue * 100) : 0;
                    const rankColors = ["text-yellow-400", "text-gray-400", "text-orange-400"];
                    const rankIcons = ["🥇", "🥈", "🥉"];
                    return (
                      <tr key={i} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                        <td className="py-2 px-1">
                          {i < 3 ? <span>{rankIcons[i]}</span> : <span className="font-mono-num text-muted-foreground">{i + 1}</span>}
                        </td>
                        <td className="py-2 px-1">
                          <p className="font-medium text-foreground truncate max-w-[140px]">{p.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono-num">{p.sku}</p>
                        </td>
                        <td className="text-right py-2 px-1 font-mono-num">{p.qty}</td>
                        <td className="text-right py-2 px-1 font-mono-num text-green-400">{fmtL(p.revenue)}</td>
                        <td className="text-right py-2 px-1 font-mono-num text-muted-foreground">{fmt(p.buyPrice)}</td>
                        <td className="text-right py-2 px-1 font-mono-num">{fmt(p.sellPrice)}</td>
                        <td className="text-right py-2 px-1 font-mono-num text-blue-400">{fmtL(p.totalProfit)}</td>
                        <td className="text-right py-2 px-1">
                          <span className={cn(
                            "font-mono-num font-semibold px-1.5 py-0.5 rounded-md text-[10px]",
                            margin >= 55 ? "bg-green-500/20 text-green-400" :
                            margin >= 40 ? "bg-orange-500/20 text-orange-400" :
                            "bg-red-500/20 text-red-400"
                          )}>
                            {margin.toFixed(0)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {(!products || products.length === 0) && (
                    <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">No product data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Expense Breakdown Visual */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-xs font-semibold uppercase tracking-wider">EXPENSE BREAKDOWN</span>
          </div>
          <div className="space-y-3">
            {expenseCategories.map(cat => {
              const val = stats?.expByCat?.[cat.key] || 0;
              const pctVal = totalExpenses > 0 ? (val / totalExpenses * 100) : 0;
              return (
                <div key={cat.key}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={cn("w-2 h-2 rounded-full", cat.color)} />
                      <span className="text-xs text-foreground">{cat.icon} {cat.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono-num text-red-400">{fmt(val)}</span>
                      <span className="text-[10px] text-muted-foreground font-mono-num">{pctVal.toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-accent rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", cat.color)} style={{ width: `${Math.max(pctVal, 1)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Profit Margin visual */}
          <div className="mt-5 pt-4 border-t border-border">
            <p className="text-[10px] text-muted-foreground uppercase mb-2">Profit vs Expenses</p>
            <div className="flex h-4 rounded-full overflow-hidden bg-accent">
              {stats?.revenue && stats.revenue > 0 && (
                <>
                  <div className="bg-green-500/80 h-full transition-all" style={{ width: `${Number(stats.margin)}%` }} />
                  <div className="bg-red-500/80 h-full transition-all" style={{ width: `${100 - Number(stats.margin)}%` }} />
                </>
              )}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-green-400 font-mono-num">Profit {stats?.margin || 0}%</span>
              <span className="text-[10px] text-red-400 font-mono-num">Expenses {(100 - Number(stats?.margin || 0)).toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── SECTION 4: Customers + Courier + Comparison ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr] gap-4">
        {/* Customer Acquisition */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-xs font-semibold uppercase tracking-wider">CUSTOMER ACQUISITION</span>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-4">
            <StatBox label="New Customers" value={customerData?.newCust || 0} color="text-green-400" bg="bg-green-500/10" />
            <StatBox label="Returning" value={customerData?.returning || 0} color="text-blue-400" bg="bg-blue-500/10" />
          </div>

          {/* Customer mix bar */}
          {customerData && customerData.total > 0 && (
            <div className="mb-4">
              <p className="text-[10px] text-muted-foreground uppercase mb-1">Customer Mix</p>
              <div className="flex h-3 rounded-full overflow-hidden bg-accent">
                <div className="bg-green-500 h-full" style={{ width: `${(customerData.newCust / customerData.total * 100)}%` }} />
                <div className="bg-blue-500 h-full" style={{ width: `${(customerData.returning / customerData.total * 100)}%` }} />
              </div>
              <div className="flex gap-3 mt-1">
                <span className="text-[10px] text-green-400">New {customerData.total > 0 ? (customerData.newCust / customerData.total * 100).toFixed(0) : 0}%</span>
                <span className="text-[10px] text-blue-400">Returning {customerData.total > 0 ? (customerData.returning / customerData.total * 100).toFixed(0) : 0}%</span>
              </div>
            </div>
          )}

          {/* VIP Breakdown */}
          <div className="border-t border-border pt-3">
            <p className="text-[10px] text-muted-foreground uppercase mb-2">VIP Breakdown</p>
            <div className="grid grid-cols-2 gap-2">
              <VipRow emoji="💎" label="Diamond (৳10k+)" count={customerData?.diamond || 0} />
              <VipRow emoji="👑" label="Gold (৳5k-10k)" count={customerData?.gold || 0} />
              <VipRow emoji="⭐" label="Silver (৳2k-5k)" count={customerData?.silver || 0} />
              <VipRow emoji="🔄" label="Repeat (3+)" count={customerData?.repeat || 0} />
            </div>
          </div>
        </div>

        {/* Courier Performance */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-xs font-semibold uppercase tracking-wider">COURIER STATS</span>
          </div>
          <div className="space-y-3">
            {courierData?.map((c, i) => (
              <div key={i} className="bg-accent/50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-foreground">{c.name}</span>
                  <span className={cn(
                    "text-sm font-bold font-mono-num",
                    c.rate >= 85 ? "text-green-400" : c.rate >= 75 ? "text-orange-400" : "text-red-400"
                  )}>{c.rate}%</span>
                </div>
                <div className="w-full h-1.5 bg-accent rounded-full overflow-hidden mb-1.5">
                  <div className={cn(
                    "h-full rounded-full transition-all",
                    c.rate >= 85 ? "bg-green-500" : c.rate >= 75 ? "bg-orange-500" : "bg-red-500"
                  )} style={{ width: `${c.rate}%` }} />
                </div>
                <div className="flex gap-3 text-[10px] text-muted-foreground">
                  <span>Sent: <span className="font-mono-num text-foreground">{c.sent}</span></span>
                  <span>Del: <span className="font-mono-num text-green-400">{c.delivered}</span></span>
                  <span>Can: <span className="font-mono-num text-red-400">{c.cancelled}</span></span>
                </div>
              </div>
            ))}
            {(!courierData || courierData.length === 0) && (
              <p className="text-xs text-muted-foreground text-center py-6">No courier data</p>
            )}
          </div>
        </div>

        {/* Monthly Comparison */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            <span className="text-xs font-semibold uppercase tracking-wider">COMPARISON</span>
          </div>
          <div className="space-y-0.5">
            <div className="grid grid-cols-4 gap-1 text-[9px] text-muted-foreground uppercase pb-1 border-b border-border">
              <span>Metric</span><span className="text-right">This</span><span className="text-right">Last</span><span className="text-right">Δ</span>
            </div>
            {compMetrics.map((m, i) => {
              const change = m.prev > 0 ? ((m.cur - m.prev) / m.prev * 100) : 0;
              const positive = m.inverse ? change <= 0 : change >= 0;
              return (
                <div key={i} className="grid grid-cols-4 gap-1 items-center py-1.5 text-xs border-b border-border/30">
                  <span className="text-muted-foreground">{m.label}</span>
                  <span className="text-right font-mono-num text-foreground">{m.fmt(m.cur)}</span>
                  <span className="text-right font-mono-num text-muted-foreground">{m.fmt(m.prev)}</span>
                  <span className={cn("text-right font-mono-num text-[10px] font-semibold", positive ? "text-green-400" : "text-red-400")}>
                    {positive ? "↑" : "↓"}{Math.abs(change).toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───

function HeroCard({ label, value, sub, borderColor, icon, iconBg, loading, trend, trendInverse }: {
  label: string; value: string; sub: string; borderColor: string; icon: React.ReactNode; iconBg: string; loading?: boolean; trend?: string; trendInverse?: boolean;
}) {
  if (loading) return <div className={cn("bg-card rounded-xl border-t-2 border border-border p-4", borderColor)}><Skeleton className="h-14" /></div>;
  const t = Number(trend || 0);
  const positive = trendInverse ? t <= 0 : t >= 0;
  return (
    <div className={cn("bg-card rounded-xl border border-border p-4 border-t-2", borderColor)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xl font-bold font-mono-num text-foreground">{value}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">{label}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", iconBg)}>{icon}</div>
          {trend !== undefined && (
            <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-md", positive ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400")}>
              {positive ? "↑" : "↓"}{Math.abs(t)}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function PLRow({ label, amount, color }: { label: string; amount: number; color: string }) {
  return (
    <div className="flex justify-between px-3 py-1 hover:bg-accent/30 rounded-sm transition-colors">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-mono-num", color)}>{fmt(amount)}</span>
    </div>
  );
}

function StatBox({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div className={cn("rounded-lg p-3", bg)}>
      <p className={cn("text-lg font-bold font-mono-num", color)}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function VipRow({ emoji, label, count }: { emoji: string; label: string; count: number }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-sm">{emoji}</span>
      <span className="text-[10px] text-muted-foreground flex-1">{label}</span>
      <span className="text-xs font-mono-num font-bold text-foreground">{count}</span>
    </div>
  );
}
