import { useState, useMemo, useCallback } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { KpiCard } from "@/components/ui/kpi-card";
import { formatBDT2, formatDate, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, subMonths, subDays } from "date-fns";
import { Link } from "react-router-dom";
import {
  Truck, Download, AlertTriangle, CheckCircle2, ChevronRight,
  Package, Undo2, Clock, DollarSign, BarChart3, TrendingUp,
  ArrowUpDown, ExternalLink,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer,
  CartesianGrid, Cell, LineChart, Line, Legend,
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

// ─── Hooks ────────────────────────────────────────────────────
function useCourierPerformance(dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: ["courier-perf-report", dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("courier_performance_report", {
        p_date_from: dateFrom,
        p_date_to: dateTo,
      });
      if (error) throw error;
      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      return parsed as {
        summary: any;
        couriers: any[];
        exceptions: any[];
      };
    },
    staleTime: 60_000,
  });
}

function useCourierDrilldown(courierId: string | null, dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: ["courier-perf-drill", courierId, dateFrom, dateTo],
    queryFn: async () => {
      if (!courierId) return null;
      const { data, error } = await supabase.rpc("courier_performance_drilldown", {
        p_courier_id: courierId,
        p_date_from: dateFrom,
        p_date_to: dateTo,
      });
      if (error) throw error;
      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      return parsed as { orders: any[]; top_skus: any[]; settlements: any[] };
    },
    enabled: !!courierId,
  });
}

// ─── Helpers ──────────────────────────────────────────────────
function pct(num: number, den: number): string {
  if (den === 0) return "0.00";
  return ((num / den) * 100).toFixed(2);
}

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

const CHART_COLORS = [
  "hsl(244 100% 69%)", "hsl(160 84% 39%)", "hsl(38 92% 50%)",
  "hsl(0 84% 60%)", "hsl(200 80% 50%)", "hsl(280 70% 55%)",
  "hsl(330 70% 55%)", "hsl(170 60% 45%)",
];

