import { useState, useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatBDT, formatDate } from "@/lib/format";
import { MoreVertical, BookOpen, ArrowUp, ArrowDown, ArrowUpDown, Package, ChevronRight } from "lucide-react";
import type { StockOnHand } from "@/hooks/use-inventory-ledger";
import InventoryRowExpander from "./InventoryRowExpander";

export type SortField = "name" | "onHand" | "available" | "value" | "avgCost" | "lastMove";
export type SortDir = "asc" | "desc";

interface Product {
  id: string;
  name: string;
  sku: string;
  image_url?: string | null;
  purchase_price?: number | null;
  selling_price?: number | null;
  reorder_point?: number | null;
  categories?: { name: string } | null;
}

interface Props {
  products: Product[];
  loading: boolean;
  getStock: (id: string) => StockOnHand;
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleAll: () => void;
  allSelected: boolean;
  sortField: SortField;
  sortDir: SortDir;
  onToggleSort: (field: SortField) => void;
  onOpenLedger: (p: { id: string; name: string; sku: string }) => void;
  onAdjustStock: (id: string) => void;
  onEditProduct: (id: string) => void;
  onArchiveProduct: (id: string) => void;
}

function getStatusBadge(available: number, totalPhysical: number, reorder: number) {
  if (totalPhysical < 0) return { label: "Negative", cls: "bg-destructive/10 text-destructive border-destructive/20" };
  if (available <= 0) return { label: "Out of Stock", cls: "bg-destructive/10 text-destructive border-destructive/20" };
  if (available < reorder) return { label: "Low Stock", cls: "bg-warning/10 text-warning border-warning/20" };
  return { label: "Healthy", cls: "bg-success/10 text-success border-success/20" };
}

