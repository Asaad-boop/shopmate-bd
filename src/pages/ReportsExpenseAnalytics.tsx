import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { KpiCard } from "@/components/ui/kpi-card";
import { formatBDT2, formatDate, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, subMonths, subDays } from "date-fns";
import { Link } from "react-router-dom";
import {
  Download, AlertTriangle, ChevronRight, ExternalLink, Printer,
  DollarSign, TrendingUp, Megaphone, BarChart3, Wallet, ArrowUpDown,
  PieChart as PieChartIcon, Calendar, Zap, Package,
} from "lucide-react";
import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis,
  Tooltip as RTooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

const heading: React.CSSProperties = { fontFamily: "'Playfair Display', serif" };
const mono: React.CSSProperties = { fontFamily: "'DM Mono', monospace" };

const PRESETS: Record<string, () => [string, string]> = {
  "this-month": () => [format(startOfMonth(new Date()), "yyyy-MM-dd"), format(endOfMonth(new Date()), "yyyy-MM-dd")],
  "last-month": () => [format(startOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd"), format(endOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd")],
  "last-7": () => [format(subDays(new Date(), 6), "yyyy-MM-dd"), format(new Date(), "yyyy-MM-dd")],
  "last-30": () => [format(subDays(new Date(), 29), "yyyy-MM-dd"), format(new Date(), "yyyy-MM-dd")],
  "last-90": () => [format(subDays(new Date(), 89), "yyyy-MM-dd"), format(new Date(), "yyyy-MM-dd")],
};

const CHART_COLORS = [
  "hsl(244 100% 69%)", "hsl(160 84% 39%)", "hsl(38 92% 50%)",
  "hsl(0 84% 60%)", "hsl(200 80% 50%)", "hsl(280 70% 55%)",
  "hsl(330 70% 55%)", "hsl(170 60% 45%)", "hsl(50 80% 50%)",
  "hsl(10 70% 55%)",
];

// ─── Hooks ────────────────────────────────────────────────────
function useExpenseAnalytics(dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: ["expense-analytics-report", dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("expense_analytics_report", {
        p_date_from: dateFrom,
        p_date_to: dateTo,
      });
      if (error) throw error;
      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      return parsed as {
        summary: any;
        categories: any[];
        daily_trend: any[];
        top_expenses: any[];
        top_days: any[];
        exceptions: any[];
      };
    },
    staleTime: 60_000,
  });
}

function useExpenseDrilldown(category: string | null, dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: ["expense-drill", category, dateFrom, dateTo],
    queryFn: async () => {
      if (!category) return null;
      const { data, error } = await supabase.rpc("expense_analytics_drilldown", {
        p_category: category,
        p_date_from: dateFrom,
        p_date_to: dateTo,
      });
      if (error) throw error;
      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      return parsed as { lines: any[]; allocation: { allocated: number; unallocated: number } };
    },
    enabled: !!category,
  });
}

