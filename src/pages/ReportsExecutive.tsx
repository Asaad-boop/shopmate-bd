import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBDT } from "@/lib/format";
import { useNavigate, Link } from "react-router-dom";
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { cn } from "@/lib/utils";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ArrowLeft, BarChart3, CalendarIcon, Download, Printer,
  DollarSign, TrendingUp, TrendingDown, Package, Truck,
  CreditCard, Wallet, Banknote, Building2, Smartphone,
  ShoppingCart, RotateCcw, XCircle, RefreshCw, ExternalLink,
  PieChart, Users,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  PieChart as RPieChart, Pie, Cell,
} from "recharts";

/* ─── hook ─── */
function useExecutiveReport(dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: ["executive-report", dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("executive_report", {
        p_date_from: dateFrom,
        p_date_to: dateTo,
      });
      if (error) throw error;
      return data as any;
    },
    staleTime: 60_000,
  });
}

/* ─── presets ─── */
const today = new Date();
const PRESETS = [
  { label: "Last 7 days", from: subDays(today, 6), to: today },
  { label: "Last 30 days", from: subDays(today, 29), to: today },
  { label: "This month", from: startOfMonth(today), to: today },
  { label: "Last month", from: startOfMonth(subMonths(today, 1)), to: endOfMonth(subMonths(today, 1)) },
  { label: "Last 90 days", from: subDays(today, 89), to: today },
];

const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
  "hsl(var(--info))",
  "hsl(var(--chart-5))",
  "hsl(var(--muted-foreground))",
];

/* ─── helpers ─── */
function pctChange(current: number, previous: number): { value: string; positive: boolean } | null {
  if (!previous) return null;
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  return { value: `${Math.abs(pct).toFixed(1)}%`, positive: pct >= 0 };
}

