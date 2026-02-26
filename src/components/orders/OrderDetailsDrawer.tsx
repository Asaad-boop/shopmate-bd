import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatBDT, formatDateTime, formatBDT2, orderStatusConfig, validTransitions, statusActions } from "@/lib/format";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import { getStockImpact } from "@/hooks/use-orders";
import { useState, useEffect } from "react";
import {
  Package, Banknote, Truck, BookOpen, TrendingDown, TrendingUp, Minus,
  Clock, AlertTriangle, CheckCircle, Activity,
} from "lucide-react";

interface OrderDetailsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string | null;
}

export function OrderDetailsDrawer({ open, onOpenChange, orderId }: OrderDetailsDrawerProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "items" | "payment" | "courier" | "timeline" | "journal" | "stock">("overview");

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
        .select("*, products(name, sku, image_url, cost_price)")
        .eq("order_id", orderId!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!orderId && open,
  });

  const { data: shipment } = useQuery({
    queryKey: ["order-drawer-shipment", orderId],
    queryFn: async () => {
      const { data } = await supabase
        .from("courier_shipments")
        .select("*, couriers(name)")
        .eq("order_id", orderId!)
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!orderId && open,
  });

  const { data: journals } = useQuery({
    queryKey: ["order-drawer-journals", orderId],
    queryFn: async () => {
      const { data } = await supabase
        .from("journal_entries")
        .select("id, description, status, created_at, reference_type")
        .eq("reference_id", orderId!)
        .order("created_at", { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: !!orderId && open,
  });

  const { data: advances } = useQuery({
    queryKey: ["order-drawer-advances", orderId],
    queryFn: async () => {
      const { data } = await supabase
        .from("account_ledger")
        .select("id, amount, direction, ledger_date, note, ref_type")
        .eq("ref_id", orderId!)
        .eq("ref_type", "advance")
        .order("ledger_date", { ascending: false });
      return data || [];
    },
    enabled: !!orderId && open,
  });

  const { data: activityLogs } = useQuery({
    queryKey: ["order-drawer-activity-logs", orderId],
    queryFn: async () => {
      const { data } = await supabase
        .from("order_activity_log")
        .select("*")
        .eq("order_id", orderId!)
        .order("created_at", { ascending: false })
        .limit(30);
      return data || [];
    },
    enabled: !!orderId && open,
  });

  const [stockImpact, setStockImpact] = useState<any[]>([]);
  useEffect(() => {
    if (!orderId || !open) return;
    getStockImpact(orderId, "delivered").then(setStockImpact).catch(() => setStockImpact([]));
  }, [orderId, open]);

  const customer = order?.customers as any;
  const subtotal = items?.reduce((s, i: any) => s + (i.unit_price * i.quantity), 0) || 0;
  const deliveryCharge = order?.delivery_charge || 0;
  const total = order?.total_amount || subtotal + deliveryCharge;
  const advanceTotal = advances?.reduce((s, a: any) => s + (a.direction === "in" ? a.amount : -a.amount), 0) || 0;

  // Allowed next actions for overview tab
  const currentStatus = order?.status || "pending";
  const allowedActions = statusActions[currentStatus] || [];

  const tabs = [
    { key: "overview" as const, label: "Overview", icon: Activity },
    { key: "items" as const, label: "Items", icon: Package },
    { key: "payment" as const, label: "Payment", icon: Banknote },
    { key: "courier" as const, label: "Courier", icon: Truck },
    { key: "timeline" as const, label: "Timeline", icon: Clock },
    { key: "journal" as const, label: "Journal", icon: BookOpen },
    { key: "stock" as const, label: "Stock", icon: TrendingDown },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[580px] overflow-y-auto p-0">
        <SheetHeader className="p-6 pb-4 border-b">
          <SheetTitle className="text-lg font-bold flex items-center gap-3">
            Order Details
            {order && <StatusBadge config={orderStatusConfig} status={order.status} />}
          </SheetTitle>
          {order && (
            <p className="text-sm text-muted-foreground">
              {order.invoice_id || order.order_number} • {formatDateTime(order.created_at)}
            </p>
          )}
        </SheetHeader>

        {isLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : !order ? (
          <div className="p-6 text-center text-muted-foreground">Order not found</div>
        ) : (
          <>
            {/* Bill To Card */}
            <div className="px-6 pt-4 pb-2">
              <div className="border rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">BILL TO</p>
                    <p className="text-sm font-medium">{customer?.full_name || "—"}</p>
                    <p className="text-xs text-muted-foreground">{order.delivery_address || customer?.address || "—"}</p>
                    <p className="text-xs text-muted-foreground">{customer?.phone || ""}</p>
                  </div>
                  <div className="space-y-1 text-right">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-muted-foreground">Total</span>
                      <span className="font-bold">{formatBDT(total)}</span>
                    </div>
                    {order.advance_amount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-muted-foreground">Advance</span>
                        <span className="text-green-600 font-semibold">{formatBDT(order.advance_amount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-muted-foreground">COD Due</span>
                      <span className="font-bold text-orange-600">{formatBDT(total - (order.advance_amount || 0))}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tab Strip */}
            <div className="px-6 flex gap-1 border-b overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              {tabs.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.key}
                    onClick={() => setActiveTab(t.key)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg transition-colors whitespace-nowrap shrink-0",
                      activeTab === t.key
                        ? "bg-muted text-foreground border border-b-0 border-border"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Tab Content */}
            <div className="p-6 space-y-4">

              {/* ═══ Overview Tab ═══ */}
              {activeTab === "overview" && (
                <div className="space-y-4">
                  {/* Current Status */}
                  <div className="rounded-xl border p-4 bg-muted/30">
                    <div className="flex items-center gap-2 mb-3">
                      <Activity className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Current Status</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge config={orderStatusConfig} status={currentStatus} />
                      <span className="text-sm text-muted-foreground">
                        since {formatDateTime(order.updated_at)}
                      </span>
                    </div>
                  </div>

                  {/* Allowed Actions */}
                  {allowedActions.length > 0 && (
                    <div className="rounded-xl border p-4">
                      <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Available Actions</p>
                      <div className="flex flex-wrap gap-2">
                        {allowedActions.map((action: any) => (
                          <Button
                            key={action.key}
                            variant={action.variant === "destructive" ? "destructive" : "outline"}
                            size="sm"
                            className="text-xs"
                          >
                            {action.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Warnings */}
                  {customer?.is_blocked && (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                      <span className="text-xs font-medium text-destructive">This customer is blocked</span>
                    </div>
                  )}

                  {/* Quick Info */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border p-3">
                      <p className="text-[10px] text-muted-foreground uppercase mb-1">Courier</p>
                      <p className="text-sm font-medium">{(shipment as any)?.couriers?.name || "Not assigned"}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-[10px] text-muted-foreground uppercase mb-1">Tracking</p>
                      <p className="text-sm font-mono">{shipment?.tracking_id || order.pathao_tracking_code || "—"}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* ═══ Items Tab ═══ */}
              {activeTab === "items" && (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left p-3 font-bold">Product</th>
                        <th className="text-center p-3 font-bold">Qty</th>
                        <th className="text-right p-3 font-bold">Unit</th>
                        <th className="text-right p-3 font-bold">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items?.map((item: any) => {
                        const product = item.products;
                        return (
                          <tr key={item.id} className="border-b last:border-b-0">
                            <td className="p-3">
                              <p className="text-sm font-medium">{product?.name || item.product_name_fallback || "Product"}</p>
                              {product?.sku && <p className="text-xs text-muted-foreground">{product.sku}</p>}
                            </td>
                            <td className="p-3 text-center">{item.quantity}</td>
                            <td className="p-3 text-right font-mono text-xs">{Number(item.unit_price).toFixed(2)}</td>
                            <td className="p-3 text-right font-mono text-xs">{(item.unit_price * item.quantity).toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="border-t p-3 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold">Sub-Total</span>
                      <span className="font-mono">{subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold">Delivery</span>
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
              )}

              {/* ═══ Payment Tab ═══ */}
              {activeTab === "payment" && (
                <div className="space-y-4">
                  <div className="border rounded-lg p-4 space-y-3">
                    <h4 className="font-semibold text-sm">Payment Breakdown</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span className="text-muted-foreground">Method</span>
                      <span className="font-medium">{order.payment_method?.toUpperCase() || "COD"}</span>
                      <span className="text-muted-foreground">Status</span>
                      <span className="font-medium">{order.payment_status || "pending"}</span>
                      <span className="text-muted-foreground">Total</span>
                      <span className="font-bold">{formatBDT(total)}</span>
                      <span className="text-muted-foreground">Advance Paid</span>
                      <span className="font-semibold text-green-600">{formatBDT(order.advance_amount || 0)}</span>
                      <span className="text-muted-foreground">COD Remaining</span>
                      <span className="font-bold text-orange-600">{formatBDT(total - (order.advance_amount || 0))}</span>
                    </div>
                  </div>

                  {advances && advances.length > 0 && (
                    <div className="border rounded-lg p-4 space-y-2">
                      <h4 className="font-semibold text-sm">Advance History</h4>
                      {advances.map((a: any) => (
                        <div key={a.id} className="flex justify-between text-xs border-b last:border-0 pb-1">
                          <span>{formatDateTime(a.ledger_date)}</span>
                          <span className={a.direction === "in" ? "text-green-600" : "text-red-600"}>
                            {a.direction === "in" ? "+" : "-"}{formatBDT(a.amount)}
                          </span>
                          <span className="text-muted-foreground truncate max-w-[120px]">{a.note || "—"}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ═══ Courier Tab ═══ */}
              {activeTab === "courier" && (
                <div className="space-y-4">
                  {shipment ? (
                    <div className="border rounded-lg p-4 space-y-3">
                      <h4 className="font-semibold text-sm">Courier Charges — {(shipment as any).couriers?.name || "Unknown"}</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <span className="text-muted-foreground">Tracking</span>
                        <span className="font-mono text-xs">{shipment.tracking_id || "—"}</span>
                        <span className="text-muted-foreground">Status</span>
                        <span>{shipment.booking_status}</span>
                        <Separator className="col-span-2" />
                        <span className="text-muted-foreground">Delivery Fee</span>
                        <span className="font-mono">{formatBDT2(shipment.courier_delivery_fee)}</span>
                        <span className="text-muted-foreground">COD Fee</span>
                        <span className="font-mono">{formatBDT2(shipment.courier_cod_fee)}</span>
                        <span className="text-muted-foreground">Discount</span>
                        <span className="font-mono text-green-600">-{formatBDT2(shipment.courier_discount)}</span>
                        <span className="text-muted-foreground">Return Cost</span>
                        <span className="font-mono">{formatBDT2(shipment.courier_return_cost)}</span>
                        <Separator className="col-span-2" />
                        <span className="font-semibold">Total Cost</span>
                        <span className="font-bold font-mono">{formatBDT2(shipment.courier_total_cost)}</span>
                        <span className="font-semibold">Net Payable</span>
                        <span className="font-bold font-mono text-primary">{formatBDT2(shipment.courier_net_payable)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No courier shipment linked yet
                    </div>
                  )}
                </div>
              )}

              {/* ═══ Timeline Tab ═══ */}
              {activeTab === "timeline" && (
                <div className="space-y-1">
                  <h4 className="font-semibold text-sm mb-3">Activity Timeline</h4>
                  {activityLogs && activityLogs.length > 0 ? (
                    <div className="relative pl-4 border-l-2 border-border space-y-4">
                      {activityLogs.map((log: any, i: number) => (
                        <div key={log.id || i} className="relative">
                          <div className="absolute -left-[21px] w-3 h-3 rounded-full bg-muted border-2 border-border" />
                          <div className="ml-4">
                            <p className="text-xs font-medium text-foreground">
                              {log.action || log.event_type || "Status change"}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {log.old_status && log.new_status
                                ? `${orderStatusConfig[log.old_status]?.label || log.old_status} → ${orderStatusConfig[log.new_status]?.label || log.new_status}`
                                : log.details || log.note || ""}
                            </p>
                            <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                              {formatDateTime(log.created_at)}
                              {log.performed_by && ` • ${log.performed_by}`}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-6">No activity recorded yet</p>
                  )}
                </div>
              )}

              {/* ═══ Journal Tab ═══ */}
              {activeTab === "journal" && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Linked Journal Entries</h4>
                  {journals && journals.length > 0 ? (
                    journals.map((j: any) => (
                      <div key={j.id} className="border rounded-lg p-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{j.description}</p>
                          <p className="text-xs text-muted-foreground">{formatDateTime(j.created_at)} • {j.reference_type}</p>
                        </div>
                        <Badge variant={j.status === "posted" ? "default" : "secondary"} className="text-xs">
                          {j.status}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-6">No journal entries linked</p>
                  )}
                </div>
              )}

              {/* ═══ Stock Impact Tab ═══ */}
              {activeTab === "stock" && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Stock Impact Preview (on Delivery)</h4>
                  {stockImpact.length > 0 ? (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/30">
                            <th className="text-left p-2 font-medium">Product</th>
                            <th className="text-center p-2 font-medium">Qty</th>
                            <th className="text-center p-2 font-medium">Current</th>
                            <th className="text-center p-2 font-medium">After</th>
                            <th className="text-center p-2 font-medium">Impact</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stockImpact.map((si: any, i: number) => (
                            <tr key={i} className="border-b last:border-0">
                              <td className="p-2 text-xs">{si.productName}</td>
                              <td className="p-2 text-center text-xs">{si.quantity}</td>
                              <td className="p-2 text-center text-xs tabular-nums">{si.currentStock}</td>
                              <td className="p-2 text-center text-xs tabular-nums font-bold">{si.newStock}</td>
                              <td className="p-2 text-center">
                                {si.action === "decrease" ? (
                                  <TrendingDown className="w-3.5 h-3.5 text-destructive mx-auto" />
                                ) : si.action === "increase" ? (
                                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600 mx-auto" />
                                ) : (
                                  <Minus className="w-3.5 h-3.5 text-muted-foreground mx-auto" />
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-6">No stock impact data</p>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
