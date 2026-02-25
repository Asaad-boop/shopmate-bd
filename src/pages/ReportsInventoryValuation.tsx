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
import { formatBDT2, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Package, Download, Search, AlertTriangle, ChevronRight,
  Boxes, DollarSign, TrendingDown, Skull, ArrowUpDown, Printer,
  CheckCircle2, XCircle, ArrowDownUp, Clock,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const heading: React.CSSProperties = { fontFamily: "'Playfair Display', serif" };
const mono: React.CSSProperties = { fontFamily: "'DM Mono', monospace" };

type SortKey = "stock_value" | "on_hand" | "avg_cost" | "days_since_movement" | "name";

function useInventoryValuationReport(asOfDate: string, includeZero: boolean, activeOnly: boolean) {
  return useQuery({
    queryKey: ["inventory-valuation-report", asOfDate, includeZero, activeOnly],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("inventory_valuation_report", {
        p_as_of_date: asOfDate,
        p_include_zero_stock: includeZero,
        p_active_only: activeOnly,
      });
      if (error) throw error;
      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      return parsed as { skus: any[]; summary: any; reconciliation: any };
    },
  });
}

function useStockLedgerDrilldown(productId: string | null, asOfDate: string) {
  return useQuery({
    queryKey: ["stock-ledger-drilldown", productId, asOfDate],
    queryFn: async () => {
      if (!productId) return [];
      const { data, error } = await supabase.rpc("inventory_ledger_drilldown", {
        p_product_id: productId,
        p_as_of_date: asOfDate,
      });
      if (error) throw error;
      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      return (parsed || []) as any[];
    },
    enabled: !!productId,
  });
}

