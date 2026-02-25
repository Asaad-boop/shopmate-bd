import { useState, useMemo, useEffect, useCallback } from "react";
import { useInventoryProducts, useCategories } from "@/hooks/use-inventory";
import { useStockOnHand, type StockOnHand } from "@/hooks/use-inventory-ledger";
import { useInventoryStats, type ProductStats } from "@/hooks/use-inventory-stats";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { formatBDT, formatNumber, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Package, DollarSign, AlertTriangle, XCircle, MinusCircle,
  Search, Upload, Plus, MoreVertical,
  Pencil, History, ArrowUpDown, X, RotateCcw,
  ChevronUp, ChevronDown, ArrowUp, ArrowDown, PackageOpen, BookOpen,
} from "lucide-react";
import StockAdjustmentModal from "@/components/inventory/StockAdjustmentModal";
import StockLedgerDrawer from "@/components/inventory/StockLedgerDrawer";
import BulkImportModal from "@/components/inventory/BulkImportModal";
import InventoryBulkBar from "@/components/inventory/InventoryBulkBar";
import AddProductModal from "@/components/products/AddProductModal";
import OpeningStockModal from "@/components/inventory/OpeningStockModal";

type StockFilterType = "all" | "in" | "low" | "out" | "negative";
type SortField = "name" | "onHand" | "available" | "value" | "avgCost" | "lastMove";
type SortDir = "asc" | "desc";

const STOCK_PILLS: { value: StockFilterType; label: string; emoji: string }[] = [
  { value: "all", label: "All", emoji: "" },
  { value: "in", label: "In Stock", emoji: "🟢" },
  { value: "low", label: "Low Stock", emoji: "🟡" },
  { value: "out", label: "Out of Stock", emoji: "🔴" },
  { value: "negative", label: "Negative", emoji: "⛔" },
];

const PAGE_SIZES = [25, 50, 100];

