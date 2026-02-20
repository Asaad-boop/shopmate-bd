import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getStockImpact, type StockImpact } from "@/hooks/use-orders";
import { Package, ArrowDown, ArrowUp, AlertTriangle, CheckCircle, Truck, XCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: string;
  newStatus: string;
  newStatusLabel: string;
  onConfirm: () => void;
  loading?: boolean;
}

const statusIcons: Record<string, { icon: typeof Package; color: string; bg: string }> = {
  packed: { icon: Package, color: "text-blue-600", bg: "bg-blue-100" },
  shipped: { icon: Truck, color: "text-indigo-600", bg: "bg-indigo-100" },
  delivered: { icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-100" },
  cancelled: { icon: XCircle, color: "text-red-600", bg: "bg-red-100" },
  returned: { icon: ArrowUp, color: "text-amber-600", bg: "bg-amber-100" },
};

export function StatusChangeModal({ open, onOpenChange, orderId, orderNumber, newStatus, newStatusLabel, onConfirm, loading }: Props) {
  const [impacts, setImpacts] = useState<StockImpact[]>([]);
  const [loadingImpact, setLoadingImpact] = useState(false);

  useEffect(() => {
    if (open && orderId) {
      setLoadingImpact(true);
      getStockImpact(orderId, newStatus).then((data) => {
        setImpacts(data);
        setLoadingImpact(false);
      });
    }
  }, [open, orderId, newStatus]);

  const hasStockChange = impacts.some((i) => i.action !== "none");
  const statusConfig = statusIcons[newStatus] || statusIcons.packed;
  const StatusIcon = statusConfig.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b-0">
          <div className="flex items-center gap-3">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", statusConfig.bg)}>
              <StatusIcon className={cn("w-5 h-5", statusConfig.color)} />
            </div>
            <div>
              <DialogTitle>Status পরিবর্তন করবেন?</DialogTitle>
              <DialogDescription>Order #{orderNumber}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 pb-2 space-y-3">
          <p className="text-sm text-muted-foreground">
            এই order কে <Badge variant="outline" className="mx-1 animate-flip-in">{newStatusLabel}</Badge> করা হবে
          </p>

          {loadingImpact ? (
            <div className="space-y-2 rounded-xl border p-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : hasStockChange ? (
            <div className="space-y-2 rounded-xl border p-3 bg-muted/30">
              <div className="flex items-center gap-1.5 mb-2">
                <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                <span className="text-xs font-medium text-warning">Stock Impact</span>
              </div>
              {impacts.filter((i) => i.action !== "none").map((impact, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm animate-row-in" style={{ animationDelay: `${idx * 50}ms` }}>
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{impact.productName} × {impact.quantity}</span>
                  <span className="text-muted-foreground">{impact.currentStock}</span>
                  {impact.action === "decrease" ? (
                    <ArrowDown className="w-3.5 h-3.5 text-destructive" />
                  ) : (
                    <ArrowUp className="w-3.5 h-3.5 text-emerald-600" />
                  )}
                  <span className={cn("font-bold", impact.action === "decrease" ? "text-destructive" : "text-emerald-600")}>
                    {impact.newStock}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground bg-muted/30 rounded-xl p-3">Stock এ কোন পরিবর্তন হবে না।</p>
          )}
        </div>

        <DialogFooter className="px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onConfirm} disabled={loading}>
            {loading ? "Processing..." : "Confirm করুন"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}