export default function InventoryTable({
  products, loading, getStock, selected, onToggleSelect, onToggleAll, allSelected,
  sortField, sortDir, onToggleSort,
  onOpenLedger, onAdjustStock, onEditProduct, onArchiveProduct,
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const SortIcon = useCallback(({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortDir === "asc"
      ? <ArrowUp className="w-3 h-3 text-primary" />
      : <ArrowDown className="w-3 h-3 text-primary" />;
  }, [sortField, sortDir]);

  const SortableHead = useCallback(({ field, children, align }: { field: SortField; children: React.ReactNode; align?: "right" }) => (
    <TableHead
      className={cn("cursor-pointer select-none", align === "right" && "text-right")}
      onClick={() => onToggleSort(field)}
    >
      <span className={cn("flex items-center gap-1", align === "right" && "justify-end")}>
        {children} <SortIcon field={field} />
      </span>
    </TableHead>
  ), [onToggleSort, SortIcon]);

  if (loading) {
    return (
      <div className="space-y-1.5">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[40px]">
                <Checkbox checked={allSelected} onCheckedChange={onToggleAll} />
              </TableHead>
              <TableHead className="w-[36px]" />
              <SortableHead field="name">Product</SortableHead>
              <TableHead className="text-right">Purchase</TableHead>
              <TableHead className="text-right">Selling</TableHead>
              <SortableHead field="onHand" align="right">On Hand</SortableHead>
              <TableHead className="text-right">Reserved</TableHead>
              <SortableHead field="available" align="right">Available</SortableHead>
              <TableHead className="text-right">In Transit</TableHead>
              <TableHead className="text-right">Damaged</TableHead>
              <TableHead className="text-right">Reorder Lvl</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[80px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} className="text-center py-20">
                  <div className="space-y-3">
                    <Package className="w-10 h-10 mx-auto text-muted-foreground/30" />
                    <p className="text-muted-foreground font-medium">No products found</p>
                    <p className="text-xs text-muted-foreground">Try adjusting your filters</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : products.map((p, i) => {
              const s = getStock(p.id);
              const reorder = p.reorder_point || 10;
              const status = getStatusBadge(s.available, s.total_physical, reorder);
              const isExpanded = expandedId === p.id;
              const isSelected = selected.has(p.id);

              return (
                <InventoryRowGroup
                  key={p.id}
                  product={p}
                  stock={s}
                  reorder={reorder}
                  status={status}
                  index={i}
                  isExpanded={isExpanded}
                  isSelected={isSelected}
                  onToggleExpand={() => setExpandedId(isExpanded ? null : p.id)}
                  onToggleSelect={() => onToggleSelect(p.id)}
                  onOpenLedger={() => onOpenLedger({ id: p.id, name: p.name, sku: p.sku })}
                  onAdjustStock={() => onAdjustStock(p.id)}
                  onEditProduct={() => onEditProduct(p.id)}
                  onArchiveProduct={() => onArchiveProduct(p.id)}
                />
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/* Row + Expander group */
function InventoryRowGroup({
  product: p, stock: s, reorder, status, index, isExpanded, isSelected,
  onToggleExpand, onToggleSelect, onOpenLedger, onAdjustStock, onEditProduct, onArchiveProduct,
}: {
  product: any; stock: StockOnHand; reorder: number;
  status: { label: string; cls: string }; index: number;
  isExpanded: boolean; isSelected: boolean;
  onToggleExpand: () => void; onToggleSelect: () => void;
  onOpenLedger: () => void; onAdjustStock: () => void;
  onEditProduct: () => void; onArchiveProduct: () => void;
}) {
  return (
    <>
      <TableRow
        className={cn(
          "animate-row-in group/row cursor-pointer",
          isSelected && "bg-primary/5",
          s.total_physical < 0 && "bg-destructive/3"
        )}
        style={{ animationDelay: `${Math.min(index * 15, 300)}ms` }}
        onClick={onToggleExpand}
      >
        <TableCell onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={isSelected} onCheckedChange={onToggleSelect} />
        </TableCell>
        <TableCell>
          {p.image_url ? (
            <img src={p.image_url} alt="" className="w-8 h-8 rounded-md object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center">
              <Package className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
          )}
        </TableCell>
        <TableCell>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate max-w-[220px]">{p.name}</p>
            <p className="text-[11px] text-muted-foreground font-mono">{p.sku}</p>
          </div>
        </TableCell>
        <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
          {formatBDT(p.purchase_price || s.avg_unit_cost, true)}
        </TableCell>
        <TableCell className="text-right text-sm tabular-nums">
          {formatBDT(p.selling_price, true)}
        </TableCell>
        <TableCell className="text-right">
          <span className={cn(
            "font-bold tabular-nums text-sm",
            s.total_physical < 0 && "text-destructive",
            s.total_physical === 0 && "text-destructive",
            s.total_physical > 0 && s.total_physical <= reorder && "text-warning",
            s.total_physical > reorder && "text-success",
          )}>
            {s.total_physical}
          </span>
        </TableCell>
        <TableCell className="text-right">
          {s.reserved > 0 ? (
            <Badge variant="outline" className="text-[10px] border-info/30 text-info tabular-nums">{s.reserved}</Badge>
          ) : (
            <span className="text-sm text-muted-foreground tabular-nums">0</span>
          )}
        </TableCell>
        <TableCell className="text-right">
          <span className={cn("font-semibold text-sm tabular-nums", s.available > 0 ? "text-success" : "text-destructive")}>
            {s.available}
          </span>
        </TableCell>
        <TableCell className="text-right">
          {s.in_transit > 0 ? (
            <Badge variant="outline" className="text-[10px] border-info/30 text-info tabular-nums">{s.in_transit}</Badge>
          ) : (
            <span className="text-sm text-muted-foreground tabular-nums">0</span>
          )}
        </TableCell>
        <TableCell className="text-right">
          {s.damaged > 0 ? (
            <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive tabular-nums">{s.damaged}</Badge>
          ) : (
            <span className="text-sm text-muted-foreground tabular-nums">0</span>
          )}
        </TableCell>
        <TableCell className="text-right text-sm tabular-nums text-muted-foreground">{reorder}</TableCell>
        <TableCell>
          <Badge variant="outline" className={cn("text-[10px] font-medium", status.cls)}>
            {status.label}
          </Badge>
        </TableCell>
        <TableCell onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-0.5">
            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover/row:opacity-100 transition-opacity" onClick={onOpenLedger}>
              <BookOpen className="w-3.5 h-3.5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreVertical className="w-3.5 h-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={onOpenLedger}>
                  <BookOpen className="w-3.5 h-3.5 mr-2" /> SKU Ledger
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onAdjustStock}>
                  <ArrowUpDown className="w-3.5 h-3.5 mr-2" /> Adjust Stock
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onEditProduct}>
                  Edit Product
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onArchiveProduct} className="text-destructive">
                  Archive
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <ChevronRight className={cn(
              "w-3.5 h-3.5 text-muted-foreground transition-transform duration-150",
              isExpanded && "rotate-90"
            )} />
          </div>
        </TableCell>
      </TableRow>

      {/* Expandable drawer row */}
      {isExpanded && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={13} className="p-0">
            <InventoryRowExpander productId={p.id} productName={p.name} stock={s} sellingPrice={p.selling_price} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
