import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBDT, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, subMonths, subDays } from "date-fns";
import { Link } from "react-router-dom";
import {
  Banknote, Download, Printer, ArrowUpRight, ArrowDownRight,
  TrendingUp, Wallet, Building2, CheckCircle2, AlertTriangle,
  ChevronRight, ExternalLink,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip as RTooltip, ResponsiveContainer, CartesianGrid, Legend, Cell,
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

const ACCOUNT_OPTIONS = [
  { label: "All Accounts", value: "all", codes: ["1100", "1110", "1120", "1130"] },
  { label: "Cash", value: "1100", codes: ["1100"] },
  { label: "Bank", value: "1110", codes: ["1110"] },
  { label: "bKash", value: "1120", codes: ["1120"] },
  { label: "Nagad", value: "1130", codes: ["1130"] },
];

function useCashflowReport(dateFrom: string, dateTo: string, accountCodes: string[], includeTransfers: boolean) {
  return useQuery({
    queryKey: ["cashflow-report", dateFrom, dateTo, accountCodes, includeTransfers],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("cashflow_report", {
        p_date_from: dateFrom,
        p_date_to: dateTo,
        p_account_codes: accountCodes,
        p_include_transfers: includeTransfers,
      });
      if (error) throw error;
      return data as any;
    },
    staleTime: 60_000,
  });
}

function useCashflowDrilldown(refType: string | null, direction: string, dateFrom: string, dateTo: string, codes: string[]) {
  return useQuery({
    queryKey: ["cashflow-drilldown", refType, direction, dateFrom, dateTo, codes],
    queryFn: async () => {
      if (!refType) return [];
      const { data, error } = await supabase.rpc("cashflow_drilldown", {
        p_ref_type: refType,
        p_direction: direction,
        p_date_from: dateFrom,
        p_date_to: dateTo,
        p_account_codes: codes,
      });
      if (error) throw error;
      return (data as any) || [];
    },
    enabled: !!refType,
  });
}

