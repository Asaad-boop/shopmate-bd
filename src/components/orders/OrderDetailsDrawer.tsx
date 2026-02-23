import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatBDT, formatDateTime } from "@/lib/format";
import { StatusBadge } from "@/components/ui/status-badge";
import { orderStatusConfig } from "@/lib/format";
import { cn } from "@/lib/utils";

interface OrderDetailsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string | null;
}

export function OrderDetailsDrawer({ open, onOpenChange, orderId }: OrderDetailsDrawerProps) {
  const { data: order, isLoading } = useQuery({
    queryKey: ["order-drawer", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, customers(full_name, phone, address, district, thana, email)")
        .eq("id", orderId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!orderId && open,
  });

  const { data: items } = useQuery({
    queryKey: ["order-drawer-items", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("*, products(name, sku, image_url)")
        .eq("order_id", orderId!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!orderId && open,
  });

  const { data: logs } = useQuery({
    queryKey: ["order-drawer-logs", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_activity_log")
        .select("*")
        .eq("order_id", orderId!)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!orderId && open,
  });

  const customer = order?.customers as any;
  const subtotal = items?.reduce((s, i: any) => s + (i.unit_price * i.quantity), 0) || 0;
  const deliveryCharge = order?.delivery_charge || 0;
  const total = order?.total_amount || subtotal + deliveryCharge;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[540px] overflow-y-auto p-0">
        <SheetHeader className="p-6 pb-4 border-b">
          <SheetTitle className="text-lg font-bold">Order Details</SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : !order ? (
          <div className="p-6 text-center text-muted-foreground">Order not found</div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Bill To + Invoice Info */}
            <div className="border rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Left: Bill To */}
                <div>
                  <p className="text-sm font-bold mb-1">Bill to:</p>
                  <p className="text-sm">{customer?.full_name || "—"}</p>
                  <p className="text-xs text-muted-foreground">{order.delivery_address || customer?.address || "—"}</p>
                  <p className="text-xs text-muted-foreground">{customer?.phone || ""}</p>
                </div>
                {/* Right: Invoice details */}
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="font-semibold">Invoice ID#:</span>
                    <span>{order.order_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold">Invoice date:</span>
                    <span className="text-xs">{formatDateTime(order.created_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold">Courier Status:</span>
                    <span>{order.courier_status || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold">Ref:</span>
                    <span className="uppercase">{order.channel || "Manual"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Products Table */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-3 font-bold">Products</th>
                    <th className="text-center p-3 font-bold">Qty</th>
                    <th className="text-right p-3 font-bold">Unit price</th>
                    <th className="text-right p-3 font-bold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {items?.map((item: any) => {
                    const product = item.products;
                    const name = product?.name || item.product_name_fallback || "Product";
                    const sku = product?.sku || "";
                    return (
                      <tr key={item.id} className="border-b last:border-b-0">
                        <td className="p-3">
                          <p className="text-sm">{name}</p>
                          {sku && <p className="text-xs text-muted-foreground">({sku})</p>}
                        </td>
                        <td className="p-3 text-center">{item.quantity}</td>
                        <td className="p-3 text-right font-mono text-xs">{Number(item.unit_price).toFixed(2)}</td>
                        <td className="p-3 text-right font-mono text-xs">{(item.unit_price * item.quantity).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {/* Totals */}
              <div className="border-t p-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold">Sub-Total</span>
                  <span className="font-mono">{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-semibold">Delivery Charge</span>
                  <span className="font-mono">{deliveryCharge}</span>
                </div>
                {(order.discount || 0) > 0 && (
                  <div className="flex justify-between text-sm text-destructive">
                    <span className="font-semibold">Discount</span>
                    <span className="font-mono">-{order.discount}</span>
                  </div>
                )}
                <Separator className="my-1" />
                <div className="flex justify-between text-sm font-bold">
                  <span>Total</span>
                  <span className="font-mono">{Number(total).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Status:</span>
              <StatusBadge config={orderStatusConfig} status={order.status} />
            </div>

            {/* Log Timeline */}
            <div>
              <h3 className="text-base font-bold mb-1">Log Timeline</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Each log entry will be displayed as a card in chronological order, with the most recent entry on the top.
              </p>
              {(!logs || logs.length === 0) ? (
                <p className="text-sm text-muted-foreground text-center py-4">No activity logs yet</p>
              ) : (
                <div className="space-y-2">
                  {logs.map((log: any) => (
                    <div key={log.id} className="border-l-4 border-muted-foreground/20 bg-muted/30 rounded-r-lg p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium flex-1">{log.action}</p>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-muted-foreground">At</p>
                          <p className="text-xs">{formatDateTime(log.created_at)}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-muted-foreground">User Name</p>
                          <p className="text-xs">{log.done_by || "—"}</p>
                        </div>
                      </div>
                      {log.details && (
                        <p className="text-xs text-muted-foreground mt-1">{log.details}</p>
                      )}
                      {log.old_status && log.new_status && (
                        <p className="text-xs text-muted-foreground mt-1">{log.old_status} → {log.new_status}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