// ─── Helpers ──────────────────────────────────────────────────
function exportCSV(rows: any[], filename: string) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const csv = [keys.join(","), ...rows.map((r) => keys.map((k) => `"${r[k] ?? ""}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

// ─── Component ────────────────────────────────────────────────
export default function ReportsExpenseAnalytics() {
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [preset, setPreset] = useState("this-month");
  const [drillCategory, setDrillCategory] = useState<string | null>(null);

  const { data, isLoading } = useExpenseAnalytics(dateFrom, dateTo);
  const { data: drillData, isLoading: drillLoading } = useExpenseDrilldown(drillCategory, dateFrom, dateTo);

  const applyPreset = (key: string) => {
    setPreset(key);
    const [f, t] = PRESETS[key]();
    setDateFrom(f);
    setDateTo(t);
  };

  const summary = data?.summary || {};
  const categories = data?.categories || [];
  const dailyTrend = data?.daily_trend || [];
  const topExpenses = data?.top_expenses || [];
  const topDays = data?.top_days || [];
  const exceptions = data?.exceptions || [];
  const excCount = exceptions.length;

  // Sort
  type SortKey = "total_amount" | "expense_count";
  const [sortKey, setSortKey] = useState<SortKey>("total_amount");
  const [sortAsc, setSortAsc] = useState(false);
  const sortedCategories = useMemo(() => {
    const arr = [...categories];
    arr.sort((a, b) => sortAsc ? (a[sortKey] - b[sortKey]) : (b[sortKey] - a[sortKey]));
    return arr;
  }, [categories, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  // Pie data
  const pieData = useMemo(() =>
    categories.slice(0, 8).map((c: any) => ({
      name: c.category,
      value: Number(c.total_amount),
    })), [categories]);

  // Revenue comparison chart
  const revenueCompare = useMemo(() =>
    dailyTrend.map((d: any) => ({
      day: d.day?.slice(5),
      expense: Number(d.total),
    })), [dailyTrend]);

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold" style={heading}>Expense Analytics</h1>
          <p className="text-sm text-muted-foreground">Full visibility into cost drivers & allocation</p>
        </div>
        <div className="flex items-center gap-2">
          {excCount > 0 && (
            <Badge variant="destructive" className="gap-1 text-xs">
              <AlertTriangle className="w-3 h-3" /> {excCount} issues
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={() => exportCSV(categories, `expense-categories-${dateFrom}.csv`)}>
            <Download className="w-3.5 h-3.5 mr-1" /> Categories
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="w-3.5 h-3.5 mr-1" /> Print
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-border/50">
        <CardContent className="p-4 flex flex-wrap gap-3 items-end">
          <div>
            <Label className="text-xs">Preset</Label>
            <Select value={preset} onValueChange={applyPreset}>
              <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="this-month">This Month</SelectItem>
                <SelectItem value="last-month">Last Month</SelectItem>
                <SelectItem value="last-7">Last 7 days</SelectItem>
                <SelectItem value="last-30">Last 30 days</SelectItem>
                <SelectItem value="last-90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">From</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[140px] h-8 text-xs" />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[140px] h-8 text-xs" />
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard title="Total Expenses" value={formatBDT2(summary.total_expenses)} icon={<DollarSign className="w-5 h-5" />} />
          <KpiCard title="Meta Ads" value={formatBDT2(summary.total_meta_ads)} icon={<Megaphone className="w-5 h-5" />} />
          <KpiCard title="Marketing" value={formatBDT2(summary.total_marketing)} icon={<TrendingUp className="w-5 h-5" />} />
          <KpiCard title="Operational" value={formatBDT2(summary.total_operational)} icon={<Wallet className="w-5 h-5" />} />
          <KpiCard title="Expense Ratio" value={`${summary.expense_ratio ?? 0}%`} subtitle="of revenue" icon={<BarChart3 className="w-5 h-5" />} />
          <KpiCard title="Avg Daily" value={formatBDT2(summary.avg_daily)} subtitle={`${summary.expense_per_order ? `৳${summary.expense_per_order}/order` : ""}`} icon={<Calendar className="w-5 h-5" />} />
        </div>
      )}

      {/* Exceptions Warning */}
      {excCount > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-destructive">{excCount} Data Issues</p>
              <ul className="mt-1 text-xs text-muted-foreground space-y-0.5">
                {exceptions.slice(0, 4).map((e: any, i: number) => (
                  <li key={i}>
                    {e.exc_type === "unposted" ? "Unposted expense" :
                     e.exc_type === "zero_amount" ? "Zero amount" :
                     "Missing payment account"}: {e.category} ({formatBDT2(e.amount)})
                  </li>
                ))}
                {excCount > 4 && <li>…and {excCount - 4} more</li>}
              </ul>
              <Link to="/exceptions" className="text-xs text-primary font-medium inline-flex items-center gap-1 mt-1">
                Exceptions Center <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      {!isLoading && categories.length > 0 && (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Pie Chart */}
          <Card className="border-border/50">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Breakdown by Category</CardTitle></CardHeader>
            <CardContent className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50} paddingAngle={2} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={{ strokeWidth: 1 }} style={{ fontSize: 10 }}>
                    {pieData.map((_: any, i: number) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <RTooltip formatter={(v: any) => formatBDT2(v)} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Daily Trend */}
          <Card className="border-border/50">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Daily Expense Trend</CardTitle></CardHeader>
            <CardContent className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueCompare} margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <RTooltip formatter={(v: any) => formatBDT2(v)} />
                  <Line type="monotone" dataKey="expense" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Advanced Analytics */}
      {!isLoading && (topExpenses.length > 0 || topDays.length > 0) && (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Top 5 Largest Expenses */}
          <Card className="border-border/50">
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-warning" /> Top 5 Largest Expenses</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Category</TableHead>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topExpenses.map((e: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{e.category}</TableCell>
                      <TableCell className="text-xs">{formatDate(e.expense_date)}</TableCell>
                      <TableCell className="text-xs text-right font-semibold" style={mono}>{formatBDT2(e.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Top 5 Highest Days */}
          <Card className="border-border/50">
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-destructive" /> Top 5 Highest Expense Days</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topDays.map((d: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{formatDate(d.day)}</TableCell>
                      <TableCell className="text-xs text-right font-semibold" style={mono}>{formatBDT2(d.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Category Grid */}
      {isLoading ? <Skeleton className="h-[400px]" /> : (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base" style={heading}>Expense by Category</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Category</TableHead>
                    <TableHead className="text-xs text-right cursor-pointer" onClick={() => toggleSort("expense_count")}>
                      Count <ArrowUpDown className={cn("inline w-3 h-3 ml-0.5", sortKey === "expense_count" && "text-primary")} />
                    </TableHead>
                    <TableHead className="text-xs text-right cursor-pointer" onClick={() => toggleSort("total_amount")}>
                      Total Amount <ArrowUpDown className={cn("inline w-3 h-3 ml-0.5", sortKey === "total_amount" && "text-primary")} />
                    </TableHead>
                    <TableHead className="text-xs text-right">% of Total</TableHead>
                    <TableHead className="text-xs text-right">% of Revenue</TableHead>
                    <TableHead className="text-xs text-center">Allocatable</TableHead>
                    <TableHead className="text-xs">Last Expense</TableHead>
                    <TableHead className="text-xs w-8"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedCategories.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No expenses for period</TableCell></TableRow>
                  )}
                  {sortedCategories.map((c: any) => {
                    const pctOfTotal = summary.total_expenses > 0 ? ((c.total_amount / summary.total_expenses) * 100).toFixed(1) : "0.0";
                    const pctOfRevenue = summary.revenue > 0 ? ((c.total_amount / summary.revenue) * 100).toFixed(2) : "-";
                    return (
                      <TableRow key={c.category} className="cursor-pointer" onClick={() => setDrillCategory(c.category)}>
                        <TableCell className="text-xs font-medium">{c.category}</TableCell>
                        <TableCell className="text-xs text-right" style={mono}>{c.expense_count}</TableCell>
                        <TableCell className="text-xs text-right font-semibold" style={mono}>{formatBDT2(c.total_amount)}</TableCell>
                        <TableCell className="text-xs text-right" style={mono}>{pctOfTotal}%</TableCell>
                        <TableCell className="text-xs text-right" style={mono}>{pctOfRevenue}%</TableCell>
                        <TableCell className="text-xs text-center">
                          {c.is_allocatable ? (
                            <Badge variant="outline" className="text-[10px] bg-success/10 text-success">Yes</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">No</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{formatDate(c.last_expense_date)}</TableCell>
                        <TableCell><ChevronRight className="w-3.5 h-3.5 text-muted-foreground" /></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                {sortedCategories.length > 1 && (
                  <TableFooter>
                    <TableRow className="font-semibold">
                      <TableCell className="text-xs">TOTAL</TableCell>
                      <TableCell className="text-xs text-right" style={mono}>{summary.total_count}</TableCell>
                      <TableCell className="text-xs text-right" style={mono}>{formatBDT2(summary.total_expenses)}</TableCell>
                      <TableCell className="text-xs text-right" style={mono}>100%</TableCell>
                      <TableCell className="text-xs text-right" style={mono}>{summary.expense_ratio}%</TableCell>
                      <TableCell />
                      <TableCell />
                      <TableCell />
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Drilldown Sheet */}
      <Sheet open={!!drillCategory} onOpenChange={(o) => !o && setDrillCategory(null)}>
        <SheetContent side="right" className="sm:max-w-2xl w-full overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{drillCategory} — Detail</SheetTitle>
          </SheetHeader>

          {drillLoading ? <Skeleton className="h-60 mt-4" /> : drillData && (
            <div className="space-y-5 mt-4">
              {/* Allocation Summary */}
              <Card className="border-border/50">
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5" /> Allocation Summary
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Allocated</p>
                      <p className="text-lg font-bold text-success" style={mono}>{formatBDT2(drillData.allocation.allocated)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Unallocated</p>
                      <p className={cn("text-lg font-bold", drillData.allocation.unallocated > 0 ? "text-warning" : "text-success")} style={mono}>
                        {formatBDT2(drillData.allocation.unallocated)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Expense Lines */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold">Expenses ({drillData.lines.length})</h3>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => exportCSV(drillData.lines, `expenses-${drillCategory}.csv`)}>
                    <Download className="w-3 h-3 mr-1" /> CSV
                  </Button>
                </div>
                <div className="max-h-[400px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Date</TableHead>
                        <TableHead className="text-xs text-right">Amount</TableHead>
                        <TableHead className="text-xs">Payment</TableHead>
                        <TableHead className="text-xs">Description</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {drillData.lines.map((l: any) => (
                        <TableRow key={l.id}>
                          <TableCell className="text-xs">{formatDate(l.expense_date)}</TableCell>
                          <TableCell className="text-xs text-right font-semibold" style={mono}>{formatBDT2(l.amount)}</TableCell>
                          <TableCell className="text-xs">{l.payment_account || l.payment_method || "-"}</TableCell>
                          <TableCell className="text-xs max-w-[200px] truncate">{l.description || "-"}</TableCell>
                          <TableCell className="text-xs">
                            <Badge variant="outline" className={cn("text-[10px]",
                              l.status === "posted" ? "bg-success/10 text-success" :
                              l.status === "reversed" ? "bg-destructive/10 text-destructive" :
                              "bg-warning/10 text-warning"
                            )}>
                              {l.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {drillData.lines.length === 0 && (
                        <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8 text-sm">No expenses</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
