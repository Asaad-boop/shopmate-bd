import { useState, useMemo } from "react";
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
import { formatBDT, formatBDT2, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, subMonths, subDays } from "date-fns";
import {
  Package, Download, Search, ChevronRight, Undo2, AlertTriangle,
  TrendingUp, DollarSign, Truck, Megaphone, BarChart3, ArrowUpDown, Printer,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const heading: React.CSSProperties = { fontFamily: "'Playfair Display', serif" };
const mono: React.CSSProperties = { fontFamily: "'DM Mono', monospace" };

const PRESETS: Record<string, () => [string, string]> = {
  "this-month": () => [format(startOfMonth(new Date()), "yyyy-MM-dd"), format(endOfMonth(new Date()), "yyyy-MM-dd")],
  "last-month": () => [format(startOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd"), format(endOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd")],
  "last-7": () => [format(subDays(new Date(), 6), "yyyy-MM-dd"), format(new Date(), "yyyy-MM-dd")],
  "last-30": () => [format(subDays(new Date(), 29), "yyyy-MM-dd"), format(new Date(), "yyyy-MM-dd")],
  "last-90": () => [format(subDays(new Date(), 89), "yyyy-MM-dd"), format(new Date(), "yyyy-MM-dd")],
};

type SortKey = "revenue" | "net_profit" | "qty_sold" | "margin" | "cogs" | "return_rate" | "courier_cost";

function useSKUReport(dateFrom: string, dateTo: string, allocation: string) {
  return useQuery({
    queryKey: ["sku-profitability-report", dateFrom, dateTo, allocation],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("sku_profitability_report", {
        p_date_from: dateFrom,
        p_date_to: dateTo,
        p_courier_allocation: allocation,
      });
      if (error) throw error;
      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      return parsed as { skus: any[]; exceptions: any };
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
      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      return (parsed || []) as any[];
    },
    enabled: !!productId,
  });
}

