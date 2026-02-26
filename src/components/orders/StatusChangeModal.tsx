import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getStockImpact, getDeliveryLedgerPreview, type StockImpact } from "@/hooks/use-orders";
import { Package, ArrowDown, ArrowUp, AlertTriangle, CheckCircle, Truck, XCircle, BookOpen, Minus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatBDT } from "@/lib/format";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: string;
  currentStatus?: string;
  newStatus: string;
  newStatusLabel: string;
  onConfirm: () => void;
  loading?: boolean;
  orderTotal?: number;
  shippingCharge?: number;
}

const statusIcons: Record<string, { icon: typeof Package; color: string; bg: string }> = {
  packed:          { icon: Package, color: "text-blue-600", bg: "bg-blue-50" },
  ready_to_ship:   { icon: Package, color: "text-cyan-600", bg: "bg-cyan-50" },
  shipped:         { icon: Truck, color: "text-indigo-600", bg: "bg-indigo-50" },
  in_transit:      { icon: Truck, color: "text-purple-600", bg: "bg-purple-50" },
  delivered:       { icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
  cancelled:       { icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
  returned:        { icon: ArrowUp, color: "text-amber-600", bg: "bg-amber-50" },
  damage_return:   { icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50" },
  completed:       { icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
  delivery_failed: { icon: AlertTriangle, color: "text-orange-600", bg: "bg-orange-50" },
  return_requested: { icon: ArrowUp, color: "text-amber-600", bg: "bg-amber-50" },
  return_in_transit: { icon: Truck, color: "text-orange-600", bg: "bg-orange-50" },
};

export function StatusChangeModal({
  open, onOpenChange, orderId, orderNumber, currentStatus, newStatus, newStatusLabel,
  onConfirm, loading, orderTotal, shippingCharge,
}: Props) {
  const [impacts, setImpacts] = useState<StockImpact[]>([]);
  const [loadingImpact, setLoadingImpact] = useState(false);

  useEffect(() => {
    if (open && orderId) {
      setLoadingImpact(true);
      getStockImpact(orderId, newStatus, currentStatus).then((data) => {
        setImpacts(data);
        setLoadingImpact(false);
      });
    }
  }, [open, orderId, newStatus, currentStatus]);

  const hasStockChange = impacts.some((i) => i.action !== "none");
  const isDelivery = newStatus === "delivered";
  const isCancellation = newStatus === "cancelled";
  const statusConfig = statusIcons[newStatus] || statusIcons.packed;
  const StatusIcon = statusConfig.icon;

  // Ledger preview for delivery
  const ledgerPreview = isDelivery && orderTotal
    ? getDeliveryLedgerPreview(orderTotal, shippingCharge || 0, impacts.reduce((s, i) => s, 0))
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
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
            এই order কে <Badge variant="outline" className="mx-1">{newStatusLabel}</Badge> করা হবে
          </p>

          {/* Stock Impact */}
          {loadingImpact ? (
            <div className="space-y-2 rounded-xl border p-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : (
            <div className="space-y-2 rounded-xl border p-3 bg-muted/30">
              <div className="flex items-center gap-1.5 mb-2">
                <Package className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground">Inventory Impact</span>
              </div>
              {impacts.map((impact, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 truncate text-xs">{impact.productName} × {impact.quantity}</span>
                  {impact.action === "decrease" ? (
                    <>
                      <span className="text-xs text-muted-foreground tabular-nums">{impact.currentStock}</span>
                      <ArrowDown className="w-3 h-3 text-destructive" />
                      <span className="text-xs font-bold text-destructive tabular-nums">{impact.newStock}</span>
                    </>
                  ) : impact.action === "increase" ? (
                    <>
                      <span className="text-xs text-muted-foreground tabular-nums">{impact.currentStock}</span>
                      <ArrowUp className="w-3 h-3 text-emerald-600" />
                      <span className="text-xs font-bold text-emerald-600 tabular-nums">{impact.newStock}</span>
                    </>
                  ) : (
                    <>
                      <Minus className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">{impact.detail}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Ledger Preview for Delivery */}
          {isDelivery && ledgerPreview.length > 0 && (
            <div className="space-y-2 rounded-xl border p-3 bg-emerald-50/50">
              <div className="flex items-center gap-1.5 mb-2">
                <BookOpen className="w-3.5 h-3.5 text-emerald-700" />
                <span className="text-xs font-semibold text-emerald-700">Accounting Impact</span>
              </div>
              <div className="space-y-1">
                {ledgerPreview.map((entry, idx) => (
                  <div key={idx} className="flex items-center text-[11px] gap-2">
                    <span className="flex-1 text-muted-foreground">{entry.account}</span>
                    {entry.debit > 0 && <span className="font-semibold text-foreground tabular-nums">Dr {formatBDT(entry.debit)}</span>}
                    {entry.credit > 0 && <span className="font-semibold text-emerald-700 tabular-nums">Cr {formatBDT(entry.credit)}</span>}
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                * Revenue & COGS posting will be queued for Finance review
              </p>
            </div>
          )}

          {/* Cancellation warning */}
          {isCancellation && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
                <span className="text-xs font-semibold text-destructive">এই action undo করা যাবে না</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={onConfirm}
            disabled={loading}
            className={cn(isCancellation && "bg-destructive hover:bg-destructive/90")}
          >
            {loading ? "Processing..." : "Confirm করুন"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
