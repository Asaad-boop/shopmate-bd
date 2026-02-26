import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { applyStatusChange } from "@/hooks/use-orders";
import { formatBDT } from "@/lib/format";
import { Truck, AlertTriangle, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderIds: string[];
  orders: any[];
  onComplete?: () => void;
}

interface Result {
  success: number;
  failed: number;
  errors: string[];
}

export function CourierEntryModal({ open, onOpenChange, orderIds, orders, onComplete }: Props) {
  const queryClient = useQueryClient();
  const [courierId, setCourierId] = useState("");
  const [trackingId, setTrackingId] = useState("");
  const [pickupNotes, setPickupNotes] = useState("");
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<Result | null>(null);

  const { data: couriers } = useQuery({
    queryKey: ["couriers-active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("couriers")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
    enabled: open,
  });

  const selectedOrders = orders.filter(o => orderIds.includes(o.id));
  const validOrders = selectedOrders.filter(o => o.status === "ready_to_ship");
  const invalidOrders = selectedOrders.filter(o => o.status !== "ready_to_ship");
  const isSingle = orderIds.length === 1;
  const singleOrder = isSingle ? selectedOrders[0] : null;
  const totalAmount = validOrders.reduce((s, o) => s + (o.total_amount || 0), 0);

  const handleSubmit = async () => {
    if (!courierId) {
      toast.error("Please select a courier");
      return;
    }

    setProcessing(true);
    setProgress(0);
    setResult(null);

    const res: Result = { success: 0, failed: 0, errors: [] };
    const batchSize = 50;

    for (let i = 0; i < validOrders.length; i += batchSize) {
      const batch = validOrders.slice(i, i + batchSize);

      for (const order of batch) {
        try {
          // Create courier shipment entry
          const { error: shipErr } = await supabase.from("courier_shipments").insert({
            order_id: order.id,
            courier_id: courierId,
            customer_total_amount: order.total_amount || 0,
            product_amount: (order.total_amount || 0) - (order.delivery_charge || 0),
            customer_shipping_amount: order.delivery_charge || 0,
            booking_status: "booked",
            tracking_id: isSingle ? (trackingId || null) : null,
          });

          if (shipErr) throw shipErr;

          // Transition status to shipped
          await applyStatusChange(order.id, "shipped", order.status);
          res.success++;
        } catch (e: any) {
          res.failed++;
          res.errors.push(`${order.invoice_id || order.order_number}: ${e.message}`);
        }

        setProgress(Math.round(((i + batch.indexOf(order) + 1) / validOrders.length) * 100));
      }
    }

    setResult(res);
    setProcessing(false);

    // Invalidate queries
    queryClient.invalidateQueries({ queryKey: ["orders-cockpit"] });
    queryClient.invalidateQueries({ queryKey: ["order-status-counts"] });
    queryClient.invalidateQueries({ queryKey: ["orders-shipment-map"] });

    if (res.success > 0) {
      toast.success(`${res.success} order(s) sent to courier`);
      onComplete?.();
    }
    if (res.failed > 0) {
      toast.error(`${res.failed} order(s) failed`);
    }
  };

  const handleClose = () => {
    if (!processing) {
      setResult(null);
      setProgress(0);
      setCourierId("");
      setTrackingId("");
      setPickupNotes("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
              <Truck className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <DialogTitle>Courier Entry</DialogTitle>
              <DialogDescription>
                {isSingle ? `Order #${singleOrder?.invoice_id || singleOrder?.order_number}` : `${orderIds.length} orders selected`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 pb-4 space-y-4">
          {/* Validation warnings */}
          {invalidOrders.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-xs">
                <p className="font-semibold text-amber-800">
                  {invalidOrders.length} order(s) are not in "Ready to Ship" status
                </p>
                <p className="text-amber-600 mt-0.5">
                  Only {validOrders.length} order(s) will be processed
                </p>
              </div>
            </div>
          )}

          {/* Order summary */}
          <div className="rounded-xl border p-3 bg-muted/30">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Orders to process</span>
              <span className="font-bold">{validOrders.length}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-muted-foreground">Total amount</span>
              <span className="font-bold">{formatBDT(totalAmount)}</span>
            </div>
          </div>

          {/* Courier select */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Courier</p>
            <Select value={courierId} onValueChange={setCourierId}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Select courier..." />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                {couriers?.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tracking ID (single only) */}
          {isSingle && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
                Tracking ID <span className="text-muted-foreground/60">(optional)</span>
              </p>
              <Input
                value={trackingId}
                onChange={e => setTrackingId(e.target.value)}
                placeholder="Enter tracking ID if available..."
                className="h-10 font-mono"
              />
            </div>
          )}

          {/* Progress */}
          {processing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Processing...</span>
                <span className="font-bold">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-2">
              {result.success > 0 && (
                <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-lg p-2">
                  <CheckCircle className="w-4 h-4" />
                  <span className="font-medium">{result.success} sent successfully</span>
                </div>
              )}
              {result.failed > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-2">
                    <XCircle className="w-4 h-4" />
                    <span className="font-medium">{result.failed} failed</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground max-h-20 overflow-y-auto">
                    {result.errors.slice(0, 5).map((e, i) => (
                      <p key={i}>{e}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t">
          <Button variant="outline" onClick={handleClose} disabled={processing}>
            {result ? "Close" : "Cancel"}
          </Button>
          {!result && (
            <Button onClick={handleSubmit} disabled={processing || validOrders.length === 0 || !courierId}>
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...
                </>
              ) : (
                <>
                  <Truck className="w-4 h-4 mr-2" />
                  Send {validOrders.length} to Courier
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