export default function ReportsInventoryValuation() {
  const navigate = useNavigate();
  const [asOfDate, setAsOfDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("stock_value");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [activeOnly, setActiveOnly] = useState(true);
  const [includeZero, setIncludeZero] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedSKU, setSelectedSKU] = useState<any>(null);

  const { data: report, isLoading } = useInventoryValuationReport(asOfDate, includeZero, activeOnly);
  const { data: ledger, isLoading: ledgerLoading } = useStockLedgerDrilldown(
    selectedSKU?.product_id, asOfDate
  );

  const skus = report?.skus || [];
  const summary = report?.summary || {};
  const reconciliation = report?.reconciliation || {};

  // Extract unique categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    skus.forEach((s: any) => { if (s.category_name) cats.add(s.category_name); });
    return Array.from(cats).sort();
  }, [skus]);

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortBy(key); setSortDir("desc"); }
  };

  const filtered = useMemo(() => {
    return skus
      .filter((s: any) => {
        if (search) {
          const q = search.toLowerCase();
          if (!s.sku?.toLowerCase().includes(q) && !s.name?.toLowerCase().includes(q)) return false;
        }
        if (categoryFilter !== "all" && s.category_name !== categoryFilter) return false;
        return true;
      })
      .sort((a: any, b: any) => {
        const mul = sortDir === "desc" ? 1 : -1;
        if (sortBy === "name") return mul * (b.name || "").localeCompare(a.name || "");
        return mul * ((b[sortBy] ?? 0) - (a[sortBy] ?? 0));
      });
  }, [skus, search, sortBy, sortDir, categoryFilter]);

  const totalValue = filtered.reduce((s: number, r: any) => s + (r.stock_value || 0), 0);
  const totalUnits = filtered.reduce((s: number, r: any) => s + (r.on_hand || 0), 0);

  const handleExportCSV = () => {
    const header = ["SKU", "Product", "Category", "Status", "On Hand", "Reserved", "Available",
      "Avg Cost", "Stock Value", "Last In", "Last Out", "Days Idle", "Reorder Pt", "Suggested Qty"];
    const rows = filtered.map((s: any) => [
      s.sku, s.name, s.category_name || "", s.product_status, s.on_hand, s.reserved, s.available,
      s.avg_cost?.toFixed(2), s.stock_value?.toFixed(2), s.last_stock_in || "", s.last_stock_out || "",
      s.days_since_movement ?? "", s.reorder_point ?? "", s.suggested_reorder_qty ?? "",
    ]);
    const csv = [
      [`Inventory Valuation Report — As of ${asOfDate}`],
      [`Total Value: ${totalValue.toFixed(2)} | Total Units: ${totalUnits}`],
      [], header, ...rows,
    ].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `Inventory_Valuation_${asOfDate}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const handleExportLedgerCSV = () => {
    if (!ledger?.length) return;
    const header = ["Date", "Type", "Qty In", "Qty Out", "Unit Cost", "Avg Cost", "Balance", "Reference", "Note"];
    const rows = ledger.map((l: any) => [
      l.txn_date, l.txn_type, l.qty_in, l.qty_out, l.unit_cost?.toFixed(2) ?? "",
      l.running_avg_cost?.toFixed(2) ?? "", l.running_balance, l.reference_type || "", l.note || "",
    ]);
    const csv = [header, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `Stock_Ledger_${selectedSKU?.sku}_${asOfDate}.csv`;
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
            <Boxes className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={heading}>Inventory Valuation</h1>
            <p className="text-sm text-muted-foreground">Stock quantities, WAC costing, and total inventory value</p>
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

      {/* Filters */}
      <Card className="border-border/50">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <Label className="text-xs">As of Date</Label>
              <Input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className="w-[150px] h-8 text-xs" />
            </div>
            <div>
              <Label className="text-xs">Category</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 h-8">
              <Switch checked={activeOnly} onCheckedChange={setActiveOnly} id="active" />
              <Label htmlFor="active" className="text-xs cursor-pointer">Active only</Label>
            </div>
            <div className="flex items-center gap-2 h-8">
              <Switch checked={includeZero} onCheckedChange={setIncludeZero} id="zero" />
              <Label htmlFor="zero" className="text-xs cursor-pointer">Include zero stock</Label>
            </div>
            <div className="relative ml-auto">
              <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground" />
              <Input placeholder="Search SKU..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 w-[200px] h-8 text-xs" />
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? <Skeleton className="h-[500px]" /> : (
        <>
          {/* KPI Summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <KPICard icon={Boxes} label="On Hand Units" value={summary.total_units?.toLocaleString() || "0"} />
            <KPICard icon={DollarSign} label="Total Stock Value" value={formatBDT2(summary.total_value)} highlight />
            <KPICard icon={TrendingDown} label="Low Stock SKUs" value={String(summary.low_stock_count || 0)}
              color={summary.low_stock_count > 0 ? "text-warning" : undefined} />
            <KPICard icon={AlertTriangle} label="Negative Stock" value={String(summary.negative_stock_count || 0)}
              color={summary.negative_stock_count > 0 ? "text-destructive" : undefined} />
            <KPICard icon={Skull} label="Dead Stock (90d+)" value={String(summary.dead_stock_count || 0)}
              color={summary.dead_stock_count > 0 ? "text-destructive" : undefined} />
          </div>

          {/* Reconciliation Panel */}
          <Card className={cn("border-border/50", !reconciliation.is_reconciled && "border-warning/40 bg-warning/5")}>
            <CardContent className="py-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  {reconciliation.is_reconciled ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <XCircle className="w-4 h-4 text-warning" />
                  )}
                  <span className="text-sm font-medium">
                    {reconciliation.is_reconciled ? "Reconciled" : "Variance Detected"}
                  </span>
                </div>
                <div className="flex gap-6 text-xs">
                  <div>
                    <span className="text-muted-foreground">Stock Ledger Value: </span>
                    <span className="font-mono font-medium">{formatBDT2(reconciliation.ledger_stock_value)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">GL Inventory Asset: </span>
                    <span className="font-mono font-medium">{formatBDT2(reconciliation.gl_inventory_value)}</span>
                  </div>
                  {!reconciliation.is_reconciled && (
                    <div>
                      <span className="text-muted-foreground">Variance: </span>
                      <span className="font-mono font-medium text-warning">{formatBDT2(reconciliation.variance)}</span>
                    </div>
                  )}
                </div>
                {!reconciliation.is_reconciled && (
                  <Button variant="link" size="sm" className="text-xs text-warning h-auto p-0"
                    onClick={() => navigate("/exceptions")}>
                    View Exceptions →
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Exceptions Warnings */}
          {((summary.missing_cost_count || 0) > 0 || (summary.negative_stock_count || 0) > 0) && (
            <Card className="border-warning/30 bg-warning/5">
              <CardContent className="py-3 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                <div className="text-sm space-y-1">
                  <p className="font-medium text-foreground">Data Integrity Warnings</p>
                  <div className="flex flex-wrap gap-3 text-muted-foreground text-xs">
                    {summary.missing_cost_count > 0 && (
                      <span>⚠ {summary.missing_cost_count} SKUs with missing avg cost</span>
                    )}
                    {summary.negative_stock_count > 0 && (
                      <span>⚠ {summary.negative_stock_count} SKUs with negative stock</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Main Grid */}
          <Card className="border-border/50">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <SortHeader label="Product" sortKey="name" />
                      <TableHead>Category</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <SortHeader label="On Hand" sortKey="on_hand" className="text-right" />
                      <TableHead className="text-right">Reserved</TableHead>
                      <TableHead className="text-right">Available</TableHead>
                      <SortHeader label="Avg Cost" sortKey="avg_cost" className="text-right" />
                      <SortHeader label="Stock Value" sortKey="stock_value" className="text-right" />
                      <TableHead className="text-right">Last In</TableHead>
                      <TableHead className="text-right">Last Out</TableHead>
                      <SortHeader label="Days Idle" sortKey="days_since_movement" className="text-right" />
                      <TableHead className="text-right">Reorder Pt</TableHead>
                      <TableHead className="w-6" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={14} className="text-center text-muted-foreground py-12">
                          No inventory data
                        </TableCell>
                      </TableRow>
                    )}
                    {filtered.map((s: any, i: number) => (
                      <TableRow
                        key={s.product_id}
                        className={cn("cursor-pointer", s.is_negative && "bg-destructive/5")}
                        onClick={() => setSelectedSKU(s)}
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
                                {s.is_missing_cost && <AlertTriangle className="w-3 h-3 text-warning" />}
                                {s.is_negative && <AlertTriangle className="w-3 h-3 text-destructive" />}
                              </p>
                              <p className="text-[10px] text-muted-foreground">{s.sku}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{s.category_name || "—"}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={s.product_status === "active" ? "default" : "secondary"} className="text-[10px]">
                            {s.product_status}
                          </Badge>
                        </TableCell>
                        <TableCell className={cn("text-right text-xs font-medium", s.on_hand < 0 && "text-destructive", s.is_low_stock && "text-warning")} style={mono}>
                          {s.on_hand}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground" style={mono}>{s.reserved}</TableCell>
                        <TableCell className="text-right text-xs" style={mono}>{s.available}</TableCell>
                        <TableCell className={cn("text-right text-xs", s.is_missing_cost ? "text-warning" : "text-muted-foreground")} style={mono}>
                          {s.avg_cost > 0 ? formatBDT2(s.avg_cost) : "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs font-semibold" style={mono}>
                          {formatBDT2(s.stock_value)}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">{s.last_stock_in ? formatDate(s.last_stock_in) : "—"}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">{s.last_stock_out ? formatDate(s.last_stock_out) : "—"}</TableCell>
                        <TableCell className={cn("text-right text-xs", s.is_dead_stock && "text-destructive font-medium")} style={mono}>
                          {s.days_since_movement != null ? `${s.days_since_movement}d` : "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground" style={mono}>
                          {s.reorder_point != null ? (
                            <span className="flex items-center justify-end gap-1">
                              {s.reorder_point}
                              {s.suggested_reorder_qty != null && (
                                <Badge variant="outline" className="text-[9px] px-1 ml-1">+{s.suggested_reorder_qty}</Badge>
                              )}
                            </span>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="px-1">
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  {filtered.length > 0 && (
                    <TableFooter>
                      <TableRow>
                        <TableCell />
                        <TableCell className="font-bold text-xs">TOTALS ({filtered.length} SKUs)</TableCell>
                        <TableCell />
                        <TableCell />
                        <TableCell className="text-right font-bold text-xs" style={mono}>{totalUnits}</TableCell>
                        <TableCell />
                        <TableCell />
                        <TableCell />
                        <TableCell className="text-right font-bold text-xs" style={mono}>{formatBDT2(totalValue)}</TableCell>
                        <TableCell colSpan={5} />
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
                {/* Stock Summary Card */}
                <Card className="border-border/50">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Stock Summary</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">On Hand</p>
                        <p className={cn("text-lg font-bold", selectedSKU.is_negative && "text-destructive")} style={mono}>
                          {selectedSKU.on_hand}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">Avg Cost</p>
                        <p className="text-lg font-bold" style={mono}>
                          {selectedSKU.avg_cost > 0 ? formatBDT2(selectedSKU.avg_cost) : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">Value</p>
                        <p className="text-lg font-bold text-primary" style={mono}>{formatBDT2(selectedSKU.stock_value)}</p>
                      </div>
                    </div>
                    <div className="flex justify-between mt-3 text-xs text-muted-foreground border-t border-border/30 pt-2">
                      <span>Reserved: {selectedSKU.reserved}</span>
                      <span>Available: {selectedSKU.available}</span>
                      <span>Idle: {selectedSKU.days_since_movement ?? "—"}d</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Stock Ledger Timeline */}
                <Card className="border-border/50">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-1.5">
                      <Clock className="w-4 h-4" /> Stock Ledger
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={handleExportLedgerCSV} disabled={!ledger?.length}>
                      <Download className="w-3.5 h-3.5 mr-1" /> CSV
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {ledgerLoading ? <Skeleton className="h-40" /> : (ledger || []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">No ledger entries</p>
                    ) : (
                      <div className="space-y-0">
                        {/* Header */}
                        <div className="grid grid-cols-[80px_60px_50px_50px_70px_70px_50px] gap-1 text-[10px] text-muted-foreground font-medium pb-1 border-b border-border/40 uppercase">
                          <span>Date</span>
                          <span>Type</span>
                          <span className="text-right">In</span>
                          <span className="text-right">Out</span>
                          <span className="text-right">Cost</span>
                          <span className="text-right">WAC</span>
                          <span className="text-right">Bal</span>
                        </div>
                        {(ledger || []).map((l: any) => (
                          <div key={l.id} className="grid grid-cols-[80px_60px_50px_50px_70px_70px_50px] gap-1 text-xs py-1.5 border-b border-border/10 items-center">
                            <span className="text-muted-foreground">{l.txn_date ? formatDate(l.txn_date) : "—"}</span>
                            <span>
                              <Badge variant={l.qty_in > 0 ? "default" : "secondary"} className="text-[9px] px-1">
                                {l.txn_type}
                              </Badge>
                            </span>
                            <span className="text-right text-emerald-600" style={mono}>{l.qty_in > 0 ? `+${l.qty_in}` : ""}</span>
                            <span className="text-right text-destructive" style={mono}>{l.qty_out > 0 ? `-${l.qty_out}` : ""}</span>
                            <span className="text-right text-muted-foreground" style={mono}>
                              {l.unit_cost ? formatBDT2(l.unit_cost) : "—"}
                            </span>
                            <span className="text-right" style={mono}>
                              {l.running_avg_cost ? formatBDT2(l.running_avg_cost) : "—"}
                            </span>
                            <span className={cn("text-right font-medium", l.running_balance < 0 && "text-destructive")} style={mono}>
                              {l.running_balance}
                            </span>
                          </div>
                        ))}
                        {/* Reference/note below each row */}
                        {(ledger || []).some((l: any) => l.reference_type || l.note) && (
                          <div className="mt-2 pt-2 border-t border-border/30 space-y-1">
                            {(ledger || []).filter((l: any) => l.reference_type || l.note).slice(0, 10).map((l: any) => (
                              <div key={`ref-${l.id}`} className="text-[10px] text-muted-foreground">
                                <span className="font-medium">{formatDate(l.txn_date)}</span>
                                {l.reference_type && <span className="ml-1">ref: {l.reference_type}</span>}
                                {l.note && <span className="ml-1">— {l.note}</span>}
                              </div>
                            ))}
                          </div>
                        )}
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

function KPICard({ icon: Icon, label, value, color, highlight }: {
  icon: any; label: string; value: string; color?: string; highlight?: boolean;
}) {
  return (
    <Card className={cn("border-border/50", highlight && "border-primary/30 bg-primary/5")}>
      <CardContent className="pt-3 pb-2.5">
        <div className="flex items-center gap-1.5 mb-1">
          <Icon className={cn("w-3.5 h-3.5", highlight ? "text-primary" : "text-muted-foreground")} />
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
        </div>
        <p className={cn("text-lg font-bold", color || (highlight ? "text-primary" : "text-foreground"))}
          style={{ fontFamily: "'DM Mono', monospace" }}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
