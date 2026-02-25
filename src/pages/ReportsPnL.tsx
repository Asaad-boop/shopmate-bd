import { useState, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBDT, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, subMonths, subDays } from "date-fns";
import { Link } from "react-router-dom";
import {
  FileText, Download, Printer, TrendingUp, TrendingDown,
  ArrowUpRight, ArrowDownRight, DollarSign, Package, Truck, Megaphone,
  CheckCircle2, AlertTriangle, ExternalLink, ChevronRight, X, Lock,
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
    staleTime: 60_000,
  });
}

function useDrilldown(accountCode: string | null, dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: ["pnl-drilldown", accountCode, dateFrom, dateTo],
    queryFn: async () => {
      if (!accountCode) return [];
      const { data, error } = await supabase.rpc("pnl_account_drilldown", {
        p_account_code: accountCode,
        p_date_from: dateFrom,
        p_date_to: dateTo,
      });
      if (error) throw error;
      return (data as any) || [];
    },
    enabled: !!accountCode,
  });
}

export default function ReportsPnL() {
  const [preset, setPreset] = useState("this-month");
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [includeAllocations, setIncludeAllocations] = useState(true);
  const [drilldownCode, setDrilldownCode] = useState<string | null>(null);
  const [drilldownLabel, setDrilldownLabel] = useState("");

  const { data: pnl, isLoading } = usePnLReport(dateFrom, dateTo);
  const { data: drilldownData, isLoading: drilldownLoading } = useDrilldown(drilldownCode, dateFrom, dateTo);

  const handlePreset = (v: string) => {
    setPreset(v);
    if (PRESETS[v]) {
      const [f, t] = PRESETS[v]();
      setDateFrom(f);
      setDateTo(t);
    }
  };

  const openDrilldown = (code: string, label: string) => {
    setDrilldownCode(code);
    setDrilldownLabel(label);
  };

  // Derived
  const totalRevenue = pnl?.total_revenue || 0;
  const grossProfit = pnl?.gross_profit || 0;
  const grossMargin = totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 100) : 0;
  const totalExpenses = pnl?.total_expenses || 0;
  const courierExp = pnl?.courier_expense || 0;
  const returnLoss = pnl?.return_loss || 0;
  const allocatedExp = includeAllocations ? (pnl?.total_allocated || 0) : 0;
  const totalOpex = totalExpenses + courierExp + returnLoss + allocatedExp;
  const netProfit = grossProfit - totalOpex;
  const netMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;

  const integrity = pnl?.integrity || {};

  const handleExportCSV = useCallback(() => {
    if (!pnl) return;
    const rows: string[][] = [
      ["Profit & Loss Statement"],
      [`Period: ${dateFrom} to ${dateTo}`],
      [],
      ["INCOME", "Code", "Amount"],
      ...(pnl.income_lines || []).map((l: any) => [l.category, l.code, String(l.total || 0)]),
      ["Total Revenue", "", String(totalRevenue)],
      [],
      ["COGS", "Code", "Amount"],
      ...(pnl.cogs_lines || []).map((l: any) => [l.category, l.code, String(l.total || 0)]),
      ["Total COGS", "", String(pnl.cogs || 0)],
      ["Gross Profit", "", String(grossProfit)],
      [],
      ["EXPENSES", "Code", "Amount"],
      ...(pnl.expense_lines || []).map((l: any) => [l.category, l.code, String(l.total || 0)]),
      ["Total Expenses", "", String(totalExpenses)],
      ["Courier Expense", "", String(courierExp)],
      ["Return Loss", "", String(returnLoss)],
      [],
      ["NET PROFIT", "", String(netProfit)],
      ["Net Margin %", "", `${netMargin}%`],
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `PnL_${dateFrom}_${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [pnl, dateFrom, dateTo, totalRevenue, grossProfit, totalExpenses, courierExp, returnLoss, netProfit, netMargin]);

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
            <p className="text-sm text-muted-foreground">GL-based income statement · Posted journals only</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!pnl}>
            <Download className="w-4 h-4 mr-1" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()} disabled={!pnl}>
            <Printer className="w-4 h-4 mr-1" /> PDF
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
        <div className="space-y-6 print:space-y-4">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard label="Revenue" value={totalRevenue} icon={DollarSign} color="text-success" />
            <KPICard label="Gross Profit" value={grossProfit} sub={`${grossMargin}% margin`} icon={TrendingUp} color={grossProfit >= 0 ? "text-success" : "text-destructive"} />
            <KPICard label="Total Expenses" value={totalOpex} icon={TrendingDown} color="text-warning" />
            <KPICard label="Net Profit" value={netProfit} sub={`${netMargin}% margin`} icon={netProfit >= 0 ? ArrowUpRight : ArrowDownRight} color={netProfit >= 0 ? "text-success" : "text-destructive"} />
          </div>

          {/* Integrity Panel */}
          <Card className="border-border/50">
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-success" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reconciliation Checks</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <IntegrityCheck label="Revenue = GL Credits" ok={integrity.revenue_match} />
                <IntegrityCheck label="Expenses = GL Debits" ok={integrity.expense_match} />
                <IntegrityCheck label="All Journals Balanced" ok={integrity.journal_balanced} />
                <IntegrityCheck
                  label={integrity.period_locked ? "Period Locked" : "Period Open"}
                  ok={true}
                  icon={integrity.period_locked ? <Lock className="w-3 h-3" /> : undefined}
                  neutral={!integrity.period_locked}
                />
              </div>
              {(!integrity.journal_balanced) && (
                <div className="mt-2 flex items-center gap-2 text-xs text-destructive">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Unbalanced journals detected — </span>
                  <Link to="/exceptions" className="underline">View in Exceptions Center</Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* P&L Statement */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg" style={heading}>Income Statement</CardTitle>
              <p className="text-xs text-muted-foreground">{dateFrom} → {dateTo}</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 max-w-3xl">
                {/* Revenue */}
                <SectionHeader label="REVENUE" icon={DollarSign} className="bg-success/10 text-success" />
                {(pnl.income_lines || []).map((l: any) => (
                  <DrillRow key={l.code} label={`${l.code} — ${l.category}`} amount={l.total} count={l.entry_count}
                    onClick={() => openDrilldown(l.code, l.category)} />
                ))}
                <Subtotal label="Total Revenue" amount={totalRevenue} className="text-success" />

                {/* COGS */}
                <SectionHeader label="COST OF GOODS SOLD" icon={Package} className="bg-warning/10 text-warning" />
                {(pnl.cogs_lines || []).map((l: any) => (
                  <DrillRow key={l.code} label={`${l.code} — ${l.category}`} amount={l.total} count={l.entry_count} negative
                    onClick={() => openDrilldown(l.code, l.category)} />
                ))}
                {(pnl.cogs_lines || []).length === 0 && (
                  <Row label="COGS (from orders)" amount={pnl.cogs || 0} negative />
                )}
                <Subtotal label="Gross Profit" amount={grossProfit} className={grossProfit >= 0 ? "text-success" : "text-destructive"} />
                <p className="text-xs text-muted-foreground pl-4">Gross Margin: <span className="font-semibold" style={mono}>{grossMargin}%</span></p>

                {/* Courier & Returns */}
                <SectionHeader label="COURIER & RETURNS" icon={Truck} className="bg-info/10 text-info" />
                <Row label="Courier Delivery + COD Fees" amount={courierExp} negative />
                <Row label="Return Losses (COGS of returned items)" amount={returnLoss} negative />

                {/* Expenses */}
                <SectionHeader label="OPERATING EXPENSES" icon={Megaphone} className="bg-destructive/10 text-destructive" />
                {(pnl.expense_lines || []).map((e: any) => (
                  <DrillRow key={e.code} label={`${e.code} — ${e.category}`} amount={e.total} count={e.entry_count} negative
                    onClick={() => openDrilldown(e.code, e.category)} />
                ))}
                <Subtotal label="Total GL Expenses" amount={totalExpenses} className="text-destructive" />

                {/* Allocations */}
                {includeAllocations && allocatedExp > 0 && (
                  <>
                    <SectionHeader label="ALLOCATED EXPENSES (Management)" icon={Megaphone} className="bg-accent text-accent-foreground" />
                    <Row label="Total Allocated (Ads, Influencer, Ops)" amount={allocatedExp} negative />
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
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
                    <RTooltip formatter={(v: number) => formatBDT(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="gross_profit" name="Gross Profit" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="net_profit" name="Net Profit" radius={[4, 4, 0, 0]}>
                      {(pnl.monthly_breakdown || []).map((m: any, i: number) => (
                        <Cell key={i} fill={m.net_profit >= 0 ? "hsl(var(--success))" : "hsl(var(--destructive))"} opacity={0.6} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Drilldown Drawer */}
      <Sheet open={!!drilldownCode} onOpenChange={(o) => !o && setDrilldownCode(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-base">
              {drilldownLabel} <Badge variant="outline" className="ml-2 text-xs">{drilldownCode}</Badge>
            </SheetTitle>
            <p className="text-xs text-muted-foreground">{dateFrom} → {dateTo} · Posted journals only</p>
          </SheetHeader>
          {drilldownLoading ? (
            <div className="space-y-2 mt-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : (
            <div className="mt-4">
              <div className="flex justify-end mb-2">
                <Button variant="outline" size="sm" className="text-xs" onClick={() => {
                  const lines = (drilldownData || []) as any[];
                  const csv = [
                    ["Date", "Ref Type", "Ref ID", "Description", "Debit", "Credit"].join(","),
                    ...lines.map((l: any) => [l.entry_date, l.reference_type, l.reference_id, `"${l.journal_desc || ''}"`, l.debit, l.credit].join(","))
                  ].join("\n");
                  const blob = new Blob([csv], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url; a.download = `drilldown_${drilldownCode}_${dateFrom}.csv`; a.click();
                  URL.revokeObjectURL(url);
                }}>
                  <Download className="w-3.5 h-3.5 mr-1" /> Export
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Ref</TableHead>
                    <TableHead className="text-xs">Description</TableHead>
                    <TableHead className="text-xs text-right">Debit</TableHead>
                    <TableHead className="text-xs text-right">Credit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {((drilldownData || []) as any[]).map((l: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{formatDate(l.entry_date)}</TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="text-[10px]">{l.reference_type}</Badge>
                      </TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">{l.journal_desc || l.line_desc || "—"}</TableCell>
                      <TableCell className="text-xs text-right font-mono">{l.debit > 0 ? formatBDT(l.debit) : "—"}</TableCell>
                      <TableCell className="text-xs text-right font-mono">{l.credit > 0 ? formatBDT(l.credit) : "—"}</TableCell>
                    </TableRow>
                  ))}
                  {((drilldownData || []) as any[]).length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-8">No journal entries found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </SheetContent>
      </Sheet>
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

function IntegrityCheck({ label, ok, icon, neutral }: { label: string; ok: boolean; icon?: React.ReactNode; neutral?: boolean }) {
  return (
    <div className={cn(
      "flex items-center gap-2 text-xs px-3 py-2 rounded-lg",
      ok ? (neutral ? "bg-muted text-muted-foreground" : "bg-success/10 text-success") : "bg-destructive/10 text-destructive"
    )}>
      {icon || (ok ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />)}
      <span className="font-medium">{label}</span>
    </div>
  );
}

function SectionHeader({ label, icon: Icon, className }: { label: string; icon: any; className: string }) {
  return (
    <div className={cn("rounded-lg px-4 py-2 font-semibold text-sm flex justify-between items-center mt-4", className)}>
      <span className="flex items-center gap-2"><Icon className="w-3.5 h-3.5" />{label}</span>
      <span className="text-xs">Amount</span>
    </div>
  );
}

function Row({ label, amount, negative, muted }: { label: string; amount: number; negative?: boolean; muted?: boolean }) {
  return (
    <div className={cn("flex justify-between px-4 py-2 text-sm border-b border-border/30", muted && "opacity-50")}>
      <span>{label}</span>
      <span className={negative ? "text-destructive" : ""} style={mono}>
        {negative ? "−" : ""}{formatBDT(Math.abs(amount || 0))}
      </span>
    </div>
  );
}

function DrillRow({ label, amount, count, negative, onClick }: { label: string; amount: number; count?: number; negative?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex justify-between items-center px-4 py-2 text-sm border-b border-border/30 w-full text-left hover:bg-muted/50 transition-colors group">
      <span className="flex items-center gap-2">
        {label}
        {count != null && <Badge variant="outline" className="text-[9px] h-4 px-1">{count}</Badge>}
        <ChevronRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </span>
      <span className={negative ? "text-destructive" : ""} style={mono}>
        {negative ? "−" : ""}{formatBDT(Math.abs(amount || 0))}
      </span>
    </button>
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
