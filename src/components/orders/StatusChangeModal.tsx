import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getStockImpact, type StockImpact } from "@/hooks/use-orders";
import { Package, ArrowDown, ArrowUp } from "lucide-react";

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Status পরিবর্তন করবেন?</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Order <span className="font-medium text-foreground">#{orderNumber}</span> কে{" "}
            <Badge variant="outline">{newStatusLabel}</Badge> করলে:
          </p>

          {loadingImpact ? (
            <p className="text-xs text-muted-foreground">Loading stock impact...</p>
          ) : hasStockChange ? (
            <div className="space-y-2 rounded-lg border p-3 bg-muted/30">
              {impacts.filter((i) => i.action !== "none").map((impact, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{impact.productName} × {impact.quantity}</span>
                  <span className="text-muted-foreground">Stock: {impact.currentStock}</span>
                  {impact.action === "decrease" ? (
                    <ArrowDown className="w-3.5 h-3.5 text-destructive" />
                  ) : (
                    <ArrowUp className="w-3.5 h-3.5 text-green-600" />
                  )}
                  <span className={impact.action === "decrease" ? "text-destructive font-medium" : "text-green-600 font-medium"}>
                    {impact.newStock}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Stock এ কোন পরিবর্তন হবে না।</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onConfirm} disabled={loading}>
            {loading ? "Processing..." : "Confirm করুন"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
