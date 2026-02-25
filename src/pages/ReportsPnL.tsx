import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatBDT } from "@/lib/format";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, subMonths, subDays } from "date-fns";
import {
  FileText, Download, Printer, TrendingUp, TrendingDown,
  ArrowUpRight, ArrowDownRight, DollarSign, Package, Truck, Megaphone,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer,
  CartesianGrid, Legend, Cell,
} from "recharts";

const heading: React.CSSProperties = { fontFamily: "'Playfair Display', serif" };
const mono: React.CSSProperties = { fontFamily: "'DM Mono', monospace" };

const PRESETS: Record<string, () => [string, string]> = {
  "this-month": () => [format(startOfMonth(new Date()), "yyyy-MM-dd"), format(endOfMonth(new Date()), "yyyy-MM-dd")],
  "last-month": () => [format(startOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd"), format(endOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd")],
  "last-30": () => [format(subDays(new Date(), 29), "yyyy-MM-dd"), format(new Date(), "yyyy-MM-dd")],
  "last-90": () => [format(subDays(new Date(), 89), "yyyy-MM-dd"), format(new Date(), "yyyy-MM-dd")],
  "last-7": () => [format(subDays(new Date(), 6), "yyyy-MM-dd"), format(new Date(), "yyyy-MM-dd")],
};

function usePnLReport(dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: ["pnl-report", dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("profit_loss_report", {
        p_date_from: dateFrom,
        p_date_to: dateTo,
      });
      if (error) throw error;
      return data as any;
    },
  });
}

