import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { formatBDT, formatNumber } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFinKpis, useSettlementAging, useSupplierPayablesSnapshot, useExpenseBreakdown, useCashflowTrend } from "@/hooks/use-fin-dashboard";
import { useExecFinance } from "@/hooks/use-exec-dashboard";
import { HeroKpi } from "./DashboardShared";
import {
  Wallet, CreditCard, Landmark, Smartphone, Banknote, Receipt,
  Upload, ArrowRight, AlertTriangle, Clock,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell,
} from "recharts";

const PIE_COLORS = [
  "hsl(var(--primary))", "hsl(var(--success))", "hsl(var(--warning))",
  "hsl(var(--destructive))", "hsl(var(--info))", "hsl(160, 60%, 45%)",
  "hsl(280, 60%, 55%)", "hsl(30, 70%, 50%)",
];

interface Props { from: string; to: string; }

export function FinanceMode({ from, to }: Props) {
  const navigate = useNavigate();
  const { data: kpis, isLoading: kpiL } = useFinKpis(from, to);
  const { data: finance, isLoading: finL } = useExecFinance();
  const { data: aging, isLoading: agingL } = useSettlementAging();
  const { data: suppliers, isLoading: suppL } = useSupplierPayablesSnapshot();
  const { data: expenses, isLoading: expL } = useExpenseBreakdown(from, to);
  const { data: cashflow, isLoading: cfL } = useCashflowTrend(14);

  const cashflowData = useMemo(() =>
    (cashflow || []).map((d) => ({
      ...d,
      label: new Date(d.day).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
      net: d.inflow - d.outflow,
    })), [cashflow]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* KPI Strip */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <HeroKpi label="Liquid Cash" value={formatBDT(kpis?.liquid_cash)} icon={Wallet}
          onClick={() => navigate("/finance/accounts")} loading={kpiL} accent="bg-info/10 text-info" />
        <HeroKpi label="Courier Receivable" value={formatBDT(kpis?.courier_receivable)} icon={CreditCard}
          onClick={() => navigate("/finance/settlements")} loading={kpiL} accent="bg-warning/10 text-warning" />
        <HeroKpi label="Settlements Posted" value={formatNumber(kpis?.settlements_posted)} icon={Receipt}
          onClick={() => navigate("/finance/settlements")} loading={kpiL} accent="bg-success/10 text-success" />
        <HeroKpi label="Supplier Payables" value={formatBDT(kpis?.supplier_payables)} icon={Landmark}
          onClick={() => navigate("/purchasing")} loading={kpiL} accent="bg-destructive/10 text-destructive" />
        <HeroKpi label="Period Expenses" value={formatBDT(kpis?.period_expenses)} icon={Receipt}
          onClick={() => navigate("/expenses")} loading={kpiL} />
        <HeroKpi label="Unposted Events" value={formatNumber(kpis?.unposted_events)} icon={AlertTriangle}
          onClick={() => navigate("/finance/posting-queue")} loading={kpiL}
          accent={(kpis?.unposted_events ?? 0) > 0 ? "bg-warning/10 text-warning" : "bg-success/10 text-success"} />
      </section>

      {/* Account Balances + Settlement Workbench */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Account Balances */}
        <Card className="border-0 shadow-sm cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate("/finance/accounts")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Account Balances</CardTitle>
          </CardHeader>
          <CardContent>
            {finL ? <Skeleton className="h-[140px]" /> : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Cash", value: finance?.cash, icon: Banknote },
                    { label: "Bank", value: finance?.bank, icon: Landmark },
                    { label: "bKash", value: finance?.bkash, icon: Smartphone },
                    { label: "Nagad", value: finance?.nagad, icon: Smartphone },
                  ].map((a) => (
                    <div key={a.label} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-accent/30">
                      <a.icon className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{a.label}</p>
                        <p className="text-sm font-bold font-mono">{formatBDT(a.value)}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-primary/5 rounded-xl p-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Total Liquid</span>
                  <span className="text-lg font-bold font-mono">{formatBDT(finance?.total_liquid)}</span>
                </div>
                <Button variant="ghost" size="sm" className="w-full text-xs gap-1">View All Accounts <ArrowRight className="w-3 h-3" /></Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Settlement Workbench */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Settlement Workbench</CardTitle>
            {aging && aging.total_unsettled_count > 0 && (
              <Badge variant="destructive" className="text-xs">{aging.total_unsettled_count}</Badge>
            )}
          </CardHeader>
          <CardContent>
            {agingL ? <Skeleton className="h-[140px]" /> : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Unsettled Amount</span>
                  <span className="text-lg font-bold font-mono text-warning">{formatBDT(aging?.total_unsettled_amount)}</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "0-3d", value: aging?.bucket_0_3 ?? 0 },
                    { label: "4-7d", value: aging?.bucket_4_7 ?? 0 },
                    { label: "8-15d", value: aging?.bucket_8_15 ?? 0 },
                    { label: "15d+", value: aging?.bucket_15_plus ?? 0 },
                  ].map((b) => (
                    <div key={b.label} className="text-center p-2 rounded-lg bg-accent/30">
                      <p className="text-lg font-bold font-mono">{b.value}</p>
                      <p className="text-[10px] text-muted-foreground font-medium uppercase">{b.label}</p>
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" className="w-full gap-1.5"
                  onClick={() => navigate("/finance/settlements")}>
                  <Upload className="w-3.5 h-3.5" /> Upload Settlement
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payables + Expense Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Supplier Payables */}
        <Card className="border-0 shadow-sm cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate("/purchasing")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Top Supplier Payables</CardTitle>
          </CardHeader>
          <CardContent>
            {suppL ? <Skeleton className="h-[140px]" /> : (
              <div className="space-y-2">
                {(suppliers || []).length === 0 && (
                  <p className="text-sm text-muted-foreground py-4 text-center">No outstanding payables</p>
                )}
                {(suppliers || []).map((s, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-accent/30">
                    <div>
                      <p className="text-sm font-medium">{s.supplier_name}</p>
                      <p className="text-[10px] text-muted-foreground">{s.po_count} POs</p>
                    </div>
                    <p className="text-sm font-bold font-mono text-destructive">{formatBDT(s.due_amount)}</p>
                  </div>
                ))}
                <Button variant="ghost" size="sm" className="w-full text-xs gap-1">View All Payables <ArrowRight className="w-3 h-3" /></Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expense Breakdown Donut */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Expense Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {expL ? <Skeleton className="h-[200px]" /> : (
              <div className="flex items-center gap-4">
                <div className="w-[160px] h-[160px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={expenses || []} dataKey="total" nameKey="category"
                        cx="50%" cy="50%" innerRadius={40} outerRadius={65} strokeWidth={2}
                        stroke="hsl(var(--card))">
                        {(expenses || []).map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatBDT(v)} contentStyle={{ borderRadius: 12, fontSize: 12, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1.5 min-w-0 flex-1 max-h-[160px] overflow-y-auto">
                  {(expenses || []).map((e, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-xs truncate flex-1">{e.category}</span>
                      <span className="text-xs font-mono font-semibold shrink-0">{formatBDT(e.total)}</span>
                    </div>
                  ))}
                  {(!expenses || expenses.length === 0) && (
                    <p className="text-xs text-muted-foreground">No expenses this period</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cashflow Trend */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-1">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase">14-Day Cashflow</CardTitle>
        </CardHeader>
        <CardContent>
          {cfL ? <Skeleton className="h-[200px]" /> : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={cashflowData}>
                <defs>
                  <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatBDT(v)} contentStyle={{ borderRadius: 12, fontSize: 12, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Area type="monotone" dataKey="inflow" name="Inflow" stroke="hsl(var(--success))" strokeWidth={2} fill="url(#gIn)" />
                <Area type="monotone" dataKey="outflow" name="Outflow" stroke="hsl(var(--destructive))" strokeWidth={2} fill="url(#gOut)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