export default function InventoryPage() {
  const { data: products, isLoading: productsLoading } = useInventoryProducts();
  const { data: categories } = useCategories();
  const { data: stockMap, isLoading: stockLoading } = useStockOnHand();
  const { data: statsMap } = useInventoryStats();
  const { toast } = useToast();
  const qc = useQueryClient();

  const isLoading = productsLoading || stockLoading;

  // Filters
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState<StockFilterType>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Sort
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Modals
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustProductId, setAdjustProductId] = useState<string | undefined>();
  const [importOpen, setImportOpen] = useState(false);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [openingStockOpen, setOpeningStockOpen] = useState(false);
  const [editProductId, setEditProductId] = useState<string | null>(null);
  const [ledgerProduct, setLedgerProduct] = useState<{ id: string; name: string; sku: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "n") { e.preventDefault(); setAddProductOpen(true); }
      if (e.ctrlKey && e.key === "f") { e.preventDefault(); document.getElementById("inv-search")?.focus(); }
      if (e.key === "Escape") { setAdjustOpen(false); setImportOpen(false); setAddProductOpen(false); setLedgerProduct(null); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Helper: get stock from ledger view
  const getStock = useCallback((productId: string): StockOnHand => {
    return stockMap?.[productId] || {
      product_id: productId, sku: null, total_physical: 0, available: 0,
      reserved: 0, in_transit: 0, damaged: 0, avg_unit_cost: 0, last_movement: null,
    };
  }, [stockMap]);

  // Classify product based on ledger-derived stock
  const classifyProduct = useCallback((productId: string, reorderPoint: number) => {
    const s = getStock(productId);
    if (s.total_physical < 0) return "negative";
    if (s.total_physical === 0) return "out";
    if (s.total_physical <= reorderPoint) return "low";
    return "in";
  }, [getStock]);

  // KPIs — derived purely from ledger
  const kpis = useMemo(() => {
    if (!products || !stockMap) return { totalSKUs: 0, totalOnHand: 0, totalValue: 0, lowStock: 0, negativeStock: 0 };
    let totalOnHand = 0, totalValue = 0, lowStock = 0, negativeStock = 0;
    for (const p of products) {
      const s = getStock(p.id);
      totalOnHand += s.total_physical;
      totalValue += s.total_physical * s.avg_unit_cost;
      const cls = classifyProduct(p.id, p.reorder_point || 10);
      if (cls === "negative") negativeStock++;
      else if (cls === "low") lowStock++;
    }
    return { totalSKUs: products.length, totalOnHand, totalValue, lowStock, negativeStock };
  }, [products, stockMap, getStock, classifyProduct]);

  // Filtered & sorted
  const filtered = useMemo(() => {
    let list = products || [];
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s));
    }
    if (categoryFilter !== "all") list = list.filter((p) => p.category_id === categoryFilter);

    if (stockFilter !== "all") {
      list = list.filter((p) => classifyProduct(p.id, p.reorder_point || 10) === stockFilter);
    }

    const sorted = [...list];
    sorted.sort((a, b) => {
      let va: number | string = 0, vb: number | string = 0;
      const sa = getStock(a.id), sb = getStock(b.id);
      switch (sortField) {
        case "name": va = a.name.toLowerCase(); vb = b.name.toLowerCase(); break;
        case "onHand": va = sa.total_physical; vb = sb.total_physical; break;
        case "available": va = sa.available; vb = sb.available; break;
        case "value": va = sa.total_physical * sa.avg_unit_cost; vb = sb.total_physical * sb.avg_unit_cost; break;
        case "avgCost": va = sa.avg_unit_cost; vb = sb.avg_unit_cost; break;
        case "lastMove": va = sa.last_movement || ""; vb = sb.last_movement || ""; break;
      }
      if (typeof va === "string") return sortDir === "asc" ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
      return sortDir === "asc" ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
    return sorted;
  }, [products, search, stockFilter, categoryFilter, sortField, sortDir, getStock, classifyProduct]);

  // Reset page on filter change
  useEffect(() => { setCurrentPage(1); }, [search, stockFilter, categoryFilter, sortField, sortDir, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  // Helpers
  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />;
  };

  const toggleSelect = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSelected = paginated.length > 0 && paginated.every((p) => selected.has(p.id));
  const toggleAll = () => {
    if (allSelected) setSelected((s) => { const n = new Set(s); paginated.forEach((p) => n.delete(p.id)); return n; });
    else setSelected((s) => { const n = new Set(s); paginated.forEach((p) => n.add(p.id)); return n; });
  };

  const hasFilters = search || stockFilter !== "all" || categoryFilter !== "all";
  const resetFilters = () => { setSearch(""); setStockFilter("all"); setCategoryFilter("all"); };

  const getStockColor = (onHand: number, reorderPoint: number) => {
    if (onHand < 0) return "text-destructive font-black";
    if (onHand === 0) return "text-destructive";
    if (onHand <= reorderPoint) return "text-warning";
    return "text-success";
  };

  // Export CSV
  const handleExport = (ids?: Set<string>) => {
    const list = ids ? (products || []).filter((p) => ids.has(p.id)) : filtered;
    if (!list.length) return;
    const header = "SKU,Product Name,Category,On Hand,Reserved,Available,Avg Cost,Stock Value,Reorder Point,Last Movement,Status\n";
    const csv = list.map((p) => {
      const s = getStock(p.id);
      const stockValue = s.total_physical * s.avg_unit_cost;
      const cls = classifyProduct(p.id, p.reorder_point || 10);
      return `"${p.sku}","${p.name}","${(p.categories as any)?.name || ""}",${s.total_physical},${s.reserved},${s.available},${s.avg_unit_cost.toFixed(2)},${stockValue.toFixed(2)},${p.reorder_point || 10},"${formatDate(s.last_movement)}","${cls}"`;
    }).join("\n");
    const blob = new Blob([header + csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: `✅ Exported ${list.length} products` });
  };

  // Delete (archive)
  const handleDelete = async (id: string) => {
    try {
      await supabase.from("products").update({ status: "inactive" }).eq("id", id);
      toast({ title: "Product archived" });
      qc.invalidateQueries({ queryKey: ["inventory-products"] });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setDeleteConfirm(null);
  };

  // Bulk archive
  const handleBulkArchive = async () => {
    try {
      for (const id of selected) {
        await supabase.from("products").update({ status: "inactive" }).eq("id", id);
      }
      toast({ title: `✅ ${selected.size} products archived` });
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["inventory-products"] });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ── HEADER ── */}
      <div className="sticky top-0 z-30 -mx-6 -mt-6 px-6 pt-4 pb-3 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">📦 Inventory Control</h1>
            <Badge variant="secondary" className="text-xs font-semibold tabular-nums">{kpis.totalSKUs} SKUs</Badge>
            <Badge variant="outline" className="text-[10px] text-muted-foreground">Ledger-Driven</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpeningStockOpen(true)} className="gap-1.5">
              <PackageOpen className="w-3.5 h-3.5" /> Opening Stock
            </Button>
            <Button variant="ghost" size="sm" onClick={() => handleExport()} className="gap-1.5">
              <Upload className="w-3.5 h-3.5" /> Export CSV
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setAdjustProductId(undefined); setAdjustOpen(true); }} className="gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5" /> Adjust Stock
            </Button>
            <Button size="sm" onClick={() => { setEditProductId(null); setAddProductOpen(true); }} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Add Product
            </Button>
          </div>
        </div>
      </div>

      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { title: "Total SKUs", value: formatNumber(kpis.totalSKUs), icon: <Package className="w-4 h-4" />, color: "text-primary bg-primary/10" },
          { title: "Total On Hand", value: formatNumber(kpis.totalOnHand), icon: <Package className="w-4 h-4" />, color: "text-success bg-success/10" },
          { title: "Inventory Value", value: formatBDT(kpis.totalValue), icon: <DollarSign className="w-4 h-4" />, color: "text-info bg-info/10" },
          { title: "Low Stock", value: formatNumber(kpis.lowStock), icon: <AlertTriangle className="w-4 h-4" />, color: "text-warning bg-warning/10", border: kpis.lowStock > 0 ? "border-warning/40" : "" },
          { title: "Negative Stock", value: formatNumber(kpis.negativeStock), icon: <MinusCircle className="w-4 h-4" />, color: kpis.negativeStock > 0 ? "text-destructive bg-destructive/10" : "text-success bg-success/10", border: kpis.negativeStock > 0 ? "border-destructive/40" : "" },
        ].map((card) => (
          <Card key={card.title} className={cn("hover:shadow-md transition-shadow cursor-default", (card as any).border)}>
            <CardContent className="p-4">
              {isLoading ? (
                <div className="space-y-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-7 w-28" /></div>
              ) : (
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{card.title}</p>
                    <p className="text-xl font-bold mt-1">{card.value}</p>
                  </div>
                  <div className={cn("p-2 rounded-lg", card.color)}>{card.icon}</div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── FILTERS ── */}
      <div className="sticky top-[65px] z-20 -mx-6 px-6 py-3 bg-background/80 backdrop-blur-xl border-b border-border/30 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input id="inv-search" placeholder="Search by name or SKU..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 h-9" />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[150px] h-9"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
            {STOCK_PILLS.map((pill) => (
              <button
                key={pill.value}
                onClick={() => setStockFilter(pill.value)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                  stockFilter === pill.value
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {pill.emoji} {pill.label}
              </button>
            ))}
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1 text-muted-foreground">
              <RotateCcw className="w-3 h-3" /> Reset
            </Button>
          )}
        </div>
        {hasFilters && (
          <div className="flex flex-wrap gap-1.5">
            {search && <Badge variant="secondary" className="gap-1 text-xs cursor-pointer" onClick={() => setSearch("")}>Search: "{search}" <X className="w-3 h-3" /></Badge>}
            {categoryFilter !== "all" && <Badge variant="secondary" className="gap-1 text-xs cursor-pointer" onClick={() => setCategoryFilter("all")}>Category: {categories?.find((c) => c.id === categoryFilter)?.name} <X className="w-3 h-3" /></Badge>}
            {stockFilter !== "all" && <Badge variant="secondary" className="gap-1 text-xs cursor-pointer" onClick={() => setStockFilter("all")}>Status: {STOCK_PILLS.find((p) => p.value === stockFilter)?.label} <X className="w-3 h-3" /></Badge>}
          </div>
        )}
      </div>

      {/* ── TABLE ── */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                  </TableHead>
                  <TableHead className="min-w-[200px] cursor-pointer" onClick={() => toggleSort("name")}>
                    <span className="flex items-center gap-1">Product <SortIcon field="name" /></span>
                  </TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("onHand")}>
                    <span className="flex items-center justify-end gap-1">On Hand <SortIcon field="onHand" /></span>
                  </TableHead>
                  <TableHead className="text-right">Reserved</TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("available")}>
                    <span className="flex items-center justify-end gap-1">Available <SortIcon field="available" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("avgCost")}>
                    <span className="flex items-center justify-end gap-1">Avg Cost <SortIcon field="avgCost" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("value")}>
                    <span className="flex items-center justify-end gap-1">Stock Value <SortIcon field="value" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => toggleSort("lastMove")}>
                    <span className="flex items-center gap-1">Last Movement <SortIcon field="lastMove" /></span>
                  </TableHead>
                  <TableHead className="text-right">Reorder Pt</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-16">
                      <div className="space-y-2">
                        <Package className="w-10 h-10 mx-auto text-muted-foreground/40" />
                        <p className="text-muted-foreground font-medium">No products found</p>
                        <p className="text-xs text-muted-foreground">Try adjusting filters or add a product</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : paginated.map((p, i) => {
                  const s = getStock(p.id);
                  const reorder = p.reorder_point || 10;
                  const stockValue = s.total_physical * s.avg_unit_cost;
                  const cls = classifyProduct(p.id, reorder);

                  return (
                    <TableRow
                      key={p.id}
                      className={cn(
                        "animate-row-in",
                        selected.has(p.id) && "bg-primary/5",
                        cls === "negative" && "bg-destructive/5"
                      )}
                      style={{ animationDelay: `${i * 20}ms` }}
                    >
                      <TableCell>
                        <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggleSelect(p.id)} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {p.image_url ? (
                            <img src={p.image_url} alt={p.name} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground text-[10px] flex-shrink-0">IMG</div>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{p.name}</p>
                            <p className="text-[11px] text-primary font-mono">{p.sku}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{(p.categories as any)?.name || "—"}</TableCell>
                      <TableCell className="text-right">
                        <span className={cn("font-bold tabular-nums", getStockColor(s.total_physical, reorder))}>{s.total_physical}</span>
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-muted-foreground">{s.reserved}</TableCell>
                      <TableCell className="text-right">
                        <span className={cn("font-medium tabular-nums text-sm", s.available <= 0 ? "text-destructive" : "")}>{s.available}</span>
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{formatBDT(s.avg_unit_cost, true)}</TableCell>
                      <TableCell className="text-right text-sm font-medium tabular-nums">{formatBDT(stockValue)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(s.last_movement)}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-muted-foreground">{reorder}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-[10px]",
                          cls === "in" ? "text-success border-success/30" :
                          cls === "low" ? "text-warning border-warning/30" :
                          cls === "out" ? "text-destructive border-destructive/30" :
                          cls === "negative" ? "text-destructive border-destructive bg-destructive/10" :
                          ""
                        )}>
                          {p.status === "inactive" ? "Inactive" : cls === "in" ? "In Stock" : cls === "low" ? "Low" : cls === "out" ? "Out" : "Negative"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-0.5">
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="SKU Ledger" onClick={() => setLedgerProduct({ id: p.id, name: p.name, sku: p.sku })}>
                            <BookOpen className="w-3.5 h-3.5" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="w-3.5 h-3.5" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setLedgerProduct({ id: p.id, name: p.name, sku: p.sku })}>📒 Open SKU Ledger</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setAdjustProductId(p.id); setAdjustOpen(true); }}>⚖️ Adjust Stock</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setEditProductId(p.id); setAddProductOpen(true); }}>✏️ Edit Product</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteConfirm(p.id)}>🗑️ Archive</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t">
            <div className="flex items-center gap-3">
              <p className="text-sm text-muted-foreground">
                {filtered.length > 0 ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filtered.length)} of ${filtered.length}` : "0 results"}
              </p>
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                <SelectTrigger className="w-[80px] h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((s) => <SelectItem key={s} value={String(s)}>{s}/page</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>
                <ChevronUp className="w-4 h-4 rotate-[-90deg]" />
              </Button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let page: number;
                if (totalPages <= 7) page = i + 1;
                else if (currentPage <= 4) page = i + 1;
                else if (currentPage >= totalPages - 3) page = totalPages - 6 + i;
                else page = currentPage - 3 + i;
                return (
                  <Button key={page} variant={currentPage === page ? "default" : "outline"} size="sm" className="w-8 h-8 p-0" onClick={() => setCurrentPage(page)}>
                    {page}
                  </Button>
                );
              })}
              <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
                <ChevronDown className="w-4 h-4 rotate-[-90deg]" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* ── BULK ACTIONS BAR ── */}
      <InventoryBulkBar
        count={selected.size}
        onDismiss={() => setSelected(new Set())}
        onExport={() => handleExport(selected)}
        onArchive={handleBulkArchive}
        onDelete={handleBulkArchive}
      />

      {/* ── MODALS ── */}
      <StockAdjustmentModal
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        products={products || []}
        preselectedProductId={adjustProductId}
      />
      <BulkImportModal open={importOpen} onOpenChange={setImportOpen} products={products || []} />
      <AddProductModal open={addProductOpen} onOpenChange={setAddProductOpen} editProductId={editProductId} />
      <StockLedgerDrawer open={!!ledgerProduct} onOpenChange={(o) => { if (!o) setLedgerProduct(null); }} product={ledgerProduct} />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(o) => { if (!o) setDeleteConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this product?</AlertDialogTitle>
            <AlertDialogDescription>This will mark the product as inactive. It won't appear in inventory or order forms.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirm && handleDelete(deleteConfirm)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <OpeningStockModal open={openingStockOpen} onOpenChange={setOpeningStockOpen} products={products || []} />
    </div>
  );
}
