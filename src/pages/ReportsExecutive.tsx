import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBDT } from "@/lib/format";
import { useNavigate } from "react-router-dom";
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { cn } from "@/lib/utils";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ArrowLeft, BarChart3, CalendarIcon, Download, Printer,
  DollarSign, TrendingUp, TrendingDown, Package, Truck,
  Users, CreditCard, Wallet, Banknote, Building2, Smartphone,
  ShoppingCart, RotateCcw, XCircle, RefreshCw,
} from "lucide-react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
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

/* ─── page ─── */
export default function ReportsExecutive() {
  const nav = useNavigate();
  const [dateFrom, setDateFrom] = useState<Date>(subDays(today, 29));
  const [dateTo, setDateTo] = useState<Date>(today);
  const [preset, setPreset] = useState("Last 30 days");

  const fromStr = format(dateFrom, "yyyy-MM-dd");
  const toStr = format(dateTo, "yyyy-MM-dd");
  const { data, isLoading, refetch } = useExecutiveReport(fromStr, toStr);

  const revenue = data?.revenue || 0;
  const cogs = data?.cogs || 0;
  const courierCost = data?.courier_cost || 0;
  const totalExpenses = data?.total_expenses || 0;
  const grossProfit = revenue - cogs;
  const netProfit = revenue - cogs - courierCost - totalExpenses;
  const grossMargin = revenue > 0 ? ((grossProfit / revenue) * 100).toFixed(1) : "0";
  const netMargin = revenue > 0 ? ((netProfit / revenue) * 100).toFixed(1) : "0";

  const cp = data?.cash_position || {};
  const totalCash = (cp.cash || 0) + (cp.bank || 0) + (cp.bkash || 0) + (cp.nagad || 0);

  const dailyTrend: any[] = data?.daily_trend || [];

  // Return rate computation
  const trendWithRate = useMemo(() =>
    dailyTrend.map((d: any) => ({
      ...d,
      date: format(new Date(d.d), "dd MMM"),
      returnRate: d.delivered > 0 ? ((d.returns / (d.delivered + d.returns)) * 100) : 0,
    })),
    [dailyTrend]
  );

  const handlePreset = (label: string) => {
    const p = PRESETS.find((x) => x.label === label);
    if (p) { setDateFrom(p.from); setDateTo(p.to); setPreset(label); }
  };

  const exportPDF = useCallback(() => {
    window.print();
  }, []);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4 max-w-[1400px] mx-auto">
        <Skeleton className="h-14 w-full" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
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
                <h1 className="text-lg font-bold text-foreground">Executive Dashboard</h1>
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
            <Button variant="outline" size="sm" onClick={exportPDF} className="gap-1 text-xs">
              <Printer className="w-3.5 h-3.5" /> Print / PDF
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
        <div className="flex flex-wrap gap-3 items-end print:hidden">
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
        </div>

        {/* ── P&L KPIs ── */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Profit & Loss</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <KpiCard label="Revenue" value={revenue} icon={DollarSign} accent="bg-success/10 text-success" />
            <KpiCard label="COGS" value={cogs} icon={Package} accent="bg-warning/10 text-warning" />
            <KpiCard label="Gross Profit" value={grossProfit} icon={TrendingUp} accent="bg-info/10 text-info" sub={`${grossMargin}% margin`} />
            <KpiCard label="Courier Cost" value={courierCost} icon={Truck} accent="bg-muted text-muted-foreground" />
            <KpiCard label="Expenses" value={totalExpenses} icon={CreditCard} accent="bg-destructive/10 text-destructive" />
            <KpiCard label="Net Profit" value={netProfit} icon={netProfit >= 0 ? TrendingUp : TrendingDown}
              accent={netProfit >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}
              sub={`${netMargin}% margin`} highlight
            />
          </div>
        </section>

        {/* ── Order Stats ── */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Orders</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Total Orders" value={data?.total_orders || 0} icon={ShoppingCart} accent="bg-primary/10 text-primary" raw />
            <KpiCard label="Delivered" value={data?.delivered_orders || 0} icon={TrendingUp} accent="bg-success/10 text-success" raw />
            <KpiCard label="Returned" value={data?.returned_orders || 0} icon={RotateCcw} accent="bg-warning/10 text-warning" raw />
            <KpiCard label="Cancelled" value={data?.cancelled_orders || 0} icon={XCircle} accent="bg-destructive/10 text-destructive" raw />
          </div>
        </section>

        {/* ── Cash & Working Capital ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Cash Position</h2>
            <div className="grid grid-cols-2 gap-3">
              <KpiCard label="Cash" value={cp.cash || 0} icon={Banknote} accent="bg-success/10 text-success" />
              <KpiCard label="Bank" value={cp.bank || 0} icon={Building2} accent="bg-info/10 text-info" />
              <KpiCard label="bKash" value={cp.bkash || 0} icon={Smartphone} accent="bg-[hsl(330,70%,92%)] text-[hsl(330,70%,40%)]" />
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
              <KpiCard label="Inventory Value" value={data?.inventory_value || 0} icon={Package} accent="bg-primary/10 text-primary" />
              <KpiCard label="Courier Receivable" value={data?.courier_receivable || 0} icon={Truck} accent="bg-info/10 text-info" />
              <KpiCard label="Supplier Payable" value={data?.supplier_payable || 0} icon={Users} accent="bg-destructive/10 text-destructive" />
              <KpiCard label="Customer Advances" value={data?.customer_advances || 0} icon={CreditCard} accent="bg-warning/10 text-warning" />
            </div>
          </section>
        </div>

        {/* ── Charts ── */}
        <section className="space-y-6 print:break-before-page">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Trends</h2>

          {/* Revenue Trend */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Revenue Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={trendWithRate}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatBDT(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="revenue" name="Revenue" stroke="hsl(var(--primary))" fill="url(#revGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Net Profit Trend */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Net Profit Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={trendWithRate} barSize={trendWithRate.length > 60 ? 4 : 12}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatBDT(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="profit" name="Net Profit" fill="hsl(var(--success))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Return Rate Trend */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Return Rate Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trendWithRate}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v.toFixed(0)}%`} domain={[0, "auto"]} />
                  <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="returnRate" name="Return Rate" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

/* ─── KPI Card ─── */
function KpiCard({
  label, value, icon: Icon, accent, sub, raw, highlight,
}: {
  label: string; value: number; icon: any; accent: string;
  sub?: string; raw?: boolean; highlight?: boolean;
}) {
  return (
    <Card className={cn("transition-shadow hover:shadow-md", highlight && "ring-1 ring-primary/30")}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
          <div className={cn("p-1.5 rounded-lg", accent)}>
            <Icon className="w-3.5 h-3.5" />
          </div>
        </div>
        <p className={cn("text-lg font-bold text-foreground", highlight && (value >= 0 ? "text-success" : "text-destructive"))}>
          {raw ? value.toLocaleString() : formatBDT(value)}
        </p>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}