export default function ReportsPnL() {
  const [preset, setPreset] = useState("this-month");
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [includeAllocations, setIncludeAllocations] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  const { data: pnl, isLoading } = usePnLReport(dateFrom, dateTo);

  const handlePreset = (v: string) => {
    setPreset(v);
    if (PRESETS[v]) {
      const [f, t] = PRESETS[v]();
      setDateFrom(f);
      setDateTo(t);
    }
  };

  // Derived calculations
  const totalRevenue = (pnl?.product_sales || 0) + (pnl?.shipping_income || 0);
  const grossProfit = totalRevenue - (pnl?.cogs || 0);
  const grossMargin = totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 100) : 0;

  const totalExpenses = (pnl?.expense_categories || []).reduce((s: number, e: any) => s + (e.total || 0), 0);
  const courierExp = pnl?.courier_expense || 0;
  const returnLoss = pnl?.return_loss || 0;
  const allocatedExp = includeAllocations ? (pnl?.total_allocated || 0) : 0;

  const totalOpex = totalExpenses + courierExp + returnLoss + allocatedExp;
  const netProfit = grossProfit - totalOpex;
  const netMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;

  const handlePrint = () => window.print();

  const handleExportCSV = () => {
    if (!pnl) return;
    const rows: string[][] = [
      ["Profit & Loss Statement"],
      [`Period: ${dateFrom} to ${dateTo}`],
      [],
      ["INCOME", "Amount"],
      ["Product Sales", String(pnl.product_sales || 0)],
      ["Shipping Income", String(pnl.shipping_income || 0)],
      ["Total Revenue", String(totalRevenue)],
      [],
      ["COST OF GOODS SOLD", "Amount"],
      ["COGS (Stock Ledger)", String(pnl.cogs || 0)],
      ["Gross Profit", String(grossProfit)],
      ["Gross Margin %", `${grossMargin}%`],
      [],
      ["OPERATING EXPENSES", "Amount"],
      ["Courier Expense", String(courierExp)],
      ["Return Losses", String(returnLoss)],
      ...(pnl.expense_categories || []).map((e: any) => [e.category, String(e.total || 0)]),
    ];
    if (includeAllocations) {
      rows.push([], ["ALLOCATED EXPENSES", "Amount"]);
      (pnl.allocated_expenses || []).forEach((a: any) => rows.push([`${a.category} (${a.method})`, String(a.total || 0)]));
      rows.push(["Total Allocated", String(pnl.total_allocated || 0)]);
    }
    rows.push([], ["NET PROFIT", String(netProfit)], ["Net Margin %", `${netMargin}%`]);

    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `PnL_${dateFrom}_${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto animate-fade-in">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={heading}>Profit & Loss</h1>
            <p className="text-sm text-muted-foreground">Detailed income statement with expense breakdown</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!pnl}>
            <Download className="w-4 h-4 mr-1" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} disabled={!pnl}>
            <Printer className="w-4 h-4 mr-1" /> Print
          </Button>
        </div>
      </header>

      {/* Filters */}
      <Card className="border-border/50">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <Label className="text-xs">Period</Label>
              <Select value={preset} onValueChange={handlePreset}>
                <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="this-month">This Month</SelectItem>
                  <SelectItem value="last-month">Last Month</SelectItem>
                  <SelectItem value="last-7">Last 7 Days</SelectItem>
                  <SelectItem value="last-30">Last 30 Days</SelectItem>
                  <SelectItem value="last-90">Last 90 Days</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">From</Label>
              <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPreset("custom"); }} className="w-[150px] h-8 text-xs" />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPreset("custom"); }} className="w-[150px] h-8 text-xs" />
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <Switch id="alloc" checked={includeAllocations} onCheckedChange={setIncludeAllocations} />
              <Label htmlFor="alloc" className="text-xs cursor-pointer">Include Allocations</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
          <Skeleton className="h-[400px]" />
        </div>
      ) : pnl && (
        <div ref={printRef} className="space-y-6 print:space-y-4">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard label="Revenue" value={totalRevenue} icon={DollarSign} color="text-emerald-600" />
            <KPICard label="Gross Profit" value={grossProfit} sub={`${grossMargin}% margin`} icon={TrendingUp} color={grossProfit >= 0 ? "text-emerald-600" : "text-destructive"} />
            <KPICard label="Total Expenses" value={totalOpex} icon={TrendingDown} color="text-orange-600" />
            <KPICard label="Net Profit" value={netProfit} sub={`${netMargin}% margin`} icon={netProfit >= 0 ? ArrowUpRight : ArrowDownRight} color={netProfit >= 0 ? "text-emerald-600" : "text-destructive"} />
          </div>

          {/* P&L Statement */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg" style={heading}>Income Statement</CardTitle>
              <p className="text-xs text-muted-foreground">{dateFrom} → {dateTo}</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 max-w-3xl">
                {/* Revenue */}
                <SectionHeader label="REVENUE" icon={DollarSign} className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300" />
                <Row label="Product Sales" amount={pnl.product_sales} />
                <Row label="Shipping Income" amount={pnl.shipping_income} />
                <Subtotal label="Total Revenue" amount={totalRevenue} className="text-emerald-700 dark:text-emerald-400" />

                {/* COGS */}
                <SectionHeader label="COST OF GOODS SOLD" icon={Package} className="bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300" />
                <Row label="COGS (Stock Ledger Valuation)" amount={pnl.cogs} negative />
                {pnl.cogs_gl > 0 && pnl.cogs_gl !== pnl.cogs && (
                  <Row label="COGS (GL — reconciliation)" amount={pnl.cogs_gl} muted />
                )}
                <Subtotal label="Gross Profit" amount={grossProfit} className={grossProfit >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"} />
                <p className="text-xs text-muted-foreground pl-4">Gross Margin: <span className="font-semibold" style={mono}>{grossMargin}%</span></p>

                {/* Courier */}
                <SectionHeader label="COURIER & RETURNS" icon={Truck} className="bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300" />
                <Row label="Courier Delivery + COD Fees" amount={courierExp} negative />
                <Row label="Return Losses (COGS of returned items)" amount={returnLoss} negative />

                {/* Operating Expenses */}
                <SectionHeader label="OPERATING EXPENSES" icon={Megaphone} className="bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300" />
                {(pnl.expense_categories || []).map((e: any) => (
                  <Row key={e.code} label={`${e.code} — ${e.category}`} amount={e.total} negative />
                ))}
                <Subtotal label="Total GL Expenses" amount={totalExpenses} className="text-red-600 dark:text-red-400" />

                {/* Allocations */}
                {includeAllocations && (pnl.allocated_expenses || []).length > 0 && (
                  <>
                    <SectionHeader label="ALLOCATED EXPENSES (Management)" icon={Megaphone} className="bg-purple-50 dark:bg-purple-950/30 text-purple-800 dark:text-purple-300" />
                    {(pnl.allocated_expenses || []).map((a: any, i: number) => (
                      <Row key={i} label={`${a.category} (${a.method})`} amount={a.total} negative />
                    ))}
                    <Subtotal label="Total Allocated" amount={pnl.total_allocated} className="text-purple-600 dark:text-purple-400" />
                  </>
                )}

                {/* Net Profit */}
                <div className="flex justify-between px-4 py-3 mt-4 rounded-xl bg-foreground text-background font-bold text-base">
                  <span style={heading}>NET PROFIT</span>
                  <span className={netProfit >= 0 ? "text-emerald-400" : "text-red-400"} style={mono}>
                    {formatBDT(netProfit)}
                  </span>
                </div>
                <p className="text-center text-sm text-muted-foreground mt-1">
                  Net Margin: <span className="font-semibold" style={mono}>{netMargin}%</span>
                  {" · "}
                  Delivered: <span className="font-semibold">{pnl.delivered_count}</span>
                  {" · "}
                  Returns: <span className="font-semibold">{pnl.returned_count}</span>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Monthly Chart */}
          {(pnl.monthly_breakdown || []).length > 1 && (
            <Card className="border-border/50 print:break-before-page">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg" style={heading}>Monthly Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={pnl.monthly_breakdown} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                    <XAxis dataKey="label" className="text-xs" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
                    <RTooltip
                      formatter={(v: number) => formatBDT(v)}
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="gross_profit" name="Gross Profit" radius={[4, 4, 0, 0]}>
                      {(pnl.monthly_breakdown || []).map((_: any, i: number) => (
                        <Cell key={i} fill="hsl(142, 71%, 45%)" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ─────────── */

function KPICard({ label, value, sub, icon: Icon, color }: { label: string; value: number; sub?: string; icon: any; color: string }) {
  return (
    <Card className="border-border/50">
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground font-medium">{label}</span>
          <Icon className={cn("w-4 h-4", color)} />
        </div>
        <p className={cn("text-xl font-bold", color)} style={mono}>{formatBDT(value)}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function SectionHeader({ label, icon: Icon, className }: { label: string; icon: any; className: string }) {
  return (
    <div className={cn("rounded-lg px-4 py-2 font-semibold text-sm flex justify-between items-center mt-4", className)}>
      <span className="flex items-center gap-2"><Icon className="w-3.5 h-3.5" />{label}</span>
      <span>Amount</span>
    </div>
  );
}

function Row({ label, amount, negative, muted }: { label: string; amount: number; negative?: boolean; muted?: boolean }) {
  return (
    <div className={cn("flex justify-between px-4 py-2 text-sm border-b border-border/30", muted && "opacity-50")}>
      <span>{label}</span>
      <span className={negative ? "text-red-600 dark:text-red-400" : ""} style={mono}>
        {negative ? "−" : ""}{formatBDT(Math.abs(amount || 0))}
      </span>
    </div>
  );
}

function Subtotal({ label, amount, className }: { label: string; amount: number; className?: string }) {
  return (
    <div className="flex justify-between px-4 py-2 text-sm font-bold bg-muted/50 rounded">
      <span>{label}</span>
      <span className={className} style={mono}>{formatBDT(amount)}</span>
    </div>
  );
}
