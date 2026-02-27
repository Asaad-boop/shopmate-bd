import { useState, useMemo, useCallback } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  MoreHorizontal, Eye, Truck, Printer, Copy, ArrowUpDown, ArrowUp, ArrowDown,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type MockOrder, STATUS_CONFIG } from "./order-list-data";

interface Props {
  orders: MockOrder[];
  loading: boolean;
  density: "comfortable" | "compact";
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onOpenDetail: (order: MockOrder) => void;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
}

type SortKey = "date" | "amount" | "status" | null;
type SortDir = "asc" | "desc";

export function OrderListTable({
  orders, loading, density, selectedIds, onSelectionChange, onOpenDetail,
  pageSize, onPageSizeChange,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sorted = useMemo(() => {
    if (!sortKey) return orders;
    return [...orders].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "amount") cmp = a.amount - b.amount;
      if (sortKey === "date") cmp = a.invoiceId.localeCompare(b.invoiceId);
      if (sortKey === "status") cmp = a.status.localeCompare(b.status);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [orders, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / pageSize);
  const paginated = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const allSelected = paginated.length > 0 && paginated.every(o => selectedIds.has(o.id));
  const someSelected = paginated.some(o => selectedIds.has(o.id)) && !allSelected;

  const toggleAll = useCallback(() => {
    const next = new Set(selectedIds);
    if (allSelected) {
      paginated.forEach(o => next.delete(o.id));
    } else {
      paginated.forEach(o => next.add(o.id));
    }
    onSelectionChange(next);
  }, [allSelected, paginated, selectedIds, onSelectionChange]);

  const toggleOne = useCallback((id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    onSelectionChange(next);
  }, [selectedIds, onSelectionChange]);

  const cellPy = density === "compact" ? "py-1.5" : "py-2.5";
  const textSize = density === "compact" ? "text-[11px]" : "text-xs";

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
    return sortDir === "asc"
      ? <ArrowUp className="w-3 h-3 ml-1 text-primary" />
      : <ArrowDown className="w-3 h-3 ml-1 text-primary" />;
  };

  if (loading) {
    return (
      <div className="px-6 py-4 space-y-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
            <TableRow className="hover:bg-transparent border-b border-border">
              <TableHead className="w-10 px-3">
                <Checkbox
                  checked={allSelected}
                  // @ts-ignore
                  indeterminate={someSelected}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead className={cn("w-[130px]", textSize)}>
                <button className="flex items-center font-bold" onClick={() => toggleSort("date")}>
                  Date <SortIcon col="date" />
                </button>
              </TableHead>
              <TableHead className={cn("w-[100px]", textSize)}>
                <button className="flex items-center font-bold" onClick={() => toggleSort("status")}>
                  Status <SortIcon col="status" />
                </button>
              </TableHead>
              <TableHead className={cn("w-[130px]", textSize, "font-bold")}>Invoice</TableHead>
              <TableHead className={cn("w-[180px]", textSize, "font-bold")}>Customer</TableHead>
              <TableHead className={cn("w-[200px]", textSize, "font-bold hidden lg:table-cell")}>Address</TableHead>
              <TableHead className={cn("w-[120px]", textSize, "font-bold hidden md:table-cell")}>Items</TableHead>
              <TableHead className={cn("w-[110px]", textSize)}>
                <button className="flex items-center font-bold" onClick={() => toggleSort("amount")}>
                  Amount <SortIcon col="amount" />
                </button>
              </TableHead>
              <TableHead className={cn("w-[130px]", textSize, "font-bold hidden xl:table-cell")}>Courier</TableHead>
              <TableHead className={cn("w-[80px]", textSize, "font-bold hidden xl:table-cell")}>Staff</TableHead>
              <TableHead className={cn("w-[50px]", textSize, "font-bold hidden md:table-cell")}>Age</TableHead>
              <TableHead className={cn("w-[60px]", textSize, "font-bold hidden lg:table-cell")}>Risk</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} className="text-center py-16 text-muted-foreground">
                  No orders found
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((order, idx) => {
                const isSelected = selectedIds.has(order.id);
                const statusCfg = STATUS_CONFIG[order.status];
                return (
                  <TableRow
                    key={order.id}
                    className={cn(
                      "group transition-colors duration-100",
                      isSelected && "bg-primary/5 dark:bg-primary/10",
                    )}
                    style={{ animationDelay: `${idx * 15}ms` }}
                  >
                    {/* Checkbox */}
                    <TableCell className={cn("px-3", cellPy)}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleOne(order.id)}
                      />
                    </TableCell>

                    {/* Date */}
                    <TableCell className={cn(cellPy, textSize)}>
                      <span className="font-medium text-foreground">{order.date.replace(" 2026", "")}</span>
                      <br />
                      <span className="text-muted-foreground text-[10px]">{order.time}</span>
                    </TableCell>

                    {/* Status */}
                    <TableCell className={cn(cellPy)}>
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold",
                        statusCfg.color
                      )}>
                        <span className={cn("w-1.5 h-1.5 rounded-full", statusCfg.dotColor)} />
                        {statusCfg.label}
                      </span>
                    </TableCell>

                    {/* Invoice */}
                    <TableCell className={cn(cellPy, textSize)}>
                      <button
                        onClick={() => onOpenDetail(order)}
                        className="font-bold text-primary hover:underline underline-offset-2"
                      >
                        {order.invoiceId}
                      </button>
                    </TableCell>

                    {/* Customer */}
                    <TableCell className={cn(cellPy, textSize)}>
                      <span className="font-semibold text-foreground block truncate max-w-[160px]">
                        {order.customerName}
                      </span>
                      <span className="text-muted-foreground text-[10px] block">{order.customerPhone}</span>
                      <span className="text-muted-foreground text-[10px] block">{order.city} • {order.area}</span>
                    </TableCell>

                    {/* Address */}
                    <TableCell className={cn(cellPy, textSize, "hidden lg:table-cell")}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-muted-foreground line-clamp-2 max-w-[180px] cursor-default">
                            {order.address}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">{order.address}</TooltipContent>
                      </Tooltip>
                    </TableCell>

                    {/* Items */}
                    <TableCell className={cn(cellPy, textSize, "hidden md:table-cell")}>
                      <span className="font-medium">{order.itemCount} item{order.itemCount > 1 ? "s" : ""}</span>
                      <br />
                      <span className="text-muted-foreground text-[10px] line-clamp-1 max-w-[110px]">
                        {order.items[0]?.sku}
                        {order.items.length > 1 && ` +${order.items.length - 1}`}
                      </span>
                    </TableCell>

                    {/* Amount */}
                    <TableCell className={cn(cellPy, textSize, "tabular-nums")}>
                      <span className="font-bold text-foreground">৳{order.amount.toLocaleString()}</span>
                      {order.shipping > 0 && (
                        <span className="text-muted-foreground text-[10px] block">+৳{order.shipping} ship</span>
                      )}
                    </TableCell>

                    {/* Courier */}
                    <TableCell className={cn(cellPy, textSize, "hidden xl:table-cell")}>
                      {order.courier ? (
                        <>
                          <span className="font-medium">{order.courier}</span>
                          {order.trackingId && (
                            <span className="text-[10px] font-mono text-muted-foreground block truncate max-w-[110px]">
                              {order.trackingId}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    {/* Staff */}
                    <TableCell className={cn(cellPy, textSize, "hidden xl:table-cell text-muted-foreground")}>
                      {order.assignedTo}
                    </TableCell>

                    {/* Age */}
                    <TableCell className={cn(cellPy, textSize, "hidden md:table-cell text-muted-foreground font-medium")}>
                      {order.age}
                    </TableCell>

                    {/* Risk */}
                    <TableCell className={cn(cellPy, "hidden lg:table-cell")}>
                      <span className={cn(
                        "inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold",
                        order.risk === "high" && "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
                        order.risk === "medium" && "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
                        order.risk === "low" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
                      )}>
                        {order.risk}
                      </span>
                    </TableCell>

                    {/* Actions */}
                    <TableCell className={cn(cellPy)}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted">
                            <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => onOpenDetail(order)}>
                            <Eye className="w-3.5 h-3.5 mr-2" /> View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Copy className="w-3.5 h-3.5 mr-2" /> Copy Invoice
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem>
                            <Truck className="w-3.5 h-3.5 mr-2" /> Assign Courier
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Printer className="w-3.5 h-3.5 mr-2" /> Print Invoice
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between px-6 py-2.5 border-t border-border bg-card">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Rows:</span>
          {[25, 50, 100].map(n => (
            <button
              key={n}
              onClick={() => { onPageSizeChange(n); setPage(0); }}
              className={cn(
                "px-2 py-0.5 rounded font-medium transition-colors",
                pageSize === n ? "bg-primary/10 text-primary" : "hover:bg-muted"
              )}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {page * pageSize + 1}–{Math.min((page + 1) * pageSize, sorted.length)} of {sorted.length}
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
