import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBDT } from "@/lib/format";
import {
  useReportPeriod, useReportKPIs, useReportDailyChart,
  useProductPerformance, useCourierPerformance, useExpenseBreakdownReport,
} from "@/hooks/use-reports";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import {
  ShoppingCart, TrendingUp, TrendingDown, DollarSign, RotateCcw, Package,
  ArrowUpRight, ArrowDownRight, Minus, Truck, BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

const heading: React.CSSProperties = { fontFamily: "'Playfair Display', serif" };
const mono: React.CSSProperties = { fontFamily: "'DM Mono', monospace" };

const PIE_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

const CATEGORY_LABELS: Record<string, string> = {
  meta_ads: "Meta Ads", meta_ads_unassigned: "Meta Ads (Unassigned)",
  salary: "Salary", rent: "Rent", courier_charge: "Courier",
  influencer: "Influencer", packaging: "Packaging", video: "Video",
  office: "Office", other: "Other", facebook_ads: "Facebook Ads",
  product_cost: "Product Cost", shipping: "Shipping",
};

function TrendBadge({ value, suffix = "%" }: { value: number; suffix?: string }) {
  if (value === 0) return <span className="text-xs text-muted-foreground flex items-center gap-0.5"><Minus className="w-3 h-3" />0{suffix}</span>;
  const up = value > 0;
  return (
    <span className={cn("text-xs font-medium flex items-center gap-0.5", up ? "text-emerald-600" : "text-red-500")}>
      {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {up ? "+" : ""}{value}{suffix}
    </span>
  );
}

function KPICard({ title, value, change, icon: Icon, prefix = "", loading }: {
  title: string; value: string | number; change: number; icon: React.ElementType; prefix?: string; loading?: boolean;
}) {
  return (
    <Card className="border-border/50 hover:shadow-md transition-shadow">
      <CardContent className="pt-5 pb-4 px-5">
        {loading ? <Skeleton className="h-20" /> : (
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
              <p className="text-2xl font-bold" style={mono}>{prefix}{typeof value === "number" ? value.toLocaleString() : value}</p>
              <TrendBadge value={change} />
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Icon className="w-5 h-5 text-primary" />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MarginBadge({ margin }: { margin: number }) {
  const color = margin >= 55 ? "bg-emerald-100 text-emerald-800" : margin >= 40 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800";
  return <Badge variant="outline" className={cn("text-xs font-mono", color)}>{margin}%</Badge>;
}

export default function ReportsPage() {
  const { months, selectedIndex, setSelectedIndex, current, prev } = useReportPeriod();
  const { data: kpis, isLoading: kpiLoading } = useReportKPIs(current, prev);
  const { data: chartData, isLoading: chartLoading } = useReportDailyChart(current);
  const { data: products, isLoading: prodLoading } = useProductPerformance(current);
  const { data: couriers, isLoading: courierLoading } = useCourierPerformance(current);
  const { data: expBreakdown } = useExpenseBreakdownReport(current);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={heading}>Monthly Reports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Comprehensive business analytics & P&L</p>
        </div>
      </header>

      {/* Month Selector Pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {months.map((m, i) => (
          <button
            key={i}
            onClick={() => setSelectedIndex(i)}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
              i === selectedIndex
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-card text-muted-foreground hover:bg-accent border border-border/50"
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KPICard title="Total Orders" value={kpis?.totalOrders ?? 0} change={kpis?.ordersChange ?? 0} icon={ShoppingCart} loading={kpiLoading} />
        <KPICard title="Revenue" value={formatBDT(kpis?.revenue ?? 0)} change={kpis?.revenueChange ?? 0} icon={TrendingUp} loading={kpiLoading} />
        <KPICard title="Gross Profit" value={formatBDT(kpis?.profit ?? 0)} change={kpis?.profitChange ?? 0} icon={DollarSign} loading={kpiLoading} />
        <KPICard title="Expenses" value={formatBDT(kpis?.totalExpenses ?? 0)} change={kpis?.expensesChange ?? 0} icon={TrendingDown} loading={kpiLoading} />
        <KPICard title="Return Rate" value={`${kpis?.returnRate ?? 0}%`} change={kpis?.returnRateChange ?? 0} icon={RotateCcw} loading={kpiLoading} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-card border border-border/50">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pnl">P&L Statement</TabsTrigger>
          <TabsTrigger value="products">Product Performance</TabsTrigger>
          <TabsTrigger value="courier">Courier Analysis</TabsTrigger>
        </TabsList>

        {/* ── Overview Tab ── */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Daily Revenue vs Profit Chart */}
            <Card className="lg:col-span-2 border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold" style={heading}>Daily Revenue vs Profit</CardTitle>
              </CardHeader>
              <CardContent>
                {chartLoading ? <Skeleton className="h-[280px]" /> : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={chartData || []} barGap={2}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(8)} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        formatter={(v: number) => formatBDT(v)}
                        labelFormatter={(l) => `Date: ${l}`}
                        contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid hsl(var(--border))" }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="profit" name="Profit" fill="hsl(var(--success))" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Order Status Breakdown */}
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold" style={heading}>Order Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {kpiLoading ? <Skeleton className="h-[200px]" /> : (
                  <>
                    {[
                      { label: "Delivered", value: kpis?.deliveredCount ?? 0, color: "bg-emerald-500" },
                      { label: "Returned", value: kpis?.returnedCount ?? 0, color: "bg-red-500" },
                      { label: "Cancelled", value: kpis?.cancelledCount ?? 0, color: "bg-muted-foreground" },
                    ].map(s => {
                      const total = kpis?.totalOrders || 1;
                      const pct = Math.round((s.value / total) * 100);
                      return (
                        <div key={s.label} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{s.label}</span>
                            <span className="font-medium" style={mono}>{s.value} <span className="text-muted-foreground text-xs">({pct}%)</span></span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div className={cn("h-full rounded-full transition-all", s.color)} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                    <div className="pt-3 border-t border-border/50 flex justify-between text-sm">
                      <span className="text-muted-foreground">Profit Margin</span>
                      <span className="font-bold" style={mono}>{kpis?.profitMargin ?? 0}%</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Expense Pie */}
          {expBreakdown && expBreakdown.length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold" style={heading}>Expense Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <ResponsiveContainer width={220} height={220}>
                    <PieChart>
                      <Pie data={expBreakdown} dataKey="total" nameKey="category" cx="50%" cy="50%" outerRadius={90} innerRadius={50} paddingAngle={2}>
                        {expBreakdown.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatBDT(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-x-6 gap-y-2">
                    {expBreakdown.map((e, i) => (
                      <div key={e.category} className="flex items-center gap-2 text-sm">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-muted-foreground">{CATEGORY_LABELS[e.category] || e.category}</span>
                        <span className="font-medium" style={mono}>{formatBDT(e.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── P&L Statement Tab ── */}
        <TabsContent value="pnl" className="space-y-4">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle style={heading}>Profit & Loss Statement — {current.label}</CardTitle>
            </CardHeader>
            <CardContent>
              {kpiLoading ? <Skeleton className="h-[300px]" /> : (
                <div className="space-y-1 max-w-2xl">
                  {/* Revenue */}
                  <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg px-4 py-2 font-semibold text-emerald-800 dark:text-emerald-300 text-sm flex justify-between">
                    <span>REVENUE</span><span>Amount</span>
                  </div>
                  <PnlRow label="Gross Revenue (Delivered)" amount={kpis?.revenue ?? 0} />
                  <PnlSubtotal label="Total Revenue" amount={kpis?.revenue ?? 0} className="text-emerald-700 dark:text-emerald-400" />

                  {/* COGS */}
                  <div className="bg-orange-50 dark:bg-orange-950/30 rounded-lg px-4 py-2 font-semibold text-orange-800 dark:text-orange-300 text-sm flex justify-between mt-4">
                    <span>COST OF GOODS SOLD</span><span>Amount</span>
                  </div>
                  <PnlRow label="Product COGS" amount={kpis?.cogs ?? 0} negative />
                  <PnlSubtotal label="Gross Profit" amount={kpis?.profit ?? 0} className={(kpis?.profit ?? 0) >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600"} />

                  {/* Expenses */}
                  <div className="bg-red-50 dark:bg-red-950/30 rounded-lg px-4 py-2 font-semibold text-red-800 dark:text-red-300 text-sm flex justify-between mt-4">
                    <span>OPERATING EXPENSES</span><span>Amount</span>
                  </div>
                  {(expBreakdown || []).map(e => (
                    <PnlRow key={e.category} label={CATEGORY_LABELS[e.category] || e.category} amount={e.total} negative />
                  ))}
                  {(!expBreakdown || expBreakdown.length === 0) && (
                    <div className="px-4 py-2 text-sm text-muted-foreground">No expenses recorded</div>
                  )}
                  <PnlSubtotal label="Total Expenses" amount={kpis?.totalExpenses ?? 0} className="text-red-700 dark:text-red-400" />

                  {/* Net Profit */}
                  <div className="flex justify-between px-4 py-3 mt-4 rounded-xl bg-foreground text-background font-bold text-base">
                    <span style={heading}>NET PROFIT</span>
                    <span
                      className={cn((kpis?.profit ?? 0) - (kpis?.totalExpenses ?? 0) >= 0 ? "text-emerald-400" : "text-red-400")}
                      style={mono}
                    >
                      {formatBDT((kpis?.profit ?? 0) - (kpis?.totalExpenses ?? 0))}
                    </span>
                  </div>
                  <div className="text-center text-sm text-muted-foreground mt-1">
                    Net Margin: <span className="font-semibold" style={mono}>
                      {(kpis?.revenue ?? 0) > 0
                        ? Math.round((((kpis?.profit ?? 0) - (kpis?.totalExpenses ?? 0)) / (kpis?.revenue ?? 1)) * 100)
                        : 0}%
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Product Performance Tab ── */}
        <TabsContent value="products" className="space-y-4">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-sm font-semibold" style={heading}>Product Performance — {current.label}</CardTitle>
            </CardHeader>
            <CardContent>
              {prodLoading ? <Skeleton className="h-[300px]" /> : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]">#</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Qty Sold</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">COGS</TableHead>
                        <TableHead className="text-right">Profit</TableHead>
                        <TableHead className="text-right">Unit Profit</TableHead>
                        <TableHead className="text-right">Margin</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(products || []).length === 0 && (
                        <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No delivered orders in this period</TableCell></TableRow>
                      )}
                      {(products || []).map((p, i) => (
                        <TableRow key={p.product_id} className="group">
                          <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              {p.image_url ? (
                                <img src={p.image_url} alt="" className="w-8 h-8 rounded-lg object-cover border border-border/50" />
                              ) : (
                                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center"><Package className="w-4 h-4 text-muted-foreground" /></div>
                              )}
                              <div>
                                <p className="font-medium text-sm">{p.name}</p>
                                <p className="text-xs text-muted-foreground">{p.sku}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium" style={mono}>{p.qty}</TableCell>
                          <TableCell className="text-right" style={mono}>{formatBDT(p.revenue)}</TableCell>
                          <TableCell className="text-right text-muted-foreground" style={mono}>{formatBDT(p.cogs)}</TableCell>
                          <TableCell className="text-right font-medium" style={mono}>{formatBDT(p.profit)}</TableCell>
                          <TableCell className="text-right" style={mono}>{formatBDT(p.unitProfit)}</TableCell>
                          <TableCell className="text-right"><MarginBadge margin={p.margin} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Courier Analysis Tab ── */}
        <TabsContent value="courier" className="space-y-4">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-sm font-semibold" style={heading}>Courier Success Rate — {current.label}</CardTitle>
            </CardHeader>
            <CardContent>
              {courierLoading ? <Skeleton className="h-[200px]" /> : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Courier</TableHead>
                        <TableHead className="text-right">Total Shipments</TableHead>
                        <TableHead className="text-right">Delivered</TableHead>
                        <TableHead className="text-right">Returned</TableHead>
                        <TableHead className="text-right">Failed</TableHead>
                        <TableHead className="text-right">Success Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(couriers || []).length === 0 && (
                        <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No courier data in this period</TableCell></TableRow>
                      )}
                      {(couriers || []).map(c => (
                        <TableRow key={c.name}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Truck className="w-4 h-4 text-muted-foreground" />
                              <span className="font-medium">{c.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right" style={mono}>{c.total}</TableCell>
                          <TableCell className="text-right text-emerald-600" style={mono}>{c.delivered}</TableCell>
                          <TableCell className="text-right text-red-500" style={mono}>{c.returned}</TableCell>
                          <TableCell className="text-right text-amber-500" style={mono}>{c.failed}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline" className={cn(
                              "font-mono text-xs",
                              c.successRate >= 80 ? "bg-emerald-100 text-emerald-800" :
                              c.successRate >= 60 ? "bg-amber-100 text-amber-800" :
                              "bg-red-100 text-red-800"
                            )}>
                              {c.successRate}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── P&L Helper Components ──

function PnlRow({ label, amount, negative }: { label: string; amount: number; negative?: boolean }) {
  return (
    <div className="flex justify-between px-4 py-2 text-sm border-b border-border/30">
      <span>{label}</span>
      <span className={cn(negative ? "text-red-600 dark:text-red-400" : "")} style={mono}>
        {negative ? "-" : ""}{formatBDT(Math.abs(amount))}
      </span>
    </div>
  );
}

function PnlSubtotal({ label, amount, className }: { label: string; amount: number; className?: string }) {
  return (
    <div className="flex justify-between px-4 py-2 text-sm font-bold bg-muted/50 rounded">
      <span>{label}</span>
      <span className={className} style={mono}>{formatBDT(amount)}</span>
    </div>
  );
}
