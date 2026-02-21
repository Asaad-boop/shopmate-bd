import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useCompanySettings } from "@/hooks/use-company-settings";
import { useInvoiceSettings } from "@/hooks/use-invoice-settings";
import { printInvoice } from "@/components/orders/PrintInvoice";
import { formatDateTime } from "@/lib/format";
import { ArrowLeft, Printer, Save } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

import { CustomerCard } from "@/components/order-detail/CustomerCard";
import { OrderItemsCard, type OrderItem } from "@/components/order-detail/OrderItemsCard";
import { DeliveryPaymentCard, type DeliveryPaymentData } from "@/components/order-detail/DeliveryPaymentCard";
import { StatusSidebar } from "@/components/order-detail/StatusSidebar";
import { OrderInfoCard } from "@/components/order-detail/OrderInfoCard";
import { ActivityLog } from "@/components/order-detail/ActivityLog";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  processing: { label: "Processing", color: "bg-orange-100 text-orange-800" },
  good_but_no_response: { label: "Good", color: "bg-emerald-100 text-emerald-800" },
  good_no_response: { label: "Good No Response", color: "bg-slate-100 text-slate-700" },
  no_response: { label: "No Response", color: "bg-slate-100 text-slate-700" },
  on_hold: { label: "On Hold", color: "bg-amber-100 text-amber-800" },
  advance_payment: { label: "Advance", color: "bg-blue-100 text-blue-800" },
  cancel: { label: "Cancel", color: "bg-red-100 text-red-800" },
  confirm: { label: "Confirm", color: "bg-emerald-100 text-emerald-800" },
  pending: { label: "Pending", color: "bg-amber-100 text-amber-800" },
  delivered: { label: "Delivered", color: "bg-emerald-500 text-white" },
};

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { settings: company } = useCompanySettings();
  const { invoiceSettings } = useInvoiceSettings();

  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [deliveryData, setDeliveryData] = useState<DeliveryPaymentData>({
    channel: "",
    delivery_address: "",
    delivery_district: "",
    delivery_thana: "",
    customer_name: "",
    customer_phone: "",
    notes: "",
    delivery_charge: 60,
    discount: 0,
    advance_enabled: false,
    advance_via: "",
    advance_amount: 0,
    advance_txn_id: "",
  });

  // Fetch order
  const { data: order, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, customers(full_name, phone, phone2, address, district, thana, segment, total_orders, total_spent)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch order items
  const { data: dbItems } = useQuery({
    queryKey: ["order-items", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("*, products(name, sku, image_url, selling_price)")
        .eq("order_id", id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Initialize state from fetched data
  useEffect(() => {
    if (order) {
      const customer = order.customers as any;
      setDeliveryData({
        channel: order.channel || "",
        delivery_address: order.delivery_address || customer?.address || "",
        delivery_district: order.delivery_district || customer?.district || "",
        delivery_thana: order.delivery_thana || customer?.thana || "",
        customer_name: customer?.full_name || "",
        customer_phone: customer?.phone || "",
        notes: order.notes || "",
        delivery_charge: order.delivery_charge || 60,
        discount: order.discount || 0,
        advance_enabled: !!(order.cod_amount && order.total_amount && order.cod_amount < order.total_amount),
        advance_via: order.payment_method || "",
        advance_amount: order.total_amount && order.cod_amount ? order.total_amount - order.cod_amount : 0,
        advance_txn_id: "",
      });
    }
  }, [order]);

  useEffect(() => {
    if (dbItems) {
      setOrderItems(
        dbItems.map((item) => {
          const product = item.products as any;
          return {
            id: item.id,
            product_id: item.product_id || "",
            product_name: product?.name || (item as any).product_name_fallback || "Product",
            sku: product?.sku || "",
            image_url: product?.image_url || null,
            unit_price: item.unit_price,
            quantity: item.quantity,
            discount: item.discount || 0,
            total_price: item.total_price,
          };
        })
      );
    }
  }, [dbItems]);

  // Save order mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const subtotal = orderItems.reduce((s, i) => s + i.total_price, 0);
      const grandTotal = subtotal - deliveryData.discount + deliveryData.delivery_charge;
      const codAmount = deliveryData.advance_enabled
        ? grandTotal - deliveryData.advance_amount
        : grandTotal;

      // Update order
      const { error: orderError } = await supabase
        .from("orders")
        .update({
          delivery_address: deliveryData.delivery_address,
          delivery_district: deliveryData.delivery_district,
          delivery_thana: deliveryData.delivery_thana,
          notes: deliveryData.notes,
          delivery_charge: deliveryData.delivery_charge,
          discount: deliveryData.discount,
          subtotal,
          total_amount: grandTotal,
          cod_amount: codAmount,
          payment_method: deliveryData.advance_enabled ? deliveryData.advance_via : order?.payment_method,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id!);
      if (orderError) throw orderError;

      // Delete old items and insert new
      await supabase.from("order_items").delete().eq("order_id", id!);
      if (orderItems.length > 0) {
        const { error: itemsError } = await supabase.from("order_items").insert(
          orderItems.map((item) => ({
            order_id: id!,
            product_id: item.product_id,
            product_name_fallback: item.product_name,
            unit_price: item.unit_price,
            quantity: item.quantity,
            discount: item.discount,
            total_price: item.total_price,
          }))
        );
        if (itemsError) throw itemsError;
      }

      // Log activity
      await supabase.from("order_activity_log" as any).insert({
        order_id: id!,
        action: "items_updated",
        done_by: "admin",
        details: `${orderItems.length} items, total: ${grandTotal}`,
      });
    },
    onSuccess: () => {
      toast({ title: "Order saved successfully" });
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      queryClient.invalidateQueries({ queryKey: ["order-items", id] });
      queryClient.invalidateQueries({ queryKey: ["order-activity", id] });
    },
    onError: (err: any) =>
      toast({ title: "Save failed", description: err.message, variant: "destructive" }),
  });

  const handlePrintInvoice = useCallback(() => {
    if (!order) return;
    // Need to attach items for printing
    const orderWithItems = {
      ...order,
      order_items: dbItems || [],
    };
    printInvoice(orderWithItems, company, invoiceSettings);
  }, [order, dbItems, company, invoiceSettings]);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
          <div className="space-y-6">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-60 w-full" />
            <Skeleton className="h-80 w-full" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-80 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-12 text-muted-foreground">Order not found</div>
    );
  }

  const customer = order.customers as any;
  const currentStatus = order.web_order_status || order.status || "pending";
  const statusCfg = STATUS_LABELS[currentStatus] || { label: currentStatus, color: "bg-muted text-muted-foreground" };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl -mx-6 px-6 py-4 border-b border-border/50">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/orders")}
              className="shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold tracking-tight">
                  #{order.order_number}
                </h1>
                <Badge className={cn("text-xs", statusCfg.color)}>
                  {statusCfg.label}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Created {formatDateTime(order.created_at)}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handlePrintInvoice}
            >
              <Printer className="w-3.5 h-3.5" />
              Print Invoice
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              <Save className="w-3.5 h-3.5" />
              {saveMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          <CustomerCard
            customerId={order.customer_id}
            customerPhone={customer?.phone}
          />

          <OrderItemsCard items={orderItems} onChange={setOrderItems} />

          <DeliveryPaymentCard
            data={deliveryData}
            onChange={setDeliveryData}
            items={orderItems}
          />
        </div>

        {/* Right Column - Sticky */}
        <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <StatusSidebar
            orderId={order.id}
            currentStatus={currentStatus}
            onSave={() => saveMutation.mutate()}
            isSaving={saveMutation.isPending}
          />

          <OrderInfoCard order={order} customerPhone={customer?.phone} />

          <ActivityLog orderId={order.id} />
        </div>
      </div>
    </div>
  );
}
