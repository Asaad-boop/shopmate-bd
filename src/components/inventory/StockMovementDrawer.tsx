import { useState } from "react";
import { useInventoryMovements } from "@/hooks/use-inventory";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Download, ArrowUpCircle, ArrowDownCircle, ArrowRightCircle } from "lucide-react";

const MOVEMENT_CFG: Record<string, { label: string; color: string; icon: typeof ArrowUpCircle }> = {
  order_pending: { label: "Order Placed", color: "text-destructive", icon: ArrowDownCircle },
  order_cancelled: { label: "Order Cancelled", color: "text-success", icon: ArrowUpCircle },
  order_returned: { label: "Order Returned", color: "text-success", icon: ArrowUpCircle },
  damage_return: { label: "Damage Return", color: "text-muted-foreground", icon: ArrowDownCircle },
  manual_adjustment: { label: "Manual Adjustment", color: "text-info", icon: ArrowRightCircle },
  purchase_received: { label: "Purchase Received", color: "text-primary", icon: ArrowUpCircle },
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: any;
}

export default function StockMovementDrawer({ open, onOpenChange, product }: Props) {
  const { data: movements, isLoading } = useInventoryMovements(product?.id);

  const handleExport = () => {
    if (!movements) return;
    const header = "Date,Type,Qty,Notes,Staff\n";
    const csv = movements.map((m: any) => {
      const cfg = MOVEMENT_CFG[m.movement_type] || { label: m.movement_type };
      return `"${formatDateTime(m.created_at)}","${cfg.label}",${m.quantity},"${m.notes || ""}","${(m.staff as any)?.full_name || ""}"`;
    }).join("\n");
    const blob = new Blob([header + csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stock-history-${product?.sku || "product"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg w-full p-0">
        <SheetHeader className="px-6 py-5 border-b">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="text-lg">📊 Stock History</SheetTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                {product?.name} <span className="text-primary">({product?.sku})</span>
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleExport} className="gap-1.5">
              <Download className="w-3.5 h-3.5" /> Export
            </Button>
          </div>
        </SheetHeader>

        <div className="overflow-y-auto p-6" style={{ maxHeight: "calc(100vh - 100px)" }}>
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : !movements || movements.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-sm">No stock movements recorded yet.</p>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />

              <div className="space-y-1">
                {movements.map((m: any, i: number) => {
                  const cfg = MOVEMENT_CFG[m.movement_type] || {
                    label: m.movement_type,
                    color: "text-muted-foreground",
                    icon: ArrowRightCircle,
                  };
                  const Icon = cfg.icon;
                  const isPositive = m.quantity > 0;

                  return (
                    <div key={m.id} className="relative pl-10 py-3 animate-row-in" style={{ animationDelay: `${i * 40}ms` }}>
                      <div className={cn("absolute left-1.5 top-4 w-5 h-5 rounded-full flex items-center justify-center bg-card border-2", cfg.color, "border-current")}>
                        <Icon className="w-3 h-3" />
                      </div>

                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className={cn("text-[10px] font-semibold", cfg.color)}>
                              {cfg.label}
                            </Badge>
                            <span className={cn(
                              "text-sm font-bold tabular-nums",
                              isPositive ? "text-success" : "text-destructive"
                            )}>
                              {isPositive ? `+${m.quantity}` : m.quantity}
                            </span>
                          </div>
                          {m.notes && (
                            <p className="text-xs text-muted-foreground mt-1 truncate">{m.notes}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[11px] text-muted-foreground whitespace-nowrap">{formatDateTime(m.created_at)}</p>
                          {(m.staff as any)?.full_name && (
                            <p className="text-[10px] text-muted-foreground/70">{(m.staff as any).full_name}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