export default function ReportsSKUProfit() {
  const navigate = useNavigate();
  const [preset, setPreset] = useState("this-month");
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("revenue");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [selectedSKU, setSelectedSKU] = useState<any>(null);
  const [includeAllocations, setIncludeAllocations] = useState(true);
  const [includeReturns, setIncludeReturns] = useState(true);
  const [courierAllocation, setCourierAllocation] = useState("revenue");
  const [groupBy, setGroupBy] = useState("sku");

  const { data: report, isLoading } = useSKUReport(dateFrom, dateTo, courierAllocation);
  const { data: drilldown, isLoading: drillLoading } = useSKUDrilldown(
    selectedSKU?.product_id, dateFrom, dateTo
  );

  const skus = report?.skus || [];
  const exceptions = report?.exceptions || {};

  const hasExceptions = (exceptions.missing_cost_count || 0) > 0
    || (exceptions.missing_courier_count || 0) > 0
    || (exceptions.unmapped_meta_spend || 0) > 0;

  const handlePreset = (v: string) => {
    setPreset(v);
    if (PRESETS[v]) {
      const [f, t] = PRESETS[v]();
      setDateFrom(f);
      setDateTo(t);
    }
  };

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortBy(key); setSortDir("desc"); }
  };

  const filtered = useMemo(() => {
    let items = skus.filter((s: any) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return s.sku?.toLowerCase().includes(q) || s.name?.toLowerCase().includes(q)
        || s.brand?.toLowerCase().includes(q) || s.category_name?.toLowerCase().includes(q);
    });

    // Group by category or brand
    if (groupBy !== "sku") {
      const grouped: Record<string, any> = {};
      items.forEach((s: any) => {
        const key = groupBy === "category" ? (s.category_name || "Uncategorized") : (s.brand || "No Brand");
        if (!grouped[key]) {
          grouped[key] = {
            product_id: key, name: key, sku: `${items.filter((x: any) =>
              groupBy === "category" ? (x.category_name || "Uncategorized") === key : (x.brand || "No Brand") === key
            ).length} SKUs`,
            image_url: null, brand: "", category_name: key,
            order_count: 0, qty_sold: 0, returned_qty: 0, exchanged_qty: 0,
            revenue: 0, cogs: 0, gross_profit: 0, courier_cost: 0, cod_fee: 0,
            shipping_income: 0, meta_ads_cost: 0, allocated_cost: 0, return_cogs: 0,
            net_profit: 0, margin: 0, return_rate: 0, missing_cost: false,
          };
        }
        const g = grouped[key];
        g.order_count += s.order_count || 0;
        g.qty_sold += s.qty_sold || 0;
        g.returned_qty += s.returned_qty || 0;
        g.exchanged_qty += s.exchanged_qty || 0;
        g.revenue += s.revenue || 0;
        g.cogs += s.cogs || 0;
        g.gross_profit += s.gross_profit || 0;
        g.courier_cost += s.courier_cost || 0;
        g.cod_fee += s.cod_fee || 0;
        g.shipping_income += s.shipping_income || 0;
        g.meta_ads_cost += s.meta_ads_cost || 0;
        g.allocated_cost += s.allocated_cost || 0;
        g.return_cogs += s.return_cogs || 0;
        g.net_profit += s.net_profit || 0;
        if (s.missing_cost) g.missing_cost = true;
      });
      items = Object.values(grouped).map((g: any) => ({
        ...g,
        margin: g.revenue > 0 ? Math.round(g.net_profit / g.revenue * 1000) / 10 : 0,
        return_rate: g.qty_sold > 0 ? Math.round(g.returned_qty / g.qty_sold * 1000) / 10 : 0,
        avg_sell_price: g.qty_sold > 0 ? Math.round(g.revenue / g.qty_sold * 100) / 100 : 0,
      }));
    }

    return items.sort((a: any, b: any) => {
      const mul = sortDir === "desc" ? 1 : -1;
      return mul * ((b[sortBy] || 0) - (a[sortBy] || 0));
    });
  }, [skus, search, sortBy, sortDir, groupBy]);

  const totals = useMemo(() => filtered.reduce(
    (t: any, s: any) => ({
      order_count: t.order_count + (s.order_count || 0),
      qty_sold: t.qty_sold + (s.qty_sold || 0),
      returned_qty: t.returned_qty + (s.returned_qty || 0),
      exchanged_qty: t.exchanged_qty + (s.exchanged_qty || 0),
      revenue: t.revenue + (s.revenue || 0),
      cogs: t.cogs + (s.cogs || 0),
      courier_cost: t.courier_cost + (s.courier_cost || 0),
      cod_fee: t.cod_fee + (s.cod_fee || 0),
      shipping_income: t.shipping_income + (s.shipping_income || 0),
      meta_ads_cost: t.meta_ads_cost + (s.meta_ads_cost || 0),
      allocated_cost: t.allocated_cost + (s.allocated_cost || 0),
      return_cogs: t.return_cogs + (s.return_cogs || 0),
      net_profit: t.net_profit + (s.net_profit || 0),
    }),
    { order_count: 0, qty_sold: 0, returned_qty: 0, exchanged_qty: 0, revenue: 0, cogs: 0, courier_cost: 0, cod_fee: 0, shipping_income: 0, meta_ads_cost: 0, allocated_cost: 0, return_cogs: 0, net_profit: 0 }
  ), [filtered]);

  const netMargin = totals.revenue > 0 ? Math.round(totals.net_profit / totals.revenue * 1000) / 10 : 0;

  const handleExportCSV = () => {
    const header = ["SKU", "Product", "Category", "Brand", "Orders", "Qty Sold", "Returned", "Exchanged",
      "Revenue", "Avg Price", "COGS", "Gross Profit", "Courier", "COD Fee", "Ship Income",
      "Meta Ads", "Allocations", "Return Loss", "Net Profit", "Margin %", "Return Rate %"];
    const rows = filtered.map((s: any) => [
      s.sku, s.name, s.category_name || "", s.brand || "", s.order_count, s.qty_sold,
      s.returned_qty, s.exchanged_qty, s.revenue?.toFixed(2), s.avg_sell_price?.toFixed(2),
      s.cogs?.toFixed(2), s.gross_profit?.toFixed(2), s.courier_cost?.toFixed(2), s.cod_fee?.toFixed(2),
      s.shipping_income?.toFixed(2), s.meta_ads_cost?.toFixed(2), s.allocated_cost?.toFixed(2),
      s.return_cogs?.toFixed(2), s.net_profit?.toFixed(2), s.margin, s.return_rate,
    ]);
    const csv = [
      [`SKU Profitability Report — ${dateFrom} to ${dateTo}`],
      [], header, ...rows,
    ].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `SKU_Profitability_${dateFrom}_${dateTo}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const handleExportDrilldownCSV = () => {
    if (!drilldown?.length) return;
    const header = ["Invoice", "Date", "Customer", "Status", "Qty", "Revenue", "COGS", "Courier", "Contribution"];
    const rows = drilldown.map((o: any) => [
      o.invoice_id || o.order_id?.slice(0, 8), o.order_date, o.customer_name, o.status,
      o.quantity, o.line_revenue?.toFixed(2), o.line_cogs?.toFixed(2),
      o.line_courier_cost?.toFixed(2), o.line_contribution?.toFixed(2),
    ]);
    const csv = [header, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `SKU_Detail_${selectedSKU?.sku}_${dateFrom}_${dateTo}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const SortHeader = ({ label, sortKey, className }: { label: string; sortKey: SortKey; className?: string }) => (
    <TableHead
      className={cn("cursor-pointer select-none hover:text-foreground transition-colors", className)}
      onClick={() => toggleSort(sortKey)}
    >
      <span className="inline-flex items-center gap-0.5">
        {label}
        {sortBy === sortKey && <ArrowUpDown className="w-3 h-3" />}
      </span>
    </TableHead>
  );

  return (
    <div className="p-6 space-y-5 max-w-[1600px] mx-auto animate-fade-in">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Package className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={heading}>SKU Profitability</h1>
            <p className="text-sm text-muted-foreground">
              Per-product net profit: Revenue − COGS − Courier − Marketing − Allocations
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-1" /> Print
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!skus.length}>
            <Download className="w-4 h-4 mr-1" /> CSV
          </Button>
        </div>
      </header>

      {/* Exceptions Warning */}
      {hasExceptions && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="py-3 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              <p className="font-medium text-foreground">Data Completeness Warnings</p>
              <div className="flex flex-wrap gap-3 text-muted-foreground text-xs">
                {exceptions.missing_cost_count > 0 && (
                  <span>⚠ {exceptions.missing_cost_count} SKUs missing cost data</span>
                )}
                {exceptions.missing_courier_count > 0 && (
                  <span>⚠ {exceptions.missing_courier_count} orders missing courier cost</span>
                )}
                {exceptions.unmapped_meta_spend > 0 && (
                  <span>⚠ {formatBDT2(exceptions.unmapped_meta_spend)} unmapped Meta spend</span>
                )}
              </div>
              <Button variant="link" size="sm" className="h-auto p-0 text-xs text-warning"
                onClick={() => navigate("/exceptions")}>
                View in Exceptions Center →
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card className="border-border/50">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <Label className="text-xs">Period</Label>
              <Select value={preset} onValueChange={handlePreset}>
                <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
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
              <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPreset("custom"); }} className="w-[140px] h-8 text-xs" />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPreset("custom"); }} className="w-[140px] h-8 text-xs" />
            </div>
            <div>
              <Label className="text-xs">Group by</Label>
              <Select value={groupBy} onValueChange={setGroupBy}>
                <SelectTrigger className="w-[110px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sku">SKU</SelectItem>
                  <SelectItem value="category">Category</SelectItem>
                  <SelectItem value="brand">Brand</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Courier Alloc.</Label>
              <Select value={courierAllocation} onValueChange={setCourierAllocation}>
                <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="revenue">Revenue Share</SelectItem>
                  <SelectItem value="quantity">Qty Share</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 h-8">
              <Switch checked={includeAllocations} onCheckedChange={setIncludeAllocations} id="alloc" />
              <Label htmlFor="alloc" className="text-xs cursor-pointer">Allocations</Label>
            </div>
            <div className="flex items-center gap-2 h-8">
              <Switch checked={includeReturns} onCheckedChange={setIncludeReturns} id="returns" />
              <Label htmlFor="returns" className="text-xs cursor-pointer">Returns</Label>
            </div>
            <div className="relative ml-auto">
              <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground" />
              <Input placeholder="Search SKU / brand..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 w-[200px] h-8 text-xs" />
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? <Skeleton className="h-[500px]" /> : (
        <>
          {/* KPI Summary */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <KPICard icon={DollarSign} label="Delivered Revenue" value={formatBDT2(totals.revenue)} />
            <KPICard icon={Package} label="Total COGS" value={formatBDT2(totals.cogs)} muted />
            <KPICard icon={Truck} label="Courier Cost" value={formatBDT2(totals.courier_cost)} muted />
            <KPICard icon={Megaphone} label="Marketing" value={formatBDT2(totals.meta_ads_cost + totals.allocated_cost)} muted />
            <KPICard icon={TrendingUp} label="Net Profit"
              value={formatBDT2(totals.net_profit)}
              color={totals.net_profit >= 0 ? "text-emerald-600" : "text-destructive"} />
            <KPICard icon={BarChart3} label="Net Margin"
              value={`${netMargin}%`}
              color={netMargin >= 20 ? "text-emerald-600" : netMargin >= 0 ? "text-warning" : "text-destructive"} />
          </div>

          {/* Main Grid */}
          <Card className="border-border/50">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>Product</TableHead>
                      {groupBy === "sku" && <TableHead>Category / Brand</TableHead>}
                      <SortHeader label="Orders" sortKey="qty_sold" className="text-right" />
                      <TableHead className="text-right">Sold</TableHead>
                      {includeReturns && <TableHead className="text-right">Ret.</TableHead>}
                      <SortHeader label="Revenue" sortKey="revenue" className="text-right" />
                      <TableHead className="text-right">Avg Price</TableHead>
                      <SortHeader label="COGS" sortKey="cogs" className="text-right" />
                      <TableHead className="text-right">Gross</TableHead>
                      <SortHeader label="Courier" sortKey="courier_cost" className="text-right" />
                      <TableHead className="text-right">COD Fee</TableHead>
                      {includeAllocations && <TableHead className="text-right">Meta Ads</TableHead>}
                      {includeAllocations && <TableHead className="text-right">Other Alloc.</TableHead>}
                      {includeReturns && <TableHead className="text-right">Ret. Loss</TableHead>}
                      <SortHeader label="Net Profit" sortKey="net_profit" className="text-right" />
                      <SortHeader label="Margin" sortKey="margin" className="text-right" />
                      <SortHeader label="Ret %" sortKey="return_rate" className="text-right" />
                      <TableHead className="w-6" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={20} className="text-center text-muted-foreground py-12">
                          No SKU data for this period
                        </TableCell>
                      </TableRow>
                    )}
                    {filtered.map((s: any, i: number) => (
                      <TableRow
                        key={s.product_id}
                        className="cursor-pointer"
                        onClick={() => groupBy === "sku" && setSelectedSKU(s)}
                      >
                        <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {s.image_url ? (
                              <img src={s.image_url} alt="" className="w-7 h-7 rounded-lg object-cover border" />
                            ) : (
                              <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center">
                                <Package className="w-3.5 h-3.5 text-muted-foreground" />
                              </div>
                            )}
                            <div>
                              <p className="text-xs font-medium leading-tight flex items-center gap-1">
                                {s.name}
                                {s.missing_cost && <AlertTriangle className="w-3 h-3 text-warning" />}
                              </p>
                              <p className="text-[10px] text-muted-foreground">{s.sku}</p>
                            </div>
                          </div>
                        </TableCell>
                        {groupBy === "sku" && (
                          <TableCell className="text-xs text-muted-foreground">
                            {s.category_name || "—"}{s.brand ? ` / ${s.brand}` : ""}
                          </TableCell>
                        )}
                        <TableCell className="text-right text-xs" style={mono}>{s.order_count}</TableCell>
                        <TableCell className="text-right text-xs" style={mono}>{s.qty_sold}</TableCell>
                        {includeReturns && (
                          <TableCell className="text-right text-xs" style={mono}>
                            {s.returned_qty > 0 ? (
                              <span className="text-destructive flex items-center justify-end gap-0.5">
                                <Undo2 className="w-3 h-3" />{s.returned_qty}
                              </span>
                            ) : "—"}
                          </TableCell>
                        )}
                        <TableCell className="text-right text-xs" style={mono}>{formatBDT2(s.revenue)}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground" style={mono}>{formatBDT2(s.avg_sell_price)}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground" style={mono}>{formatBDT2(s.cogs)}</TableCell>
                        <TableCell className="text-right text-xs" style={mono}>
                          <span className={s.gross_profit >= 0 ? "text-emerald-600" : "text-destructive"}>
                            {formatBDT2(s.gross_profit)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground" style={mono}>{formatBDT2(s.courier_cost)}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground" style={mono}>{formatBDT2(s.cod_fee)}</TableCell>
                        {includeAllocations && (
                          <TableCell className="text-right text-xs text-muted-foreground" style={mono}>{formatBDT2(s.meta_ads_cost)}</TableCell>
                        )}
                        {includeAllocations && (
                          <TableCell className="text-right text-xs text-muted-foreground" style={mono}>{formatBDT2(s.allocated_cost)}</TableCell>
                        )}
                        {includeReturns && (
                          <TableCell className="text-right text-xs text-muted-foreground" style={mono}>{formatBDT2(s.return_cogs)}</TableCell>
                        )}
                        <TableCell className="text-right text-xs font-semibold" style={mono}>
                          <span className={s.net_profit >= 0 ? "text-emerald-600" : "text-destructive"}>
                            {formatBDT2(s.net_profit)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={s.margin >= 20 ? "default" : s.margin >= 0 ? "secondary" : "destructive"}
                            className="text-[10px] px-1.5 font-mono"
                          >
                            {s.margin}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs" style={mono}>
                          {s.return_rate > 0 ? (
                            <span className={s.return_rate > 20 ? "text-destructive" : "text-muted-foreground"}>
                              {s.return_rate}%
                            </span>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="px-1">
                          {groupBy === "sku" && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  {filtered.length > 0 && (
                    <TableFooter>
                      <TableRow>
                        <TableCell />
                        <TableCell className="font-bold text-xs">TOTALS ({filtered.length} {groupBy === "sku" ? "SKUs" : "groups"})</TableCell>
                        {groupBy === "sku" && <TableCell />}
                        <TableCell className="text-right font-bold text-xs" style={mono}>{totals.order_count}</TableCell>
                        <TableCell className="text-right font-bold text-xs" style={mono}>{totals.qty_sold}</TableCell>
                        {includeReturns && <TableCell className="text-right font-bold text-xs text-destructive" style={mono}>{totals.returned_qty}</TableCell>}
                        <TableCell className="text-right font-bold text-xs" style={mono}>{formatBDT2(totals.revenue)}</TableCell>
                        <TableCell />
                        <TableCell className="text-right font-bold text-xs" style={mono}>{formatBDT2(totals.cogs)}</TableCell>
                        <TableCell className="text-right font-bold text-xs" style={mono}>{formatBDT2(totals.revenue - totals.cogs)}</TableCell>
                        <TableCell className="text-right font-bold text-xs" style={mono}>{formatBDT2(totals.courier_cost)}</TableCell>
                        <TableCell className="text-right font-bold text-xs" style={mono}>{formatBDT2(totals.cod_fee)}</TableCell>
                        {includeAllocations && <TableCell className="text-right font-bold text-xs" style={mono}>{formatBDT2(totals.meta_ads_cost)}</TableCell>}
                        {includeAllocations && <TableCell className="text-right font-bold text-xs" style={mono}>{formatBDT2(totals.allocated_cost)}</TableCell>}
                        {includeReturns && <TableCell className="text-right font-bold text-xs" style={mono}>{formatBDT2(totals.return_cogs)}</TableCell>}
                        <TableCell className="text-right font-bold text-xs" style={mono}>
                          <span className={totals.net_profit >= 0 ? "text-emerald-600" : "text-destructive"}>
                            {formatBDT2(totals.net_profit)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className="text-[10px] font-mono">{netMargin}%</Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs" style={mono}>
                          {totals.qty_sold > 0 ? `${Math.round(totals.returned_qty / totals.qty_sold * 1000) / 10}%` : "—"}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    </TableFooter>
                  )}
                </Table>
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
              {selectedSKU?.image_url && <img src={selectedSKU.image_url} alt="" className="w-8 h-8 rounded-lg object-cover" />}
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
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Cost Breakdown</CardTitle></CardHeader>
                  <CardContent className="space-y-1">
                    <WaterfallRow label="Revenue" amount={selectedSKU.revenue} positive />
                    <WaterfallRow label="COGS" amount={-selectedSKU.cogs} />
                    <WaterfallRow label="= Gross Profit" amount={selectedSKU.gross_profit} bold positive={selectedSKU.gross_profit >= 0} />
                    <WaterfallRow label="Courier Cost" amount={-selectedSKU.courier_cost} />
                    <WaterfallRow label="COD Fee" amount={-selectedSKU.cod_fee} />
                    <WaterfallRow label="Shipping Income" amount={selectedSKU.shipping_income} positive />
                    <WaterfallRow label="Meta Ads" amount={-selectedSKU.meta_ads_cost} />
                    <WaterfallRow label="Other Allocations" amount={-selectedSKU.allocated_cost} />
                    <WaterfallRow label="Return Loss (COGS)" amount={-selectedSKU.return_cogs} />
                    <div className="flex justify-between px-3 py-2 rounded-lg bg-foreground text-background font-bold text-sm mt-2">
                      <span>Net Profit</span>
                      <span className={selectedSKU.net_profit >= 0 ? "text-emerald-400" : "text-red-400"} style={mono}>
                        {formatBDT2(selectedSKU.net_profit)}
                      </span>
                    </div>
                    <div className="flex justify-between px-3 text-xs text-muted-foreground mt-1">
                      <span>Avg Sell Price: {formatBDT2(selectedSKU.avg_sell_price)}</span>
                      <span>Margin: {selectedSKU.margin}% · Return Rate: {selectedSKU.return_rate}%</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Allocation detail */}
                {(selectedSKU.allocation_detail || []).length > 0 && (
                  <Card className="border-border/50">
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Allocation Detail</CardTitle></CardHeader>
                    <CardContent>
                      {(selectedSKU.allocation_detail || []).map((a: any, i: number) => (
                        <div key={i} className="flex justify-between text-xs py-1.5 border-b border-border/20 last:border-0">
                          <span>{a.category}</span>
                          <span style={mono}>{formatBDT2(a.amount)}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Order drilldown */}
                <Card className="border-border/50">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm">Contributing Orders</CardTitle>
                    <Button variant="ghost" size="sm" onClick={handleExportDrilldownCSV} disabled={!drilldown?.length}>
                      <Download className="w-3.5 h-3.5 mr-1" /> CSV
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {drillLoading ? <Skeleton className="h-32" /> : (drilldown || []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">No orders found</p>
                    ) : (
                      <div className="space-y-0">
                        {(drilldown || []).map((o: any) => (
                          <div key={o.order_id} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0 text-xs">
                            <div>
                              <p className="font-medium">{o.invoice_id || o.order_id?.slice(0, 8)}</p>
                              <p className="text-muted-foreground">{o.customer_name} · {formatDate(o.order_date)}</p>
                            </div>
                            <div className="text-right space-y-0.5">
                              <div className="flex items-center gap-2 justify-end">
                                <Badge variant={o.status === "delivered" ? "default" : o.status === "returned" ? "destructive" : "secondary"} className="text-[10px]">
                                  {o.status}
                                </Badge>
                                <span style={mono}>×{o.quantity}</span>
                              </div>
                              <div className="flex gap-3 text-muted-foreground">
                                <span>Rev: {formatBDT2(o.line_revenue)}</span>
                                <span>COGS: {formatBDT2(o.line_cogs)}</span>
                                <span>Cour: {formatBDT2(o.line_courier_cost)}</span>
                                <span className={o.line_contribution >= 0 ? "text-emerald-600" : "text-destructive"}>
                                  {formatBDT2(o.line_contribution)}
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

function KPICard({ icon: Icon, label, value, color, muted }: { icon: any; label: string; value: string; color?: string; muted?: boolean }) {
  return (
    <Card className="border-border/50">
      <CardContent className="pt-3 pb-2.5">
        <div className="flex items-center gap-1.5 mb-1">
          <Icon className={cn("w-3.5 h-3.5", muted ? "text-muted-foreground" : "text-primary")} />
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
        </div>
        <p className={cn("text-lg font-bold", color || (muted ? "text-muted-foreground" : "text-foreground"))}
          style={{ fontFamily: "'DM Mono', monospace" }}>
          {value}
        </p>
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
        style={{ fontFamily: "'DM Mono', monospace" }}
      >
        {amount >= 0 ? "" : "−"}{formatBDT2(Math.abs(amount))}
      </span>
    </div>
  );
}
