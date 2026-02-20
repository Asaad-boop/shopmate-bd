import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, ChannelBadge } from "@/components/ui/status-badge";
import { orderStatusConfig, paymentStatusConfig, formatBDT, formatDateTime } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Check, Truck, Package, ClipboardList, CheckCircle2, ExternalLink, RefreshCw } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useBDCourierSingle, getRiskLevel, getSuccessColor } from "@/hooks/use-bd-courier";
const STATUSES = ["pending", "confirmed", "processing", "shipped", "delivered"] as const;
const STATUS_ICONS = [ClipboardList, Check, Package, Truck, CheckCircle2];

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [trackingCode, setTrackingCode] = useState("");

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, customers(full_name, phone, phone2, address, district, thana, segment, total_orders, total_spent)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      if (data.pathao_tracking_code) setTrackingCode(data.pathao_tracking_code);
      return data;
    },
    enabled: !!id,
  });

  // Fetch Shopify store URL for linking
  const { data: shopifyStoreUrl } = useQuery({
    queryKey: ["shopify-store-url"],
    queryFn: async () => {
      const { data } = await supabase.from("settings").select("value").eq("key", "shopify_store_url").maybeSingle();
      return data?.value || "";
    },
    enabled: !!order && order.channel === "shopify",
  });

  const { data: items } = useQuery({
    queryKey: ["order-items", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("*, products(name, sku, image_url)")
        .eq("order_id", id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const statusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const { error } = await supabase.from("orders").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Order status updated" });
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const trackingMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("orders").update({ pathao_tracking_code: trackingCode }).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Tracking code saved" });
      queryClient.invalidateQueries({ queryKey: ["order", id] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-60 w-full" />
          </div>
          <Skeleton className="h-60 w-full" />
        </div>
      </div>
    );
  }

  if (!order) return <div className="text-center py-12 text-muted-foreground">Order not found</div>;

  const currentStatusIdx = STATUSES.indexOf(order.status as any);
  const customer = order.customers as any;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/orders")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{order.order_number}</h1>
            <ChannelBadge channel={order.channel} />
            <StatusBadge config={orderStatusConfig} status={order.status} />
          </div>
          <p className="text-sm text-muted-foreground">{formatDateTime(order.order_date)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Status Timeline */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Order Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-6">
                {STATUSES.map((s, i) => {
                  const Icon = STATUS_ICONS[i];
                  const isActive = i <= currentStatusIdx;
                  const isCurrent = i === currentStatusIdx;
                  return (
                    <div key={s} className="flex flex-col items-center flex-1 relative">
                      {i > 0 && (
                        <div className={cn("absolute top-4 right-1/2 w-full h-0.5", i <= currentStatusIdx ? "bg-primary" : "bg-border")} style={{ transform: "translateX(-50%)", left: "-50%" }} />
                      )}
                      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center z-10 relative", isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground", isCurrent && "ring-2 ring-primary ring-offset-2")}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className={cn("text-xs mt-2 font-medium", isActive ? "text-foreground" : "text-muted-foreground")}>
                        {orderStatusConfig[s]?.label || s}
                      </span>
                    </div>
                  );
                })}
              </div>
              {order.status !== "delivered" && order.status !== "cancelled" && (
                <div className="flex gap-2 flex-wrap">
                  {STATUSES.filter((_, i) => i > currentStatusIdx).map((s) => (
                    <Button key={s} size="sm" variant="outline" onClick={() => statusMutation.mutate(s)} disabled={statusMutation.isPending}>
                      Mark as {orderStatusConfig[s]?.label}
                    </Button>
                  ))}
                  <Button size="sm" variant="destructive" onClick={() => statusMutation.mutate("cancelled")} disabled={statusMutation.isPending}>
                    Cancel Order
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Order Items */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Order Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {items?.map((item) => {
                  const product = item.products as any;
                  const pName = product?.name || (item as any).product_name_fallback || "Product";
                  const pInitial = pName[0].toUpperCase();
                  return (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center shrink-0 border border-border">
                        {product?.image_url ? (
                          <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{pInitial}</div>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{pName}</p>
                        <p className="text-xs text-muted-foreground">SKU: {product?.sku || "-"}</p>
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <p>{item.quantity} × {formatBDT(item.unit_price)}</p>
                      <p className="font-medium">{formatBDT(item.total_price)}</p>
                    </div>
                  </div>
                  );
                })}
                {(!items || items.length === 0) && (
                  <p className="text-center text-muted-foreground py-4 text-sm">No items</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Pathao Tracking */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Courier / Pathao Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <Label>Tracking Code</Label>
                  <Input value={trackingCode} onChange={(e) => setTrackingCode(e.target.value)} placeholder="Enter Pathao tracking code" />
                </div>
                <Button onClick={() => trackingMutation.mutate()} disabled={trackingMutation.isPending}>
                  Save
                </Button>
              </div>
              {order.pathao_consignment_id && (
                <p className="text-xs text-muted-foreground mt-2">Consignment ID: {order.pathao_consignment_id}</p>
              )}
            </CardContent>
          </Card>

          {/* Shopify Info (only for shopify orders) */}
          {order.channel === "shopify" && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">🛍️ Shopify Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {order.shopify_order_id && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Shopify Order ID</span><span className="font-mono">{order.shopify_order_id}</span></div>
                )}
                {order.shopify_order_number && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Shopify Order #</span><span>{order.shopify_order_number}</span></div>
                )}
                {shopifyStoreUrl && order.shopify_order_id && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => window.open(`https://${shopifyStoreUrl}/admin/orders/${order.shopify_order_id}`, "_blank")}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" /> View in Shopify
                  </Button>
                )}
                {!order.shopify_order_id && !order.shopify_order_number && (
                  <p className="text-muted-foreground text-xs">No Shopify order data linked yet</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Delivery Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Delivery Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">Address:</span> {order.delivery_address || "-"}</p>
              <p><span className="text-muted-foreground">District:</span> {order.delivery_district || "-"}</p>
              <p><span className="text-muted-foreground">Thana:</span> {order.delivery_thana || "-"}</p>
              {order.notes && <p><span className="text-muted-foreground">Notes:</span> {order.notes}</p>}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Financial Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Financial Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatBDT(order.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="text-destructive">-{formatBDT(order.discount)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Delivery Charge</span><span>{formatBDT(order.delivery_charge)}</span></div>
              <div className="border-t border-border pt-2 flex justify-between font-bold"><span>Total</span><span>{formatBDT(order.total_amount)}</span></div>
              <div className="border-t border-border pt-2 space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Cost of Goods</span><span>{formatBDT(order.cost_of_goods)}</span></div>
                <div className="flex justify-between font-medium text-green-600"><span>Gross Profit</span><span>{formatBDT(order.gross_profit)}</span></div>
              </div>
              <div className="border-t border-border pt-2 space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Payment</span><StatusBadge config={paymentStatusConfig} status={order.payment_status} /></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Method</span><span className="capitalize">{order.payment_method || "-"}</span></div>
                {order.cod_amount ? <div className="flex justify-between"><span className="text-muted-foreground">COD Amount</span><span>{formatBDT(order.cod_amount)}</span></div> : null}
              </div>
            </CardContent>
          </Card>

          {/* Customer Info */}
          {customer && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Customer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="font-medium">{customer.full_name}</p>
                <p className="text-muted-foreground">{customer.phone}</p>
                {customer.phone2 && <p className="text-muted-foreground">{customer.phone2}</p>}
                {customer.address && <p className="text-muted-foreground">{customer.address}</p>}
                <div className="flex gap-2 pt-1">
                  <StatusBadge config={{ vip: { label: "VIP", color: "bg-amber-100 text-amber-800" }, regular: { label: "Regular", color: "bg-gray-100 text-gray-800" }, new: { label: "New", color: "bg-blue-100 text-blue-800" } }} status={customer.segment} />
                </div>
                <div className="border-t border-border pt-2 mt-2 space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">Orders</span><span>{customer.total_orders || 0}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Total Spent</span><span>{formatBDT(customer.total_spent)}</span></div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* BD Courier Report */}
          {customer?.phone && <BDCourierReport phone={customer.phone} />}
        </div>
      </div>
    </div>
  );
}

function BDCourierReport({ phone }: { phone: string }) {
  const { data, isLoading, refetch, isFetching } = useBDCourierSingle(phone);
  const risk = getRiskLevel(data?.success_rate);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">📊 BD Courier Report</CardTitle>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : !data || data.error ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">
              {data?.error === "api_error" ? "চেক করা যায়নি" : "🆕 নতুন কাস্টমার - কোন ডেটা নেই"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Success Rate Circle */}
            <div className="flex items-center gap-4">
              <div className="relative w-16 h-16">
                <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="15" fill="none"
                    stroke={getSuccessColor(data.success_rate)}
                    strokeWidth="3"
                    strokeDasharray={`${data.success_rate * 0.942} 94.2`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">{data.success_rate}%</span>
              </div>
              <div>
                <Badge className={cn("text-xs", risk.bg, risk.color)}>{risk.label}</Badge>
                <p className="text-xs text-muted-foreground mt-1">Total: {data.total_orders} orders</p>
              </div>
            </div>

            {/* Breakdown */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-lg bg-green-50">
                <p className="text-lg font-bold text-green-700">{data.successful_orders}</p>
                <p className="text-[10px] text-green-600">Delivered</p>
              </div>
              <div className="p-2 rounded-lg bg-red-50">
                <p className="text-lg font-bold text-red-700">{data.returned_orders}</p>
                <p className="text-[10px] text-red-600">Returned</p>
              </div>
              <div className="p-2 rounded-lg bg-orange-50">
                <p className="text-lg font-bold text-orange-700">{data.cancelled_orders || 0}</p>
                <p className="text-[10px] text-orange-600">Cancelled</p>
              </div>
            </div>

            {/* Courier breakdown from raw data */}
            {data.raw_data?.courier_data && (
              <div className="space-y-1.5 border-t border-border pt-2">
                <p className="text-xs font-medium text-muted-foreground">By Courier</p>
                {Object.entries(data.raw_data.courier_data).map(([courier, info]: [string, any]) => (
                  <div key={courier} className="flex justify-between text-xs">
                    <span className="capitalize">{courier}</span>
                    <span>{info.success || info.delivered || 0}/{info.total || 0}</span>
                  </div>
                ))}
              </div>
            )}

            {data.last_fetched_at && (
              <p className="text-[10px] text-muted-foreground text-right">
                Last checked: {new Date(data.last_fetched_at).toLocaleString("bn-BD")}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}