function exportCSV(data: any, dateFrom: string, dateTo: string) {
  if (!data) return;
  const rows: string[][] = [];
  rows.push(["Executive Report", `${dateFrom} to ${dateTo}`]);
  rows.push([]);
  rows.push(["KPI", "Value"]);
  rows.push(["Revenue", String(data.revenue || 0)]);
  rows.push(["COGS", String(data.cogs || 0)]);
  rows.push(["Gross Profit", String(data.gross_profit || 0)]);
  rows.push(["Courier Cost", String(data.courier_cost || 0)]);
  rows.push(["Total Expenses", String(data.total_expenses || 0)]);
  rows.push(["Net Profit", String(data.net_profit || 0)]);
  rows.push(["Delivered Orders", String(data.delivered_orders || 0)]);
  rows.push(["Returned Orders", String(data.returned_orders || 0)]);
  rows.push(["Return Rate %", String(data.return_rate || 0)]);
  rows.push(["Avg Order Value", String(data.avg_order_value || 0)]);
  rows.push([]);
  rows.push(["Date", "Revenue", "Profit", "Delivered", "Returns"]);
  (data.daily_trend || []).forEach((d: any) => {
    rows.push([d.d, String(d.revenue || 0), String(d.profit || 0), String(d.delivered || 0), String(d.returns || 0)]);
  });
  const csv = rows.map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `executive-report-${dateFrom}-${dateTo}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ─── page ─── */
export default function ReportsExecutive() {
  const nav = useNavigate();
  const [dateFrom, setDateFrom] = useState<Date>(startOfMonth(today));
  const [dateTo, setDateTo] = useState<Date>(today);
  const [preset, setPreset] = useState("This month");
  const [showCompare, setShowCompare] = useState(false);

  const fromStr = format(dateFrom, "yyyy-MM-dd");
  const toStr = format(dateTo, "yyyy-MM-dd");
  const { data, isLoading, refetch } = useExecutiveReport(fromStr, toStr);

  const revenue = data?.revenue || 0;
  const cogs = data?.cogs || 0;
  const courierCost = data?.courier_cost || 0;
  const totalExpenses = data?.total_expenses || 0;
  const grossProfit = data?.gross_profit || 0;
  const netProfit = data?.net_profit || 0;
  const grossMargin = revenue > 0 ? ((grossProfit / revenue) * 100).toFixed(1) : "0.0";
  const netMargin = revenue > 0 ? ((netProfit / revenue) * 100).toFixed(1) : "0.0";

  const cp = data?.cash_position || {};
  const totalCash = (cp.cash || 0) + (cp.bank || 0) + (cp.bkash || 0) + (cp.nagad || 0);
  const wc = data?.working_capital || {};

  const dailyTrend: any[] = data?.daily_trend || [];
  const trendFormatted = useMemo(() =>
    dailyTrend.map((d: any) => ({
      ...d,
      date: format(new Date(d.d), "dd MMM"),
      returnRate: d.delivered > 0 ? ((d.returns / (d.delivered + d.returns)) * 100) : 0,
    })),
    [dailyTrend]
  );

  const expenseBreakdown: any[] = data?.expense_breakdown || [];

  const handlePreset = (label: string) => {
    const p = PRESETS.find((x) => x.label === label);
    if (p) { setDateFrom(p.from); setDateTo(p.to); setPreset(label); }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4 max-w-[1400px] mx-auto">
        <Skeleton className="h-14 w-full" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[...Array(10)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background print:bg-white">
      {/* Header */}
      <div className="border-b border-border bg-card sticky top-0 z-20 print:hidden">
        <div className="flex items-center justify-between px-6 h-14 max-w-[1400px] mx-auto">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => nav("/reports")} className="h-8 w-8">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <BarChart3 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">Executive Report</h1>
                <p className="text-[11px] text-muted-foreground -mt-0.5">
                  {format(dateFrom, "dd MMM yyyy")} — {format(dateTo, "dd MMM yyyy")}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1 text-xs">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportCSV(data, fromStr, toStr)} className="gap-1 text-xs">
              <Download className="w-3.5 h-3.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1 text-xs">
              <Printer className="w-3.5 h-3.5" /> PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-[1400px] mx-auto space-y-6">
        {/* Print header */}
        <div className="hidden print:block mb-4">
          <h1 className="text-2xl font-bold text-foreground">Executive Report</h1>
          <p className="text-sm text-muted-foreground">
            {format(dateFrom, "dd MMM yyyy")} — {format(dateTo, "dd MMM yyyy")}
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-end print:hidden">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Preset</p>
            <Select value={preset} onValueChange={handlePreset}>
              <SelectTrigger className="h-9 w-40 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRESETS.map((p) => <SelectItem key={p.label} value={p.label}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">From</p>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-9 w-36 text-xs justify-start">
                  <CalendarIcon className="w-3.5 h-3.5 mr-1" />
                  {format(dateFrom, "dd MMM yy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={(d) => d && setDateFrom(d)} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">To</p>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-9 w-36 text-xs justify-start">
                  <CalendarIcon className="w-3.5 h-3.5 mr-1" />
                  {format(dateTo, "dd MMM yy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={(d) => d && setDateTo(d)} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={showCompare} onCheckedChange={setShowCompare} />
            <span className="text-xs text-muted-foreground">Compare previous</span>
          </div>
        </div>

        {/* ── P&L KPIs ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Profit & Loss</h2>
            <Link to="/reports/pnl" className="text-xs text-primary hover:underline flex items-center gap-1">
              View P&L <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <KpiCard label="Revenue" value={revenue} icon={DollarSign} accent="bg-success/10 text-success"
              sub={`${grossMargin}% gross margin`}
              compare={showCompare ? pctChange(revenue, data?.prev_revenue) : undefined} />
            <KpiCard label="Gross Profit" value={grossProfit} icon={TrendingUp} accent="bg-info/10 text-info" />
            <KpiCard label="Net Profit" value={netProfit} icon={netProfit >= 0 ? TrendingUp : TrendingDown}
              accent={netProfit >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}
              sub={`${netMargin}% net margin`} highlight
              compare={showCompare ? pctChange(netProfit, data?.prev_net_profit) : undefined} />
            <KpiCard label="Return Rate" value={data?.return_rate || 0} icon={RotateCcw}
              accent="bg-warning/10 text-warning" raw suffix="%"
              compare={showCompare ? pctChange(data?.return_rate || 0, data?.prev_return_rate || 0) : undefined} />
            <KpiCard label="Avg Order Value" value={data?.avg_order_value || 0} icon={ShoppingCart}
              accent="bg-primary/10 text-primary" />
          </div>
        </section>

        {/* ── Order Stats ── */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Orders</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Total Orders" value={data?.total_orders || 0} icon={ShoppingCart} accent="bg-primary/10 text-primary" raw />
            <KpiCard label="Delivered" value={data?.delivered_orders || 0} icon={TrendingUp} accent="bg-success/10 text-success" raw
              compare={showCompare ? pctChange(data?.delivered_orders || 0, data?.prev_delivered || 0) : undefined} />
            <KpiCard label="Returned" value={data?.returned_orders || 0} icon={RotateCcw} accent="bg-warning/10 text-warning" raw />
            <KpiCard label="Cancelled" value={data?.cancelled_orders || 0} icon={XCircle} accent="bg-destructive/10 text-destructive" raw />
          </div>
        </section>

        {/* ── Cash & Working Capital ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Cash Position</h2>
              <Link to="/finance/accounts" className="text-xs text-primary hover:underline flex items-center gap-1">
                Accounts <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <KpiCard label="Cash" value={cp.cash || 0} icon={Banknote} accent="bg-success/10 text-success" />
              <KpiCard label="Bank" value={cp.bank || 0} icon={Building2} accent="bg-info/10 text-info" />
              <KpiCard label="bKash" value={cp.bkash || 0} icon={Smartphone} accent="bg-primary/10 text-primary" />
              <KpiCard label="Nagad" value={cp.nagad || 0} icon={Wallet} accent="bg-warning/10 text-warning" />
            </div>
            <div className="mt-3 bg-muted/30 rounded-xl p-4 text-center">
              <p className="text-xs text-muted-foreground">Total Liquid Cash</p>
              <p className="text-2xl font-bold text-foreground">{formatBDT(totalCash)}</p>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Working Capital</h2>
            <div className="grid grid-cols-2 gap-3">
              <Link to="/reports" className="block">
                <KpiCard label="Inventory Value" value={wc.inventory_value || 0} icon={Package} accent="bg-primary/10 text-primary" link />
              </Link>
              <Link to="/finance/settlements" className="block">
                <KpiCard label="Courier Receivable" value={wc.courier_receivable || 0} icon={Truck} accent="bg-info/10 text-info" link />
              </Link>
              <Link to="/finance/payables" className="block">
                <KpiCard label="Supplier Payable" value={wc.supplier_payable || 0} icon={Users} accent="bg-destructive/10 text-destructive" link />
              </Link>
              <KpiCard label="Customer Advances" value={wc.customer_advances || 0} icon={CreditCard} accent="bg-warning/10 text-warning" />
            </div>
          </section>
        </div>

        {/* ── Charts ── */}
        <section className="space-y-6 print:break-before-page">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Trends</h2>

          {/* Revenue + Profit Line Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Daily Revenue & Net Profit</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={trendFormatted}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="profGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatBDT(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="revenue" name="Revenue" stroke="hsl(var(--primary))" fill="url(#revGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="profit" name="Net Profit" stroke="hsl(var(--success))" fill="url(#profGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Delivered vs Returned Bar Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Delivered vs Returned</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={trendFormatted} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="delivered" name="Delivered" fill="hsl(var(--success))" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="returns" name="Returned" fill="hsl(var(--destructive))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Expense Breakdown Pie */}
          {expenseBreakdown.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Expense Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  <ResponsiveContainer width="100%" height={260}>
                    <RPieChart>
                      <Pie
                        data={expenseBreakdown}
                        dataKey="amount"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        innerRadius={50}
                        paddingAngle={2}
                      >
                        {expenseBreakdown.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatBDT(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    </RPieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2">
                    {expenseBreakdown.slice(0, 8).map((e: any, i: number) => (
                      <div key={e.category} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="text-muted-foreground truncate max-w-[160px]">{e.category}</span>
                        </div>
                        <span className="font-medium text-foreground">{formatBDT(e.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}

/* ─── KPI Card ─── */
function KpiCard({
  label, value, icon: Icon, accent, sub, raw, highlight, compare, suffix, link,
}: {
  label: string; value: number; icon: any; accent: string;
  sub?: string; raw?: boolean; highlight?: boolean;
  compare?: { value: string; positive: boolean } | null;
  suffix?: string; link?: boolean;
}) {
  return (
    <Card className={cn(
      "transition-shadow hover:shadow-md",
      highlight && "ring-1 ring-primary/30",
      link && "cursor-pointer hover:ring-1 hover:ring-primary/20"
    )}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
          <div className={cn("p-1.5 rounded-lg", accent)}>
            <Icon className="w-3.5 h-3.5" />
          </div>
        </div>
        <p className={cn("text-lg font-bold text-foreground", highlight && (value >= 0 ? "text-success" : "text-destructive"))}>
          {raw ? `${value.toLocaleString()}${suffix || ""}` : formatBDT(value)}
        </p>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
        {compare && (
          <p className={cn("text-[10px] font-medium mt-0.5", compare.positive ? "text-success" : "text-destructive")}>
            {compare.positive ? "↑" : "↓"} {compare.value} vs prev
          </p>
        )}
        {link && <ExternalLink className="w-3 h-3 text-muted-foreground mt-1" />}
      </CardContent>
    </Card>
  );
}
