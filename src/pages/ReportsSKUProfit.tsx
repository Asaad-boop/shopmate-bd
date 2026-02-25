import { useState } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatBDT, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, subMonths, subDays } from "date-fns";
import {
  Package, Download, TrendingUp, TrendingDown, ArrowUpRight,
  ArrowDownRight, Search, ChevronRight, Undo2, X,
} from "lucide-react";

const heading: React.CSSProperties = { fontFamily: "'Playfair Display', serif" };
const mono: React.CSSProperties = { fontFamily: "'DM Mono', monospace" };

const PRESETS: Record<string, () => [string, string]> = {
  "this-month": () => [format(startOfMonth(new Date()), "yyyy-MM-dd"), format(endOfMonth(new Date()), "yyyy-MM-dd")],
  "last-month": () => [format(startOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd"), format(endOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd")],
  "last-30": () => [format(subDays(new Date(), 29), "yyyy-MM-dd"), format(new Date(), "yyyy-MM-dd")],
  "last-90": () => [format(subDays(new Date(), 89), "yyyy-MM-dd"), format(new Date(), "yyyy-MM-dd")],
  "last-7": () => [format(subDays(new Date(), 6), "yyyy-MM-dd"), format(new Date(), "yyyy-MM-dd")],
};

function useSKUReport(dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: ["sku-profitability-report", dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("sku_profitability_report", {
        p_date_from: dateFrom,
        p_date_to: dateTo,
      });
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}

function useSKUDrilldown(productId: string | null, dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: ["sku-drilldown", productId, dateFrom, dateTo],
    queryFn: async () => {
      if (!productId) return [];
      const { data, error } = await supabase.rpc("sku_order_drilldown", {
        p_product_id: productId,
        p_date_from: dateFrom,
        p_date_to: dateTo,
      });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!productId,
  });
}

type SortKey = "revenue" | "net_profit" | "qty_sold" | "margin" | "cogs";