// ─── Component ────────────────────────────────────────────────
export default function ReportsCourierPerformance() {
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [preset, setPreset] = useState("this-month");

  // Drilldown
  const [drillCourier, setDrillCourier] = useState<{ id: string; name: string } | null>(null);

  const { data, isLoading } = useCourierPerformance(dateFrom, dateTo);
  const { data: drillData, isLoading: drillLoading } = useCourierDrilldown(
    drillCourier?.id ?? null, dateFrom, dateTo,
  );

  const applyPreset = (key: string) => {
    setPreset(key);
    const [f, t] = PRESETS[key]();
    setDateFrom(f);
    setDateTo(t);
  };

  const summary = data?.summary || {};
  const couriers = data?.couriers || [];
  const exceptions = data?.exceptions || [];
  const excCount = exceptions.length;

  // ─── Charts ───
  const returnRateChart = useMemo(() =>
    couriers.map((c: any) => ({
      name: c.courier_name,
      rate: c.shipped > 0 ? +((c.returned / c.shipped) * 100).toFixed(2) : 0,
    })), [couriers]);

  const avgCostChart = useMemo(() =>
    couriers.map((c: any) => ({
      name: c.courier_name,
      cost: c.delivered > 0 ? +(c.total_courier_cost / c.delivered).toFixed(2) : 0,
    })), [couriers]);

  // ─── Sort ───
  type SortKey = "shipped" | "delivered" | "returned" | "total_courier_cost" | "total_net_payable" | "avg_settlement_delay_days" | "unsettled_count";
  const [sortKey, setSortKey] = useState<SortKey>("shipped");
  const [sortAsc, setSortAsc] = useState(false);

  const sortedCouriers = useMemo(() => {
    const arr = [...couriers];
    arr.sort((a, b) => {
      const av = Number(a[sortKey]) || 0;
      const bv = Number(b[sortKey]) || 0;
      return sortAsc ? av - bv : bv - av;
    });
    return arr;
  }, [couriers, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => (
    <ArrowUpDown className={cn("inline w-3 h-3 ml-1 cursor-pointer", sortKey === col && "text-primary")} onClick={() => toggleSort(col)} />
  );

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold" style={heading}>Courier Performance</h1>
          <p className="text-sm text-muted-foreground">Efficiency, cost impact & settlement speed</p>
        </div>
        <div className="flex items-center gap-2">
          {excCount > 0 && (
            <Badge variant="destructive" className="gap-1 text-xs">
              <AlertTriangle className="w-3 h-3" /> {excCount} issues
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={() => exportCSV(couriers, `courier-performance-${dateFrom}.csv`)}>
            <Download className="w-3.5 h-3.5 mr-1" /> Export
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
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <KpiCard title="Shipped" value={formatNumber(summary.total_shipped)} icon={<Package className="w-5 h-5" />} />
          <KpiCard title="Delivered" value={formatNumber(summary.total_delivered)} icon={<CheckCircle2 className="w-5 h-5" />} />
          <KpiCard title="Returned" value={formatNumber(summary.total_returned)} icon={<Undo2 className="w-5 h-5" />} />
          <KpiCard title="Success Rate" value={`${pct(summary.total_delivered || 0, summary.total_shipped || 0)}%`} icon={<TrendingUp className="w-5 h-5" />} />
          <KpiCard title="Courier Cost" value={formatBDT2(summary.grand_courier_cost)} icon={<DollarSign className="w-5 h-5" />} />
          <KpiCard title="Avg Cost/Order" value={formatBDT2(summary.avg_cost_per_order)} icon={<BarChart3 className="w-5 h-5" />} />
          <KpiCard title="Avg Settle (days)" value={`${summary.avg_settlement_delay ?? 0}`} icon={<Clock className="w-5 h-5" />} />
        </div>
      )}

      {/* Exceptions Warning */}
      {excCount > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-destructive">{excCount} Data Issues Detected</p>
              <ul className="mt-1 text-xs text-muted-foreground space-y-0.5">
                {exceptions.filter((_: any, i: number) => i < 5).map((e: any, i: number) => (
                  <li key={i}>{e.courier_name}: {e.exc_type === "no_courier_cost" ? "Delivered order with no courier cost" : "Settlement delay > 7 days"} (Order {String(e.order_id).slice(0, 8)}…)</li>
                ))}
                {excCount > 5 && <li>…and {excCount - 5} more</li>}
              </ul>
              <Link to="/exceptions" className="text-xs text-primary font-medium inline-flex items-center gap-1 mt-1">
                View in Exceptions Center <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      {!isLoading && couriers.length > 0 && (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Return Rate */}
          <Card className="border-border/50">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Return Rate by Courier</CardTitle></CardHeader>
            <CardContent className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={returnRateChart} layout="vertical" margin={{ left: 70, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} unit="%" />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={65} />
                  <RTooltip formatter={(v: any) => `${v}%`} />
                  <Bar dataKey="rate" radius={[0, 4, 4, 0]}>
                    {returnRateChart.map((_: any, i: number) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Avg Cost */}
          <Card className="border-border/50">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Avg Courier Cost per Delivered Order</CardTitle></CardHeader>
            <CardContent className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={avgCostChart} layout="vertical" margin={{ left: 70, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={65} />
                  <RTooltip formatter={(v: any) => formatBDT2(v)} />
                  <Bar dataKey="cost" radius={[0, 4, 4, 0]}>
                    {avgCostChart.map((_: any, i: number) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Grid */}
      {isLoading ? <Skeleton className="h-[400px]" /> : (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base" style={heading}>Courier Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Courier</TableHead>
                    <TableHead className="text-xs text-right">Shipped <SortIcon col="shipped" /></TableHead>
                    <TableHead className="text-xs text-right">Delivered <SortIcon col="delivered" /></TableHead>
                    <TableHead className="text-xs text-right">Returned <SortIcon col="returned" /></TableHead>
                    <TableHead className="text-xs text-right">Partial</TableHead>
                    <TableHead className="text-xs text-right">Success %</TableHead>
                    <TableHead className="text-xs text-right">Return %</TableHead>
                    <TableHead className="text-xs text-right">Total Cost <SortIcon col="total_courier_cost" /></TableHead>
                    <TableHead className="text-xs text-right">Avg Del. Fee</TableHead>
                    <TableHead className="text-xs text-right">Avg COD</TableHead>
                    <TableHead className="text-xs text-right">Discount</TableHead>
                    <TableHead className="text-xs text-right">Compensation</TableHead>
                    <TableHead className="text-xs text-right">Net Payable <SortIcon col="total_net_payable" /></TableHead>
                    <TableHead className="text-xs text-right">Settle Delay <SortIcon col="avg_settlement_delay_days" /></TableHead>
                    <TableHead className="text-xs text-right">Unsettled <SortIcon col="unsettled_count" /></TableHead>
                    <TableHead className="text-xs text-right">Revenue</TableHead>
                    <TableHead className="text-xs w-8"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedCouriers.length === 0 && (
                    <TableRow><TableCell colSpan={17} className="text-center text-muted-foreground py-8">No data for period</TableCell></TableRow>
                  )}
                  {sortedCouriers.map((c: any) => (
                    <TableRow key={c.courier_id} className="cursor-pointer" onClick={() => setDrillCourier({ id: c.courier_id, name: c.courier_name })}>
                      <TableCell className="text-xs font-medium">
                        <div className="flex items-center gap-2">
                          <Truck className="w-3.5 h-3.5 text-muted-foreground" />
                          {c.courier_name}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-right" style={mono}>{c.shipped}</TableCell>
                      <TableCell className="text-xs text-right" style={mono}>{c.delivered}</TableCell>
                      <TableCell className="text-xs text-right text-destructive" style={mono}>{c.returned}</TableCell>
                      <TableCell className="text-xs text-right" style={mono}>{c.partial_delivered}</TableCell>
                      <TableCell className="text-xs text-right">
                        <Badge variant="outline" className={cn("text-[10px] font-mono",
                          +pct(c.delivered, c.shipped) >= 80 ? "bg-success/10 text-success" :
                          +pct(c.delivered, c.shipped) >= 60 ? "bg-warning/10 text-warning" :
                          "bg-destructive/10 text-destructive"
                        )}>
                          {pct(c.delivered, c.shipped)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-right text-destructive" style={mono}>{pct(c.returned, c.shipped)}%</TableCell>
                      <TableCell className="text-xs text-right" style={mono}>{formatBDT2(c.total_courier_cost)}</TableCell>
                      <TableCell className="text-xs text-right" style={mono}>{formatBDT2(c.avg_delivery_charge)}</TableCell>
                      <TableCell className="text-xs text-right" style={mono}>{formatBDT2(c.avg_cod_fee)}</TableCell>
                      <TableCell className="text-xs text-right text-success" style={mono}>{formatBDT2(c.total_discount)}</TableCell>
                      <TableCell className="text-xs text-right" style={mono}>{formatBDT2(c.total_compensation)}</TableCell>
                      <TableCell className="text-xs text-right font-semibold text-primary" style={mono}>{formatBDT2(c.total_net_payable)}</TableCell>
                      <TableCell className="text-xs text-right" style={mono}>
                        <Badge variant="outline" className={cn("text-[10px] font-mono",
                          +c.avg_settlement_delay_days > 7 ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"
                        )}>
                          {c.avg_settlement_delay_days}d
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-right" style={mono}>
                        {c.unsettled_count > 0 ? (
                          <Badge variant="destructive" className="text-[10px]">{c.unsettled_count}</Badge>
                        ) : (
                          <span className="text-success">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-right" style={mono}>{formatBDT2(c.total_revenue)}</TableCell>
                      <TableCell><ChevronRight className="w-3.5 h-3.5 text-muted-foreground" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                {sortedCouriers.length > 1 && (
                  <TableFooter>
                    <TableRow className="font-semibold">
                      <TableCell className="text-xs">TOTAL</TableCell>
                      <TableCell className="text-xs text-right" style={mono}>{summary.total_shipped}</TableCell>
                      <TableCell className="text-xs text-right" style={mono}>{summary.total_delivered}</TableCell>
                      <TableCell className="text-xs text-right" style={mono}>{summary.total_returned}</TableCell>
                      <TableCell className="text-xs text-right" style={mono}>-</TableCell>
                      <TableCell className="text-xs text-right" style={mono}>{pct(summary.total_delivered, summary.total_shipped)}%</TableCell>
                      <TableCell className="text-xs text-right" style={mono}>{pct(summary.total_returned, summary.total_shipped)}%</TableCell>
                      <TableCell className="text-xs text-right" style={mono}>{formatBDT2(summary.grand_courier_cost)}</TableCell>
                      <TableCell className="text-xs text-right" style={mono}>-</TableCell>
                      <TableCell className="text-xs text-right" style={mono}>-</TableCell>
                      <TableCell className="text-xs text-right" style={mono}>-</TableCell>
                      <TableCell className="text-xs text-right" style={mono}>-</TableCell>
                      <TableCell className="text-xs text-right font-semibold text-primary" style={mono}>{formatBDT2(summary.grand_net_payable)}</TableCell>
                      <TableCell className="text-xs text-right" style={mono}>{summary.avg_settlement_delay}d</TableCell>
                      <TableCell className="text-xs text-right" style={mono}>{summary.total_unsettled}</TableCell>
                      <TableCell className="text-xs text-right" style={mono}>{formatBDT2(summary.grand_revenue)}</TableCell>
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
      <Sheet open={!!drillCourier} onOpenChange={(o) => !o && setDrillCourier(null)}>
        <SheetContent side="right" className="sm:max-w-2xl w-full overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5" /> {drillCourier?.name} — Detail
            </SheetTitle>
          </SheetHeader>

          {drillLoading ? <Skeleton className="h-60 mt-4" /> : drillData && (
            <div className="space-y-5 mt-4">
              {/* Top SKUs */}
              {drillData.top_skus.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Top 10 SKUs Shipped</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">SKU</TableHead>
                        <TableHead className="text-xs">Product</TableHead>
                        <TableHead className="text-xs text-right">Orders</TableHead>
                        <TableHead className="text-xs text-right">Units</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {drillData.top_skus.map((s: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs font-mono">{s.sku}</TableCell>
                          <TableCell className="text-xs">{s.product_name}</TableCell>
                          <TableCell className="text-xs text-right" style={mono}>{s.order_count}</TableCell>
                          <TableCell className="text-xs text-right" style={mono}>{s.units}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Settlement Batches */}
              {drillData.settlements.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Settlement Batches</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Ref</TableHead>
                        <TableHead className="text-xs">Date</TableHead>
                        <TableHead className="text-xs text-right">Amount</TableHead>
                        <TableHead className="text-xs">Journal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {drillData.settlements.map((s: any) => (
                        <TableRow key={s.id}>
                          <TableCell className="text-xs font-mono">{s.settlement_ref || "-"}</TableCell>
                          <TableCell className="text-xs">{formatDate(s.settlement_date)}</TableCell>
                          <TableCell className="text-xs text-right" style={mono}>{formatBDT2(s.amount_received)}</TableCell>
                          <TableCell className="text-xs">
                            <Badge variant="outline" className="text-[10px]">{s.journal_status || "none"}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Orders List */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold">Orders ({drillData.orders.length})</h3>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => exportCSV(drillData.orders, `courier-${drillCourier?.name}-orders.csv`)}>
                    <Download className="w-3 h-3 mr-1" /> CSV
                  </Button>
                </div>
                <div className="max-h-[350px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Tracking</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs text-right">Customer Total</TableHead>
                        <TableHead className="text-xs text-right">Cost</TableHead>
                        <TableHead className="text-xs text-right">Net Payable</TableHead>
                        <TableHead className="text-xs">Delivered</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {drillData.orders.map((o: any) => (
                        <TableRow key={o.id}>
                          <TableCell className="text-xs font-mono">{o.tracking_id || "-"}</TableCell>
                          <TableCell className="text-xs">
                            <Badge variant="outline" className={cn("text-[10px]",
                              o.booking_status === "delivered" ? "bg-success/10 text-success" :
                              o.booking_status === "returned" ? "bg-destructive/10 text-destructive" : ""
                            )}>
                              {o.booking_status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-right" style={mono}>{formatBDT2(o.customer_total_amount)}</TableCell>
                          <TableCell className="text-xs text-right" style={mono}>{formatBDT2(o.courier_total_cost)}</TableCell>
                          <TableCell className="text-xs text-right font-semibold" style={mono}>{formatBDT2(o.courier_net_payable)}</TableCell>
                          <TableCell className="text-xs">{o.delivered_at ? formatDate(o.delivered_at) : "-"}</TableCell>
                        </TableRow>
                      ))}
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
