import { useState, useMemo } from "react";
import { useInventoryProducts, useCategories } from "@/hooks/use-inventory";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiCard } from "@/components/ui/kpi-card";
import { formatBDT, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Boxes, Package, AlertTriangle, XCircle, Search, SlidersHorizontal,
  Download, Upload, Pencil, History,
} from "lucide-react";
import StockAdjustmentModal from "@/components/inventory/StockAdjustmentModal";
import MovementHistory from "@/components/inventory/MovementHistory";
import ReorderSuggestions from "@/components/inventory/ReorderSuggestions";
import BulkImportModal from "@/components/inventory/BulkImportModal";

export default function InventoryPage() {
  const { data: products, isLoading } = useInventoryProducts();
  const { data: categories } = useCategories();
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name-asc");
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [adjustProductId, setAdjustProductId] = useState<string | undefined>();

  // KPIs
  const kpis = useMemo(() => {
    if (!products) return { total: 0, stockValue: 0, lowStock: 0, outOfStock: 0 };
    let stockValue = 0, lowStock = 0, outOfStock = 0;
    for (const p of products) {
      const qty = p.stock_quantity || 0;
      const cost = p.landed_cost_bdt || 0;
      stockValue += qty * cost;
      if (qty === 0) outOfStock++;
      else if (qty <= (p.reorder_point || 10)) lowStock++;
    }
    return { total: products.length, stockValue, lowStock, outOfStock };
  }, [products]);

  // Filtered & sorted
  const filtered = useMemo(() => {
    let list = products || [];
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s));
    }
    if (categoryFilter !== "all") {
      list = list.filter((p) => p.category_id === categoryFilter);
    }
    if (stockFilter === "in") list = list.filter((p) => (p.stock_quantity || 0) > (p.reorder_point || 10));
    if (stockFilter === "low") list = list.filter((p) => {
      const q = p.stock_quantity || 0;
      return q > 0 && q <= (p.reorder_point || 10);
    });
    if (stockFilter === "out") list = list.filter((p) => (p.stock_quantity || 0) === 0);

    const sorted = [...list];
    switch (sortBy) {
      case "stock-desc": sorted.sort((a, b) => (b.stock_quantity || 0) - (a.stock_quantity || 0)); break;
      case "stock-asc": sorted.sort((a, b) => (a.stock_quantity || 0) - (b.stock_quantity || 0)); break;
      case "name-asc": sorted.sort((a, b) => a.name.localeCompare(b.name)); break;
      default: break;
    }
    return sorted;
  }, [products, search, stockFilter, categoryFilter, sortBy]);

  const lowStockCount = (products || []).filter(
    (p) => (p.stock_quantity || 0) > 0 && (p.stock_quantity || 0) <= (p.reorder_point || 10)
  ).length;

  const getStockStatus = (qty: number, alert: number) => {
    if (qty === 0) return { label: "Out of Stock", color: "bg-destructive/15 text-destructive", icon: "🔴" };
    if (qty <= alert) return { label: "Low Stock", color: "bg-warning/15 text-warning", icon: "🟡" };
    return { label: "In Stock", color: "bg-success/15 text-success", icon: "🟢" };
  };

  const handleExport = () => {
    if (!products) return;
    const header = "SKU,Product Name,Category,Cost Price,Sell Price,Stock Qty,Reserved,Available,Alert Qty,Stock Value,Status\n";
    const csv = products.map((p) => {
      const qty = p.stock_quantity || 0;
      const reserved = p.reserved_quantity || 0;
      const available = qty - reserved;
      const value = qty * (p.landed_cost_bdt || 0);
      const status = getStockStatus(qty, p.reorder_point || 10).label;
      return `"${p.sku}","${p.name}","${(p.categories as any)?.name || ""}",${p.landed_cost_bdt || 0},${p.selling_price || 0},${qty},${reserved},${available},${p.reorder_point || 10},${value},"${status}"`;
    }).join("\n");
    const blob = new Blob([header + csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openAdjustFor = (productId: string) => {
    setAdjustProductId(productId);
    setAdjustOpen(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-sm text-muted-foreground">Stock levels and movements</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => { setAdjustProductId(undefined); setAdjustOpen(true); }}>
            <SlidersHorizontal className="w-4 h-4 mr-2" /> Adjust Stock
          </Button>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="w-4 h-4 mr-2" /> Import Stock
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Low Stock Banner */}
      {lowStockCount > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">
            ⚠️ {lowStockCount} product{lowStockCount > 1 ? "s are" : " is"} running low on stock!
          </span>
          <Button size="sm" variant="destructive" className="ml-auto" onClick={() => setStockFilter("low")}>
            View All
          </Button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Total Products" value={formatNumber(kpis.total)} icon={<Package className="w-5 h-5" />} loading={isLoading} />
        <KpiCard title="Total Stock Value" value={formatBDT(kpis.stockValue)} icon={<Boxes className="w-5 h-5" />} loading={isLoading} />
        <KpiCard title="Low Stock Items" value={formatNumber(kpis.lowStock)} icon={<AlertTriangle className="w-5 h-5" />} loading={isLoading} className={kpis.lowStock > 0 ? "border-warning/50" : ""} />
        <KpiCard title="Out of Stock" value={formatNumber(kpis.outOfStock)} icon={<XCircle className="w-5 h-5" />} loading={isLoading} className={kpis.outOfStock > 0 ? "border-destructive/50" : ""} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="stock" className="space-y-4">
        <TabsList>
          <TabsTrigger value="stock">📦 Stock Levels</TabsTrigger>
          <TabsTrigger value="movements">📋 Movement History</TabsTrigger>
          <TabsTrigger value="reorder">🔔 Reorder Needed</TabsTrigger>
        </TabsList>

        {/* Stock Levels Tab */}
        <TabsContent value="stock" className="space-y-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Search by name or SKU..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[160px]"><SelectValue placeholder="Category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={stockFilter} onValueChange={setStockFilter}>
                  <SelectTrigger className="w-[150px]"><SelectValue placeholder="Stock Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="in">In Stock</SelectItem>
                    <SelectItem value="low">Low Stock</SelectItem>
                    <SelectItem value="out">Out of Stock</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[160px]"><SelectValue placeholder="Sort" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name-asc">Name A-Z</SelectItem>
                    <SelectItem value="stock-desc">Stock High→Low</SelectItem>
                    <SelectItem value="stock-asc">Stock Low→High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Cost Price</TableHead>
                        <TableHead>Sell Price</TableHead>
                        <TableHead>Stock Qty</TableHead>
                        <TableHead>Reserved</TableHead>
                        <TableHead>Available</TableHead>
                        <TableHead>Alert Qty</TableHead>
                        <TableHead>Stock Value</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[80px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((p) => {
                        const qty = p.stock_quantity || 0;
                        const reserved = p.reserved_quantity || 0;
                        const available = qty - reserved;
                        const alert = p.reorder_point || 10;
                        const stockValue = qty * (p.landed_cost_bdt || 0);
                        const status = getStockStatus(qty, alert);
                        return (
                          <TableRow key={p.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                {p.image_url ? (
                                  <img src={p.image_url} alt={p.name} className="w-10 h-10 rounded-lg object-cover" />
                                ) : (
                                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground text-xs">IMG</div>
                                )}
                                <div>
                                  <p className="font-medium text-sm">{p.name}</p>
                                  <p className="text-xs text-muted-foreground">{p.sku}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">{(p.categories as any)?.name || "—"}</TableCell>
                            <TableCell className="text-sm">{formatBDT(p.landed_cost_bdt)}</TableCell>
                            <TableCell className="text-sm font-medium">{formatBDT(p.selling_price)}</TableCell>
                            <TableCell>
                              <span className={cn(
                                "font-bold",
                                qty === 0 ? "text-destructive" : qty <= alert ? "text-warning" : "text-success"
                              )}>
                                {status.icon} {qty}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm">{reserved}</TableCell>
                            <TableCell className={cn("text-sm font-medium", available <= 0 ? "text-destructive" : "")}>
                              {available}
                            </TableCell>
                            <TableCell className="text-sm">{alert}</TableCell>
                            <TableCell className="text-sm font-medium">{formatBDT(stockValue)}</TableCell>
                            <TableCell>
                              <Badge className={cn("text-xs", status.color)}>{status.label}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" title="Adjust" onClick={() => openAdjustFor(p.id)}>
                                  <Pencil className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {filtered.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={11} className="text-center text-muted-foreground py-12">No products found</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Movement History Tab */}
        <TabsContent value="movements">
          <MovementHistory products={products || []} />
        </TabsContent>

        {/* Reorder Tab */}
        <TabsContent value="reorder">
          <ReorderSuggestions products={products || []} />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <StockAdjustmentModal
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        products={products || []}
        preselectedProductId={adjustProductId}
      />
      <BulkImportModal
        open={importOpen}
        onOpenChange={setImportOpen}
        products={products || []}
      />
    </div>
  );
}
