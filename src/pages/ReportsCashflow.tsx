import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatBDT } from "@/lib/format";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, subMonths, subDays } from "date-fns";
import {
  Banknote, Download, Printer, ArrowUpRight, ArrowDownRight,
  TrendingUp, Wallet, Building2, CreditCard,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer,
  CartesianGrid, Legend,
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

function useCashflowReport(dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: ["cashflow-report", dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("cashflow_report", {
        p_date_from: dateFrom,
        p_date_to: dateTo,
      });
      if (error) throw error;
      return data as any;
    },
  });
}

export default function ReportsCashflow() {
  const [preset, setPreset] = useState("this-month");
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));

  const { data: cf, isLoading } = useCashflowReport(dateFrom, dateTo);

  const handlePreset = (v: string) => {
    setPreset(v);
    if (PRESETS[v]) {
      const [f, t] = PRESETS[v]();
      setDateFrom(f);
      setDateTo(t);
    }
  };

  const sumNet = (items: any[]) => (items || []).reduce((s: number, i: any) => s + (i.net_amount || 0), 0);
  const opNet = sumNet(cf?.operating);
  const invNet = sumNet(cf?.investing);
  const finNet = sumNet(cf?.financing);
  const totalNet = opNet + invNet + finNet;

  const handlePrint = () => window.print();

  const handleExportCSV = () => {
    if (!cf) return;
    const rows: string[][] = [
      ["Cashflow Statement"],
      [`Period: ${dateFrom} to ${dateTo}`],
      [],
      ["Opening Balance", String(cf.opening_balance || 0)],
      [],
      ["OPERATING ACTIVITIES", "Inflow", "Outflow", "Net", "Txns"],
      ...(cf.operating || []).map((r: any) => [r.label, String(r.inflow), String(r.outflow), String(r.net_amount), String(r.txn_count)]),
      ["Subtotal Operating", "", "", String(opNet), ""],
      [],
      ["INVESTING ACTIVITIES", "Inflow", "Outflow", "Net", "Txns"],
      ...(cf.investing || []).map((r: any) => [r.label, String(r.inflow), String(r.outflow), String(r.net_amount), String(r.txn_count)]),
      ["Subtotal Investing", "", "", String(invNet), ""],
      [],
      ["FINANCING ACTIVITIES", "Inflow", "Outflow", "Net", "Txns"],
      ...(cf.financing || []).map((r: any) => [r.label, String(r.inflow), String(r.outflow), String(r.net_amount), String(r.txn_count)]),
      ["Subtotal Financing", "", "", String(finNet), ""],
      [],
      ["Net Cash Movement", "", "", String(totalNet), ""],
      ["Closing Balance", "", "", String(cf.closing_balance || 0), ""],
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
  };

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
            <p className="text-sm text-muted-foreground">GL-based cash movements by activity type</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!cf}>
            <Download className="w-4 h-4 mr-1" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} disabled={!cf}>
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
            <KPICard label="Net Cash Movement" value={totalNet} icon={totalNet >= 0 ? ArrowUpRight : ArrowDownRight} color={totalNet >= 0 ? "text-emerald-600" : "text-destructive"} />
            <KPICard label="Closing Balance" value={cf.closing_balance} icon={Building2} color="text-primary" />
            <KPICard label="Operating Cashflow" value={opNet} icon={TrendingUp} color={opNet >= 0 ? "text-emerald-600" : "text-destructive"} />
          </div>

          {/* Cashflow Statement */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg" style={heading}>Statement of Cash Flows</CardTitle>
              <p className="text-xs text-muted-foreground">{dateFrom} → {dateTo}</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 max-w-3xl">
                <BalanceRow label="Opening Cash Balance" amount={cf.opening_balance} highlight />

                {/* Operating */}
                <SectionHeader label="OPERATING ACTIVITIES" className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300" />
                {(cf.operating || []).map((r: any) => (
                  <FlowRow key={r.reference_type} label={r.label} inflow={r.inflow} outflow={r.outflow} net={r.net_amount} count={r.txn_count} />
                ))}
                {(cf.operating || []).length === 0 && <EmptyRow />}
                <SubtotalRow label="Net Operating" amount={opNet} />

                {/* Investing */}
                <SectionHeader label="INVESTING ACTIVITIES" className="bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300" />
                {(cf.investing || []).map((r: any) => (
                  <FlowRow key={r.reference_type} label={r.label} inflow={r.inflow} outflow={r.outflow} net={r.net_amount} count={r.txn_count} />
                ))}
                {(cf.investing || []).length === 0 && <EmptyRow />}
                <SubtotalRow label="Net Investing" amount={invNet} />

                {/* Financing */}
                <SectionHeader label="FINANCING ACTIVITIES" className="bg-purple-50 dark:bg-purple-950/30 text-purple-800 dark:text-purple-300" />
                {(cf.financing || []).map((r: any) => (
                  <FlowRow key={r.reference_type} label={r.label} inflow={r.inflow} outflow={r.outflow} net={r.net_amount} count={r.txn_count} />
                ))}
                {(cf.financing || []).length === 0 && <EmptyRow />}
                <SubtotalRow label="Net Financing" amount={finNet} />

                {/* Net */}
                <div className="flex justify-between px-4 py-3 mt-4 rounded-xl bg-foreground text-background font-bold text-base">
                  <span style={heading}>NET CASH MOVEMENT</span>
                  <span className={totalNet >= 0 ? "text-emerald-400" : "text-red-400"} style={mono}>
                    {formatBDT(totalNet)}
                  </span>
                </div>

                <BalanceRow label="Closing Cash Balance" amount={cf.closing_balance} highlight />
              </div>
            </CardContent>
          </Card>

          {/* Account Breakdown */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg" style={heading}>Account Breakdown</CardTitle>
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
                        <td className="py-2 px-3 text-right text-emerald-600" style={mono}>{formatBDT(a.period_inflow)}</td>
                        <td className="py-2 px-3 text-right text-red-600" style={mono}>{formatBDT(a.period_outflow)}</td>
                        <td className="py-2 px-3 text-right font-bold" style={mono}>{formatBDT(a.closing)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Daily Trend Chart */}
          {(cf.daily_trend || []).length > 1 && (
            <Card className="border-border/50 print:break-before-page">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg" style={heading}>Daily Cash Flow</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={cf.daily_trend} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                    <XAxis dataKey="d" tick={{ fontSize: 10 }} tickFormatter={(v) => format(new Date(v), "dd MMM")} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
                    <RTooltip formatter={(v: number) => formatBDT(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} labelFormatter={(v) => format(new Date(v), "dd MMM yyyy")} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area type="monotone" dataKey="inflow" name="Inflow" stroke="hsl(142, 71%, 45%)" fill="hsl(142, 71%, 45%)" fillOpacity={0.15} />
                    <Area type="monotone" dataKey="outflow" name="Outflow" stroke="hsl(0, 84%, 60%)" fill="hsl(0, 84%, 60%)" fillOpacity={0.15} />
                  </AreaChart>
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
    <div className={cn("rounded-lg px-4 py-2 font-semibold text-sm mt-4 grid grid-cols-[1fr_auto_auto_auto] gap-4", className)}>
      <span>{label}</span>
      <span className="text-right w-20">Inflow</span>
      <span className="text-right w-20">Outflow</span>
      <span className="text-right w-24">Net</span>
    </div>
  );
}

function FlowRow({ label, inflow, outflow, net, count }: { label: string; inflow: number; outflow: number; net: number; count: number }) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-2 text-sm border-b border-border/30">
      <span>{label} <span className="text-muted-foreground text-xs">({count})</span></span>
      <span className="text-right w-20 text-emerald-600" style={mono}>{inflow > 0 ? formatBDT(inflow) : "—"}</span>
      <span className="text-right w-20 text-red-600" style={mono}>{outflow > 0 ? formatBDT(outflow) : "—"}</span>
      <span className={cn("text-right w-24 font-medium", net >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-destructive")} style={mono}>
        {formatBDT(net)}
      </span>
    </div>
  );
}

function SubtotalRow({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex justify-between px-4 py-2 text-sm font-bold bg-muted/50 rounded">
      <span>{label}</span>
      <span className={amount >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"} style={mono}>{formatBDT(amount)}</span>
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
