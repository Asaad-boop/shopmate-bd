import { useState, useMemo, useEffect, useCallback } from "react";
import { usePageTitle } from "@/hooks/use-page-title";
import { useInventoryProducts, useCategories } from "@/hooks/use-inventory";
import { useStockOnHand, type StockOnHand } from "@/hooks/use-inventory-ledger";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { formatBDT, formatDate } from "@/lib/format";

import InventoryHeader, { type StockFilterType } from "@/components/inventory/InventoryHeader";
import InventoryKPICards from "@/components/inventory/InventoryKPICards";
import InventoryTable, { type SortField, type SortDir } from "@/components/inventory/InventoryTable";
import InventoryPagination from "@/components/inventory/InventoryPagination";
import InventoryBulkBar from "@/components/inventory/InventoryBulkBar";
import StockAdjustmentModal from "@/components/inventory/StockAdjustmentModal";
import StockLedgerDrawer from "@/components/inventory/StockLedgerDrawer";
import BulkImportModal from "@/components/inventory/BulkImportModal";
import AddProductModal from "@/components/products/AddProductModal";
import OpeningStockModal from "@/components/inventory/OpeningStockModal";

export default function InventoryPage() {
  const { data: products, isLoading: productsLoading } = useInventoryProducts();
  const { data: categories } = useCategories();
  const { data: stockMap, isLoading: stockLoading } = useStockOnHand();
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

  const getStock = useCallback((productId: string): StockOnHand => {
    return stockMap?.[productId] || {
      product_id: productId, sku: null, total_physical: 0, available: 0,
      reserved: 0, in_transit: 0, damaged: 0, avg_unit_cost: 0, last_movement: null,
    };
  }, [stockMap]);

  const classifyProduct = useCallback((productId: string, reorderPoint: number) => {
    const s = getStock(productId);
    if (s.total_physical < 0) return "negative";
    if (s.total_physical === 0) return "out";
    if (s.damaged > 0) return "damaged";
    if (s.total_physical <= reorderPoint) return "low";
    return "in";
  }, [getStock]);

  // KPIs
  const kpis = useMemo(() => {
    if (!products || !stockMap) return { totalSKUs: 0, totalValue: 0, lowStock: 0, reservedQty: 0, netAvailable: 0, damagedQty: 0 };
    let totalValue = 0, lowStock = 0, reservedQty = 0, netAvailable = 0, damagedQty = 0;
    for (const p of products) {
      const s = getStock(p.id);
      totalValue += s.total_physical * s.avg_unit_cost;
      reservedQty += s.reserved;
      netAvailable += s.available;
      damagedQty += s.damaged;
      const cls = classifyProduct(p.id, p.reorder_point || 10);
      if (cls === "low") lowStock++;
    }
    return { totalSKUs: products.length, totalValue, lowStock, reservedQty, netAvailable, damagedQty };
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

  useEffect(() => { setCurrentPage(1); }, [search, stockFilter, categoryFilter, sortField, sortDir, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  // Selection helpers
  const toggleSelect = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSelected = paginated.length > 0 && paginated.every((p) => selected.has(p.id));
  const toggleAll = () => {
    if (allSelected) setSelected((s) => { const n = new Set(s); paginated.forEach((p) => n.delete(p.id)); return n; });
    else setSelected((s) => { const n = new Set(s); paginated.forEach((p) => n.add(p.id)); return n; });
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  // Export
  const handleExport = (ids?: Set<string>) => {
    const list = ids ? (products || []).filter((p) => ids.has(p.id)) : filtered;
    if (!list.length) return;
    const header = "SKU,Product Name,On Hand,Reserved,Available,In Transit,Damaged,Avg Cost,Stock Value,Status\n";
    const csv = list.map((p) => {
      const s = getStock(p.id);
      const cls = classifyProduct(p.id, p.reorder_point || 10);
      return `"${p.sku}","${p.name}",${s.total_physical},${s.reserved},${s.available},${s.in_transit},${s.damaged},${s.avg_unit_cost.toFixed(2)},${(s.total_physical * s.avg_unit_cost).toFixed(2)},"${cls}"`;
    }).join("\n");
    const blob = new Blob([header + csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: `✅ Exported ${list.length} products` });
  };

  // Delete/Archive
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
    <div className="space-y-4 animate-fade-in">
      {/* Sticky Header */}
      <InventoryHeader
        search={search}
        onSearchChange={setSearch}
        stockFilter={stockFilter}
        onStockFilterChange={setStockFilter}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
        categories={(categories || []).map((c) => ({ id: c.id, name: c.name }))}
        selectedCount={selected.size}
        onAddProduct={() => { setEditProductId(null); setAddProductOpen(true); }}
        onAdjustStock={() => { setAdjustProductId(undefined); setAdjustOpen(true); }}
        onImportCSV={() => setImportOpen(true)}
        onExport={() => handleExport()}
        onOpeningStock={() => setOpeningStockOpen(true)}
        onBulkAdjust={() => { setAdjustProductId(undefined); setAdjustOpen(true); }}
        onBulkArchive={handleBulkArchive}
        onBulkExport={() => handleExport(selected)}
      />

      {/* KPI Cards */}
      <InventoryKPICards kpis={kpis} loading={isLoading} />

      {/* Main Table */}
      <InventoryTable
        products={paginated}
        loading={isLoading}
        getStock={getStock}
        selected={selected}
        onToggleSelect={toggleSelect}
        onToggleAll={toggleAll}
        allSelected={allSelected}
        sortField={sortField}
        sortDir={sortDir}
        onToggleSort={toggleSort}
        onOpenLedger={(p) => setLedgerProduct(p)}
        onAdjustStock={(id) => { setAdjustProductId(id); setAdjustOpen(true); }}
        onEditProduct={(id) => { setEditProductId(id); setAddProductOpen(true); }}
        onArchiveProduct={(id) => setDeleteConfirm(id)}
      />

      {/* Pagination */}
      {!isLoading && filtered.length > 0 && (
        <InventoryPagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={filtered.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      )}

      {/* Bulk Actions Bar */}
      <InventoryBulkBar
        count={selected.size}
        onDismiss={() => setSelected(new Set())}
        onExport={() => handleExport(selected)}
        onArchive={handleBulkArchive}
        onDelete={handleBulkArchive}
      />

      {/* Modals */}
      <StockAdjustmentModal open={adjustOpen} onOpenChange={setAdjustOpen} products={products || []} preselectedProductId={adjustProductId} />
      <BulkImportModal open={importOpen} onOpenChange={setImportOpen} products={products || []} />
      <AddProductModal open={addProductOpen} onOpenChange={setAddProductOpen} editProductId={editProductId} />
      <StockLedgerDrawer open={!!ledgerProduct} onOpenChange={(o) => { if (!o) setLedgerProduct(null); }} product={ledgerProduct} />
      <OpeningStockModal open={openingStockOpen} onOpenChange={setOpeningStockOpen} products={products || []} />

      <AlertDialog open={!!deleteConfirm} onOpenChange={(o) => { if (!o) setDeleteConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this product?</AlertDialogTitle>
            <AlertDialogDescription>It will be marked inactive and hidden from inventory.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirm && handleDelete(deleteConfirm)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
