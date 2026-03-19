import { useMemo, memo } from "react";
import { useNavigate } from "react-router-dom";
import { formatBDT, formatNumber } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFinKpis, useSettlementAging, useSupplierPayablesSnapshot, useExpenseBreakdown, useCashflowTrend } from "@/hooks/use-fin-dashboard";
import { useExecFinance } from "@/hooks/use-exec-dashboard";
import { KpiCard } from "./DashboardShared";
import {
  Wallet, CreditCard, Landmark, Smartphone, Banknote, Receipt,
  Upload, ArrowRight, AlertTriangle,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { cn } from "@/lib/utils";

interface Props { from: string; to: string; }

export const FinanceMode = memo(function FinanceMode({ from, to }: Props) {
  const navigate = useNavigate();
  const { data: kpis, isLoading: kpiL } = useFinKpis(from, to);
  const { data: finance, isLoading: finL } = useExecFinance();
  const { data: aging, isLoading: agingL } = useSettlementAging();
  const { data: suppliers, isLoading: suppL } = useSupplierPayablesSnapshot();
  const { data: expenses, isLoading: expL } = useExpenseBreakdown(from, to);
  const { data: cashflow, isLoading: cfL } = useCashflowTrend(7);

  const cashflowData = useMemo(() =>
    (cashflow || []).map((d) => ({
      ...d,
      label: new Date(d.day).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
    })), [cashflow]);

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Receivable (Unsettled COD)"
          value={formatBDT(kpis?.courier_receivable)}
          icon={CreditCard}
          color="bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]"
          sub="Money owed by couriers"
          onClick={() => navigate("/courier-cod")}
          loading={kpiL}
        />
        <KpiCard
          label="Total Payable (Suppliers)"
          value={formatBDT(kpis?.supplier_payables)}
          icon={Landmark}
          color="bg-destructive/10 text-destructive"
          sub="Outstanding supplier dues"
          onClick={() => navigate("/purchasing")}
          loading={kpiL}
        />
        <KpiCard
          label="This Month Expenses"
          value={formatBDT(kpis?.period_expenses)}
          icon={Receipt}
          color="bg-primary/10 text-primary"
          onClick={() => navigate("/expenses")}
          loading={kpiL}
        />
        <KpiCard
          label="Posting Queue"
          value={formatNumber(kpis?.unposted_events)}
          icon={AlertTriangle}
          color={(kpis?.unposted_events ?? 0) > 0 ? "bg-destructive/10 text-destructive" : "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]"}
          sub={(kpis?.unposted_events ?? 0) > 0 ? "Events awaiting posting" : "All caught up!"}
          onClick={() => navigate("/finance/posting-queue")}
          loading={kpiL}
        />
      </section>

      {/* Account Balances */}
      <Card className="border-border rounded-xl">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Cash & Bank Balances
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"
            onClick={() => navigate("/finance/accounts")}>
            All Accounts <ArrowRight className="w-3 h-3" />
          </Button>
        </CardHeader>
        <CardContent>
          {finL ? <Skeleton className="h-[80px]" /> : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { label: "Cash", value: finance?.cash, icon: Banknote, color: "bg-[hsl(var(--success))]/10" },
                { label: "Bank", value: finance?.bank, icon: Landmark, color: "bg-primary/10" },
                { label: "bKash", value: finance?.bkash, icon: Smartphone, color: "bg-pink-500/10" },
                { label: "Nagad", value: finance?.nagad, icon: Smartphone, color: "bg-orange-500/10" },
                { label: "Total Liquid", value: finance?.total_liquid, icon: Wallet, color: "bg-[hsl(var(--info))]/10" },
              ].map((a) => (
                <div key={a.label} className={cn("flex items-center gap-2.5 p-3 rounded-xl border border-border", a.label === "Total Liquid" && "col-span-2 md:col-span-1 bg-primary/5")}>
                  <a.icon className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{a.label}</p>
                    <p className={cn("text-base font-bold tabular-nums", a.label === "Total Liquid" && "text-primary")}>{formatBDT(a.value)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Aging Tables Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Courier Settlement Aging */}
        <Card className="border-border rounded-xl">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Courier Settlement Aging
            </CardTitle>
            {aging && aging.total_unsettled_count > 0 && (
              <Badge variant="destructive" className="text-[10px] h-5 px-1.5 rounded-full">{aging.total_unsettled_count}</Badge>
            )}
          </CardHeader>
          <CardContent>
            {agingL ? <Skeleton className="h-[120px]" /> : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Unsettled Total</span>
                  <span className="text-lg font-bold tabular-nums text-[hsl(var(--warning))]">{formatBDT(aging?.total_unsettled_amount)}</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "0-3d", value: aging?.bucket_0_3 ?? 0, severity: "default" },
                    { label: "4-7d", value: aging?.bucket_4_7 ?? 0, severity: "default" },
                    { label: "8-15d", value: aging?.bucket_8_15 ?? 0, severity: "warning" },
                    { label: "15d+", value: aging?.bucket_15_plus ?? 0, severity: "danger" },
                  ].map((b) => (
                    <div key={b.label} className={cn("text-center p-2.5 rounded-xl border",
                      b.severity === "danger" ? "border-destructive/30 bg-destructive/5" :
                      b.severity === "warning" ? "border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning))]/5" :
                      "border-border bg-accent/30"
                    )}>
                      <p className="text-lg font-bold tabular-nums">{b.value}</p>
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase">{b.label}</p>
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" className="w-full gap-1.5"
                  onClick={() => navigate("/courier-cod")}>
                  <Upload className="w-3.5 h-3.5" /> Manage Settlements
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Supplier Payable Aging */}
        <Card className="border-border rounded-xl">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Supplier Payable Aging
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"
              onClick={() => navigate("/purchasing")}>
              View All <ArrowRight className="w-3 h-3" />
            </Button>
          </CardHeader>
          <CardContent>
            {suppL ? <Skeleton className="h-[120px]" /> : (
              <div className="space-y-1.5">
                {(suppliers || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">No outstanding payables</p>
                ) : (suppliers || []).map((s, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-accent/30">
                    <div>
                      <p className="text-sm font-medium">{s.supplier_name}</p>
                      <p className="text-[10px] text-muted-foreground">{s.po_count} POs outstanding</p>
                    </div>
                    <p className="text-sm font-bold tabular-nums text-destructive">{formatBDT(s.due_amount)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cash Flow Mini Chart */}
      <Card className="border-border rounded-xl">
        <CardHeader className="pb-1">
          <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            7-Day Cash Flow
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cfL ? <Skeleton className="h-[200px] rounded-xl" /> : cashflowData.length === 0 ? (
            <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">No cashflow data</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={cashflowData} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v: number, name: string) => [formatBDT(v), name === "inflow" ? "Money In" : "Money Out"]}
                  contentStyle={{ borderRadius: 12, fontSize: 12, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                />
                <Legend formatter={(v) => v === "inflow" ? "💰 Money In" : "💸 Money Out"} />
                <Bar dataKey="inflow" name="inflow" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="outflow" name="outflow" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
});