export default function ReportsCashflow() {
  const [preset, setPreset] = useState("this-month");
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [accountFilter, setAccountFilter] = useState("all");
  const [includeTransfers, setIncludeTransfers] = useState(false);

  // Drilldown state
  const [drillRefType, setDrillRefType] = useState<string | null>(null);
  const [drillDirection, setDrillDirection] = useState<string>("inflow");
  const [drillLabel, setDrillLabel] = useState("");

  const selectedCodes = ACCOUNT_OPTIONS.find((a) => a.value === accountFilter)?.codes || ["1100", "1110", "1120", "1130"];
  const { data: cf, isLoading } = useCashflowReport(dateFrom, dateTo, selectedCodes, includeTransfers);
  const { data: drilldownData, isLoading: drillLoading } = useCashflowDrilldown(drillRefType, drillDirection, dateFrom, dateTo, selectedCodes);

  const handlePreset = (v: string) => {
    setPreset(v);
    if (PRESETS[v]) {
      const [f, t] = PRESETS[v]();
      setDateFrom(f);
      setDateTo(t);
    }
  };

  const openDrilldown = (refType: string, label: string, direction: string) => {
    setDrillRefType(refType);
    setDrillDirection(direction);
    setDrillLabel(label);
  };

  const totalInflow = cf?.total_inflow || 0;
  const totalOutflow = cf?.total_outflow || 0;
  const netChange = cf?.net_change || 0;
  const reconciled = cf?.reconciled ?? true;

  const handleExportCSV = useCallback(() => {
    if (!cf) return;
    const rows: string[][] = [
      ["Cashflow Statement"],
      [`Period: ${dateFrom} to ${dateTo}`],
      [],
      ["Opening Balance", String(cf.opening_balance || 0)],
      [],
      ["INFLOWS", "Amount", "Txns"],
      ...(cf.inflows || []).map((r: any) => [r.label, String(r.amount), String(r.txn_count)]),
      ["Total Inflow", String(totalInflow), ""],
      [],
      ["OUTFLOWS", "Amount", "Txns"],
      ...(cf.outflows || []).map((r: any) => [r.label, String(r.amount), String(r.txn_count)]),
      ["Total Outflow", String(totalOutflow), ""],
      [],
      ["Net Cash Change", String(netChange), ""],
      ["Closing Balance", String(cf.closing_balance || 0), ""],
      [],
      ["ACCOUNT BREAKDOWN", "Opening", "Inflow", "Outflow", "Closing"],
      ...(cf.by_account || []).map((a: any) => [
        `${a.code} — ${a.name}`, String(a.opening), String(a.period_inflow), String(a.period_outflow), String(a.closing),
      ]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Cashflow_${dateFrom}_${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [cf, dateFrom, dateTo, totalInflow, totalOutflow, netChange]);

  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto animate-fade-in">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Banknote className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={heading}>Cashflow Statement</h1>
            <p className="text-sm text-muted-foreground">GL-based cash movements · Posted journals only</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!cf}>
            <Download className="w-4 h-4 mr-1" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()} disabled={!cf}>
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
            <div>
              <Label className="text-xs">Account</Label>
              <Select value={accountFilter} onValueChange={setAccountFilter}>
                <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACCOUNT_OPTIONS.map((a) => (
                    <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <Switch id="transfers" checked={includeTransfers} onCheckedChange={setIncludeTransfers} />
              <Label htmlFor="transfers" className="text-xs cursor-pointer">Include Transfers</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
          <Skeleton className="h-[400px]" />
        </div>
      ) : cf && (
        <div className="space-y-6 print:space-y-4">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard label="Opening Balance" value={cf.opening_balance} icon={Wallet} color="text-muted-foreground" />
            <KPICard label="Total Inflow" value={totalInflow} icon={ArrowUpRight} color="text-success" />
            <KPICard label="Total Outflow" value={totalOutflow} icon={ArrowDownRight} color="text-destructive" />
            <KPICard label="Closing Balance" value={cf.closing_balance} icon={Building2} color="text-primary" />
          </div>

          {/* Reconciliation Panel */}
          <Card className="border-border/50">
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-2 mb-2">
                {reconciled ? <CheckCircle2 className="w-4 h-4 text-success" /> : <AlertTriangle className="w-4 h-4 text-destructive" />}
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Balance Check</span>
              </div>
              <div className="flex flex-wrap gap-4 items-center text-sm">
                <span>Opening <span className="font-bold" style={mono}>{formatBDT(cf.opening_balance)}</span></span>
                <span className="text-success">+ Inflow <span className="font-bold" style={mono}>{formatBDT(totalInflow)}</span></span>
                <span className="text-destructive">− Outflow <span className="font-bold" style={mono}>{formatBDT(totalOutflow)}</span></span>
                <span>=</span>
                <span className="font-bold text-primary" style={mono}>{formatBDT(cf.computed_closing)}</span>
                {reconciled ? (
                  <Badge className="bg-success/10 text-success border-success/20">✓ Reconciled</Badge>
                ) : (
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive">✗ Mismatch</Badge>
                    <Link to="/finance/ledger" className="text-xs text-primary underline">Check Ledger</Link>
                    <Link to="/exceptions" className="text-xs text-destructive underline">Exceptions</Link>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Statement */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg" style={heading}>Cash Flow Statement</CardTitle>
              <p className="text-xs text-muted-foreground">{dateFrom} → {dateTo}{!includeTransfers && " · Transfers excluded"}</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 max-w-3xl">
                <BalanceRow label="Opening Cash Balance" amount={cf.opening_balance} highlight />

                {/* Inflows */}
                <SectionHeader label="CASH INFLOWS" className="bg-success/10 text-success" />
                {(cf.inflows || []).map((r: any) => (
                  <FlowDrillRow key={r.ref_type} label={r.label} amount={r.amount} count={r.txn_count} positive
                    onClick={() => openDrilldown(r.ref_type, r.label, "inflow")} />
                ))}
                {(cf.inflows || []).length === 0 && <EmptyRow />}
                <SubtotalRow label="Total Inflows" amount={totalInflow} positive />

                {/* Outflows */}
                <SectionHeader label="CASH OUTFLOWS" className="bg-destructive/10 text-destructive" />
                {(cf.outflows || []).map((r: any) => (
                  <FlowDrillRow key={r.ref_type} label={r.label} amount={r.amount} count={r.txn_count}
                    onClick={() => openDrilldown(r.ref_type, r.label, "outflow")} />
                ))}
                {(cf.outflows || []).length === 0 && <EmptyRow />}
                <SubtotalRow label="Total Outflows" amount={totalOutflow} />

                {/* Net */}
                <div className="flex justify-between px-4 py-3 mt-4 rounded-xl bg-foreground text-background font-bold text-base">
                  <span style={heading}>NET CASH MOVEMENT</span>
                  <span className={netChange >= 0 ? "text-emerald-400" : "text-red-400"} style={mono}>
                    {netChange >= 0 ? "+" : ""}{formatBDT(netChange)}
                  </span>
                </div>

                <BalanceRow label="Closing Cash Balance" amount={cf.closing_balance} highlight />
              </div>
            </CardContent>
          </Card>

          {/* Account Breakdown */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg" style={heading}>Account Breakdown</CardTitle>
                <Link to="/finance/accounts" className="text-xs text-primary hover:underline flex items-center gap-1">
                  Accounts <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left py-2 px-3 font-medium">Account</th>
                      <th className="text-right py-2 px-3 font-medium">Opening</th>
                      <th className="text-right py-2 px-3 font-medium">Inflow</th>
                      <th className="text-right py-2 px-3 font-medium">Outflow</th>
                      <th className="text-right py-2 px-3 font-medium">Closing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(cf.by_account || []).map((a: any) => (
                      <tr key={a.code} className="border-b border-border/30 hover:bg-muted/30">
                        <td className="py-2 px-3 font-medium">{a.code} — {a.name}</td>
                        <td className="py-2 px-3 text-right" style={mono}>{formatBDT(a.opening)}</td>
                        <td className="py-2 px-3 text-right text-success" style={mono}>{formatBDT(a.period_inflow)}</td>
                        <td className="py-2 px-3 text-right text-destructive" style={mono}>{formatBDT(a.period_outflow)}</td>
                        <td className="py-2 px-3 text-right font-bold" style={mono}>{formatBDT(a.closing)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily Net Cash Line */}
            {(cf.daily_trend || []).length > 1 && (
              <Card className="border-border/50 print:break-before-page">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Daily Cash Flow</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={cf.daily_trend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="d" tick={{ fontSize: 10 }} tickFormatter={(v) => { try { return format(new Date(v), "dd MMM"); } catch { return v; } }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
                      <RTooltip formatter={(v: number) => formatBDT(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Area type="monotone" dataKey="inflow" name="Inflow" stroke="hsl(var(--success))" fill="hsl(var(--success))" fillOpacity={0.15} strokeWidth={2} />
                      <Area type="monotone" dataKey="outflow" name="Outflow" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive))" fillOpacity={0.15} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Outflow by Category Bar */}
            {(cf.outflows || []).length > 0 && (
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Outflows by Category</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={(cf.outflows || []).slice(0, 8)} layout="vertical" margin={{ top: 5, right: 10, left: 80, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={75} />
                      <RTooltip formatter={(v: number) => formatBDT(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Bar dataKey="amount" name="Outflow" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} opacity={0.8} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Drilldown Drawer */}
      <Sheet open={!!drillRefType} onOpenChange={(o) => !o && setDrillRefType(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-base">
              {drillLabel}
              <Badge variant="outline" className="ml-2 text-xs">{drillDirection === "inflow" ? "Inflow" : "Outflow"}</Badge>
            </SheetTitle>
            <p className="text-xs text-muted-foreground">{dateFrom} → {dateTo}</p>
          </SheetHeader>
          {drillLoading ? (
            <div className="space-y-2 mt-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : (
            <div className="mt-4">
              <div className="flex justify-end mb-2">
                <Button variant="outline" size="sm" className="text-xs" onClick={() => {
                  const lines = (drilldownData || []) as any[];
                  const csv = [
                    ["Date", "Ref Type", "Ref ID", "Account", "Description", "Amount"].join(","),
                    ...lines.map((l: any) => [l.entry_date, l.reference_type, l.reference_id, l.account_name, `"${l.journal_desc || ''}"`, l.amount].join(","))
                  ].join("\n");
                  const blob = new Blob([csv], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url; a.download = `cashflow_${drillRefType}_${drillDirection}.csv`; a.click();
                  URL.revokeObjectURL(url);
                }}>
                  <Download className="w-3.5 h-3.5 mr-1" /> Export
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Account</TableHead>
                    <TableHead className="text-xs">Ref</TableHead>
                    <TableHead className="text-xs">Description</TableHead>
                    <TableHead className="text-xs text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {((drilldownData || []) as any[]).map((l: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{formatDate(l.entry_date)}</TableCell>
                      <TableCell className="text-xs">{l.account_code}</TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="text-[10px]">{l.reference_type}</Badge>
                      </TableCell>
                      <TableCell className="text-xs max-w-[180px] truncate">{l.journal_desc || l.line_desc || "—"}</TableCell>
                      <TableCell className={cn("text-xs text-right font-mono", drillDirection === "inflow" ? "text-success" : "text-destructive")}>
                        {formatBDT(l.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {((drilldownData || []) as any[]).length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-8">No entries found</TableCell></TableRow>
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

function KPICard({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
  return (
    <Card className="border-border/50">
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground font-medium">{label}</span>
          <Icon className={cn("w-4 h-4", color)} />
        </div>
        <p className={cn("text-xl font-bold", color)} style={mono}>{formatBDT(value)}</p>
      </CardContent>
    </Card>
  );
}

function SectionHeader({ label, className }: { label: string; className: string }) {
  return (
    <div className={cn("rounded-lg px-4 py-2 font-semibold text-sm flex justify-between items-center mt-4", className)}>
      <span>{label}</span>
      <span className="text-xs">Amount</span>
    </div>
  );
}

function FlowDrillRow({ label, amount, count, positive, onClick }: {
  label: string; amount: number; count: number; positive?: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="flex justify-between items-center px-4 py-2 text-sm border-b border-border/30 w-full text-left hover:bg-muted/50 transition-colors group">
      <span className="flex items-center gap-2">
        {label}
        <Badge variant="outline" className="text-[9px] h-4 px-1">{count}</Badge>
        <ChevronRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </span>
      <span className={positive ? "text-success" : "text-destructive"} style={mono}>
        {positive ? "+" : "−"}{formatBDT(Math.abs(amount || 0))}
      </span>
    </button>
  );
}

function SubtotalRow({ label, amount, positive }: { label: string; amount: number; positive?: boolean }) {
  return (
    <div className="flex justify-between px-4 py-2 text-sm font-bold bg-muted/50 rounded">
      <span>{label}</span>
      <span className={positive ? "text-success" : "text-destructive"} style={mono}>
        {positive ? "+" : "−"}{formatBDT(Math.abs(amount))}
      </span>
    </div>
  );
}

function BalanceRow({ label, amount, highlight }: { label: string; amount: number; highlight?: boolean }) {
  return (
    <div className={cn("flex justify-between px-4 py-2 text-sm font-semibold", highlight && "bg-muted/70 rounded-lg mt-2")}>
      <span>{label}</span>
      <span className="text-primary" style={mono}>{formatBDT(amount)}</span>
    </div>
  );
}

function EmptyRow() {
  return <p className="px-4 py-2 text-sm text-muted-foreground italic">No transactions in this period</p>;
}