export default function ReportsSKUProfit() {
  const [preset, setPreset] = useState("this-month");
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("revenue");
  const [selectedSKU, setSelectedSKU] = useState<any>(null);

  const { data: skus, isLoading } = useSKUReport(dateFrom, dateTo);
  const { data: drilldown, isLoading: drillLoading } = useSKUDrilldown(
    selectedSKU?.product_id, dateFrom, dateTo
  );

  const handlePreset = (v: string) => {
    setPreset(v);
    if (PRESETS[v]) {
      const [f, t] = PRESETS[v]();
      setDateFrom(f);
      setDateTo(t);
    }
  };

  const filtered = (skus || [])
    .filter((s: any) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return s.sku?.toLowerCase().includes(q) || s.name?.toLowerCase().includes(q);
    })
    .sort((a: any, b: any) => {
      if (sortBy === "margin") {
        const mA = a.revenue > 0 ? a.net_profit / a.revenue : 0;
        const mB = b.revenue > 0 ? b.net_profit / b.revenue : 0;
        return mB - mA;
      }
      return (b[sortBy] || 0) - (a[sortBy] || 0);
    });

  // Totals
  const totals = filtered.reduce(
    (t: any, s: any) => ({
      qty_sold: t.qty_sold + s.qty_sold,
      revenue: t.revenue + s.revenue,
      cogs: t.cogs + s.cogs,
      courier_cost: t.courier_cost + s.courier_cost,
      meta_ads_cost: t.meta_ads_cost + s.meta_ads_cost,
      allocated_cost: t.allocated_cost + s.allocated_cost,
      return_cogs: t.return_cogs + s.return_cogs,
      net_profit: t.net_profit + s.net_profit,
    }),
    { qty_sold: 0, revenue: 0, cogs: 0, courier_cost: 0, meta_ads_cost: 0, allocated_cost: 0, return_cogs: 0, net_profit: 0 }
  );

  const handleExportCSV = () => {
    const rows: string[][] = [
      ["SKU Profitability Report"],
      [`Period: ${dateFrom} to ${dateTo}`],
      [],
      ["SKU", "Product", "Qty Sold", "Revenue", "COGS", "Gross Profit", "Courier", "Meta Ads", "Allocations", "Return Loss", "Net Profit", "Margin %"],
      ...filtered.map((s: any) => [
        s.sku, s.name, String(s.qty_sold), String(s.revenue), String(s.cogs),
        String(s.gross_profit), String(s.courier_cost), String(s.meta_ads_cost),
        String(s.allocated_cost), String(s.return_cogs), String(s.net_profit),
        s.revenue > 0 ? `${Math.round((s.net_profit / s.revenue) * 100)}%` : "0%",
      ]),
      [],
      ["TOTALS", "", String(totals.qty_sold), String(totals.revenue), String(totals.cogs),
        String(totals.revenue - totals.cogs), String(totals.courier_cost), String(totals.meta_ads_cost),
        String(totals.allocated_cost), String(totals.return_cogs), String(totals.net_profit),
        totals.revenue > 0 ? `${Math.round((totals.net_profit / totals.revenue) * 100)}%` : "0%",
      ],
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SKU_Profitability_${dateFrom}_${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto animate-fade-in">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Package className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={heading}>SKU Profitability</h1>
            <p className="text-sm text-muted-foreground">Per-product net profit after all cost attributions</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!skus?.length}>
          <Download className="w-4 h-4 mr-1" /> Export CSV
        </Button>
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
              <Label className="text-xs">Sort by</Label>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
                <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="revenue">Revenue</SelectItem>
                  <SelectItem value="net_profit">Net Profit</SelectItem>
                  <SelectItem value="qty_sold">Qty Sold</SelectItem>
                  <SelectItem value="margin">Margin %</SelectItem>
                  <SelectItem value="cogs">COGS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="relative ml-auto">
              <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground" />
              <Input placeholder="Search SKU..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 w-[200px] h-8 text-xs" />
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Skeleton className="h-[500px]" />
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <MiniKPI label="Total Revenue" value={totals.revenue} color="text-primary" />
            <MiniKPI label="Total COGS" value={totals.cogs} color="text-muted-foreground" />
            <MiniKPI label="Courier Cost" value={totals.courier_cost} color="text-muted-foreground" />
            <MiniKPI label="Meta Ads" value={totals.meta_ads_cost} color="text-muted-foreground" />
            <MiniKPI label="Net Profit" value={totals.net_profit} color={totals.net_profit >= 0 ? "text-emerald-600" : "text-destructive"} />
          </div>

          {/* Table */}
          <Card className="border-border/50">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card z-10">
                    <tr className="border-b border-border text-muted-foreground text-xs">
                      <th className="text-left py-2.5 px-3 font-medium">Product</th>
                      <th className="text-right py-2.5 px-2 font-medium">Qty</th>
                      <th className="text-right py-2.5 px-2 font-medium">Revenue</th>
                      <th className="text-right py-2.5 px-2 font-medium">COGS</th>
                      <th className="text-right py-2.5 px-2 font-medium">Gross</th>
                      <th className="text-right py-2.5 px-2 font-medium">Courier</th>
                      <th className="text-right py-2.5 px-2 font-medium">Meta Ads</th>
                      <th className="text-right py-2.5 px-2 font-medium">Alloc.</th>
                      <th className="text-right py-2.5 px-2 font-medium">Returns</th>
                      <th className="text-right py-2.5 px-2 font-medium">Net Profit</th>
                      <th className="text-right py-2.5 px-2 font-medium">Margin</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s: any) => {
                      const margin = s.revenue > 0 ? Math.round((s.net_profit / s.revenue) * 100) : 0;
                      return (
                        <tr
                          key={s.product_id}
                          className="border-b border-border/30 hover:bg-muted/30 cursor-pointer transition-colors"
                          onClick={() => setSelectedSKU(s)}
                        >
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              {s.image_url ? (
                                <img src={s.image_url} alt="" className="w-7 h-7 rounded object-cover" />
                              ) : (
                                <div className="w-7 h-7 rounded bg-muted flex items-center justify-center">
                                  <Package className="w-3.5 h-3.5 text-muted-foreground" />
                                </div>
                              )}
                              <div>
                                <p className="font-medium text-xs leading-tight">{s.name}</p>
                                <p className="text-[10px] text-muted-foreground">{s.sku}</p>
                              </div>
                            </div>
                          </td>
                          <td className="text-right py-2 px-2" style={mono}>{s.qty_sold}</td>
                          <td className="text-right py-2 px-2" style={mono}>{formatBDT(s.revenue)}</td>
                          <td className="text-right py-2 px-2 text-muted-foreground" style={mono}>{formatBDT(s.cogs)}</td>
                          <td className="text-right py-2 px-2" style={mono}>
                            <span className={s.gross_profit >= 0 ? "text-emerald-600" : "text-destructive"}>
                              {formatBDT(s.gross_profit)}
                            </span>
                          </td>
                          <td className="text-right py-2 px-2 text-muted-foreground" style={mono}>{formatBDT(s.courier_cost)}</td>
                          <td className="text-right py-2 px-2 text-muted-foreground" style={mono}>{formatBDT(s.meta_ads_cost)}</td>
                          <td className="text-right py-2 px-2 text-muted-foreground" style={mono}>{formatBDT(s.allocated_cost)}</td>
                          <td className="text-right py-2 px-2">
                            {s.returned_qty > 0 ? (
                              <span className="text-destructive flex items-center justify-end gap-0.5" style={mono}>
                                <Undo2 className="w-3 h-3" />{s.returned_qty}
                              </span>
                            ) : (
                              <span className="text-muted-foreground" style={mono}>—</span>
                            )}
                          </td>
                          <td className="text-right py-2 px-2 font-semibold" style={mono}>
                            <span className={s.net_profit >= 0 ? "text-emerald-600" : "text-destructive"}>
                              {formatBDT(s.net_profit)}
                            </span>
                          </td>
                          <td className="text-right py-2 px-2">
                            <Badge variant={margin >= 20 ? "default" : margin >= 0 ? "secondary" : "destructive"} className="text-[10px] px-1.5">
                              {margin}%
                            </Badge>
                          </td>
                          <td className="px-1">
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                          </td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr><td colSpan={12} className="text-center py-8 text-muted-foreground">No SKU data for this period</td></tr>
                    )}
                  </tbody>
                  {filtered.length > 0 && (
                    <tfoot>
                      <tr className="bg-muted/50 font-bold text-xs border-t-2 border-border">
                        <td className="py-2.5 px-3">TOTALS ({filtered.length} SKUs)</td>
                        <td className="text-right py-2.5 px-2" style={mono}>{totals.qty_sold}</td>
                        <td className="text-right py-2.5 px-2" style={mono}>{formatBDT(totals.revenue)}</td>
                        <td className="text-right py-2.5 px-2" style={mono}>{formatBDT(totals.cogs)}</td>
                        <td className="text-right py-2.5 px-2" style={mono}>{formatBDT(totals.revenue - totals.cogs)}</td>
                        <td className="text-right py-2.5 px-2" style={mono}>{formatBDT(totals.courier_cost)}</td>
                        <td className="text-right py-2.5 px-2" style={mono}>{formatBDT(totals.meta_ads_cost)}</td>
                        <td className="text-right py-2.5 px-2" style={mono}>{formatBDT(totals.allocated_cost)}</td>
                        <td className="text-right py-2.5 px-2" style={mono}>{formatBDT(totals.return_cogs)}</td>
                        <td className="text-right py-2.5 px-2 font-bold" style={mono}>
                          <span className={totals.net_profit >= 0 ? "text-emerald-600" : "text-destructive"}>
                            {formatBDT(totals.net_profit)}
                          </span>
                        </td>
                        <td className="text-right py-2.5 px-2">
                          <Badge variant="outline" className="text-[10px]">
                            {totals.revenue > 0 ? Math.round((totals.net_profit / totals.revenue) * 100) : 0}%
                          </Badge>
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Drilldown Drawer */}
      <Sheet open={!!selectedSKU} onOpenChange={(open) => !open && setSelectedSKU(null)}>
        <SheetContent className="sm:max-w-xl w-full">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2" style={heading}>
              {selectedSKU?.image_url && <img src={selectedSKU.image_url} alt="" className="w-8 h-8 rounded object-cover" />}
              <div>
                <p className="text-base">{selectedSKU?.name}</p>
                <p className="text-xs text-muted-foreground font-normal">{selectedSKU?.sku}</p>
              </div>
            </SheetTitle>
          </SheetHeader>

          {selectedSKU && (
            <ScrollArea className="h-[calc(100vh-120px)] mt-4">
              <div className="space-y-4 pr-4">
                {/* Cost Waterfall */}
                <Card className="border-border/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Cost Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    <WaterfallRow label="Revenue" amount={selectedSKU.revenue} positive />
                    <WaterfallRow label="COGS" amount={-selectedSKU.cogs} />
                    <WaterfallRow label="= Gross Profit" amount={selectedSKU.gross_profit} bold positive={selectedSKU.gross_profit >= 0} />
                    <WaterfallRow label="Courier Cost" amount={-selectedSKU.courier_cost} />
                    <WaterfallRow label="Meta Ads" amount={-selectedSKU.meta_ads_cost} />
                    <WaterfallRow label="Other Allocations" amount={-selectedSKU.allocated_cost} />
                    <WaterfallRow label="Return COGS Loss" amount={-selectedSKU.return_cogs} />
                    <WaterfallRow label="Return Courier" amount={-selectedSKU.return_courier_cost} />
                    <div className="flex justify-between px-3 py-2 rounded-lg bg-foreground text-background font-bold text-sm mt-2">
                      <span>Net Profit</span>
                      <span className={selectedSKU.net_profit >= 0 ? "text-emerald-400" : "text-red-400"} style={mono}>
                        {formatBDT(selectedSKU.net_profit)}
                      </span>
                    </div>
                    <div className="flex justify-between px-3 text-xs text-muted-foreground">
                      <span>Avg Sell Price: {formatBDT(selectedSKU.avg_sell_price)}</span>
                      <span>Orders: {selectedSKU.order_count} · Returns: {selectedSKU.returned_qty}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Allocation detail */}
                {(selectedSKU.allocation_detail || []).length > 0 && (
                  <Card className="border-border/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Allocation Detail</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {(selectedSKU.allocation_detail || []).map((a: any, i: number) => (
                        <div key={i} className="flex justify-between text-xs py-1 border-b border-border/20">
                          <span>{a.category} <span className="text-muted-foreground">({a.method})</span></span>
                          <span style={mono}>{formatBDT(a.amount)}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Order drilldown */}
                <Card className="border-border/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Contributing Orders</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {drillLoading ? (
                      <Skeleton className="h-32" />
                    ) : (drilldown || []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">No orders found</p>
                    ) : (
                      <div className="space-y-0">
                        {(drilldown || []).map((o: any) => (
                          <div key={o.order_id} className="flex items-center justify-between py-2 border-b border-border/20 text-xs">
                            <div>
                              <p className="font-medium">{o.invoice_id || o.order_id?.slice(0, 8)}</p>
                              <p className="text-muted-foreground">{o.customer_name} · {formatDate(o.order_date)}</p>
                            </div>
                            <div className="text-right">
                              <div className="flex items-center gap-2">
                                <Badge variant={o.status === "delivered" ? "default" : "destructive"} className="text-[10px]">
                                  {o.status}
                                </Badge>
                                <span style={mono}>×{o.quantity}</span>
                              </div>
                              <div className="flex gap-3 mt-0.5 text-muted-foreground">
                                <span>Rev: {formatBDT(o.line_revenue)}</span>
                                <span>COGS: {formatBDT(o.line_cogs)}</span>
                                <span className={o.line_contribution >= 0 ? "text-emerald-600" : "text-destructive"}>
                                  Cont: {formatBDT(o.line_contribution)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ── Sub-components ─────────── */

function MiniKPI({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card className="border-border/50">
      <CardContent className="pt-3 pb-2">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className={cn("text-lg font-bold", color)} style={mono}>{formatBDT(value)}</p>
      </CardContent>
    </Card>
  );
}

function WaterfallRow({ label, amount, bold, positive }: { label: string; amount: number; bold?: boolean; positive?: boolean }) {
  return (
    <div className={cn("flex justify-between px-3 py-1.5 text-xs", bold && "font-bold bg-muted/50 rounded")}>
      <span>{label}</span>
      <span
        className={cn(
          amount > 0 ? "text-emerald-600" : amount < 0 ? "text-destructive" : "text-muted-foreground",
          positive !== undefined && positive && "text-emerald-600",
          positive !== undefined && !positive && amount !== 0 && "text-destructive"
        )}
        style={mono}
      >
        {amount >= 0 ? "" : "−"}{formatBDT(Math.abs(amount))}
      </span>
    </div>
  );
}
