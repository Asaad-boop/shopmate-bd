import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, ArrowUpDown, Upload, FileBarChart, ChevronDown, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type StockFilterType = "all" | "in" | "low" | "out" | "negative" | "damaged";

const STOCK_PILLS: { value: StockFilterType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "low", label: "Low Stock" },
  { value: "out", label: "Out of Stock" },
  { value: "negative", label: "Negative" },
  { value: "damaged", label: "Damaged" },
];

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  stockFilter: StockFilterType;
  onStockFilterChange: (v: StockFilterType) => void;
  categoryFilter: string;
  onCategoryFilterChange: (v: string) => void;
  categories: { id: string; name: string }[];
  selectedCount: number;
  onAddProduct: () => void;
  onAdjustStock: () => void;
  onImportCSV: () => void;
  onExport: () => void;
  onOpeningStock: () => void;
  onBulkAdjust: () => void;
  onBulkArchive: () => void;
  onBulkExport: () => void;
}

export default function InventoryHeader({
  search, onSearchChange, stockFilter, onStockFilterChange,
  categoryFilter, onCategoryFilterChange, categories,
  selectedCount, onAddProduct, onAdjustStock, onImportCSV, onExport, onOpeningStock,
  onBulkAdjust, onBulkArchive, onBulkExport,
}: Props) {
  const hasFilters = search || stockFilter !== "all" || categoryFilter !== "all";

  return (
    <div className="sticky top-0 z-30 -mx-6 px-6 pt-4 pb-3 bg-background/80 backdrop-blur-xl border-b border-border/40 space-y-3">
      {/* Row 1: Search + Actions */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            id="inv-search"
            placeholder="Search SKU, product name, barcode..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 h-9 rounded-lg"
          />
        </div>

        {/* Filter pills */}
        <Select value={categoryFilter} onValueChange={onCategoryFilterChange}>
          <SelectTrigger className="w-[140px] h-9 rounded-lg">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action buttons */}
        <Button size="sm" onClick={onAddProduct} className="gap-1.5 rounded-lg">
          <Plus className="w-3.5 h-3.5" /> Add Product
        </Button>
        <Button size="sm" variant="secondary" onClick={onAdjustStock} className="gap-1.5 rounded-lg">
          <ArrowUpDown className="w-3.5 h-3.5" /> Stock Adjustment
        </Button>
        <Button size="sm" variant="outline" onClick={onImportCSV} className="gap-1.5 rounded-lg">
          <Upload className="w-3.5 h-3.5" /> Import CSV
        </Button>
        <Button size="sm" variant="ghost" onClick={onExport} className="gap-1.5 rounded-lg">
          <FileBarChart className="w-3.5 h-3.5" /> Report
        </Button>

        {/* Bulk actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" disabled={selectedCount === 0} className="gap-1.5 rounded-lg">
              Bulk <ChevronDown className="w-3 h-3" />
              {selectedCount > 0 && (
                <Badge className="ml-1 h-5 min-w-[20px] rounded-full text-[10px] bg-primary text-primary-foreground">
                  {selectedCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onBulkAdjust}>Bulk Adjust</DropdownMenuItem>
            <DropdownMenuItem onClick={onBulkExport}>Export Selected</DropdownMenuItem>
            <DropdownMenuItem onClick={onBulkArchive} className="text-destructive">Archive Selected</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Row 2: Stock filter pills */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-0.5 bg-muted/50 rounded-lg p-0.5">
          {STOCK_PILLS.map((pill) => (
            <button
              key={pill.value}
              onClick={() => onStockFilterChange(pill.value)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150",
                stockFilter === pill.value
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {hasFilters && (
          <>
            <div className="h-4 w-px bg-border" />
            <div className="flex flex-wrap gap-1.5">
              {search && (
                <Badge variant="secondary" className="gap-1 text-xs cursor-pointer hover:bg-muted" onClick={() => onSearchChange("")}>
                  Search: "{search}" <X className="w-3 h-3" />
                </Badge>
              )}
              {categoryFilter !== "all" && (
                <Badge variant="secondary" className="gap-1 text-xs cursor-pointer hover:bg-muted" onClick={() => onCategoryFilterChange("all")}>
                  {categories.find((c) => c.id === categoryFilter)?.name} <X className="w-3 h-3" />
                </Badge>
              )}
              {stockFilter !== "all" && (
                <Badge variant="secondary" className="gap-1 text-xs cursor-pointer hover:bg-muted" onClick={() => onStockFilterChange("all")}>
                  {STOCK_PILLS.find((p) => p.value === stockFilter)?.label} <X className="w-3 h-3" />
                </Badge>
              )}
            </div>
            <button onClick={() => { onSearchChange(""); onStockFilterChange("all"); onCategoryFilterChange("all"); }}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
              <RotateCcw className="w-3 h-3" /> Clear
            </button>
          </>
        )}
      </div>
    </div>
  );
}
