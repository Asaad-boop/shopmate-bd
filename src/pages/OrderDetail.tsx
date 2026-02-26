import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime, formatBDT } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ArrowLeft, Printer, Save, ShieldCheck, Loader2, ArrowRightLeft } from "lucide-react";
import { finalizeLegacyOrder } from "@/hooks/use-legacy-finalize";
import { useBDCourierSingle, getRiskLevel } from "@/hooks/use-bd-courier";
import { useCompanySettings } from "@/hooks/use-company-settings";
import { useInvoiceSettings } from "@/hooks/use-invoice-settings";
import { printInvoice } from "@/components/orders/PrintInvoice";

import { CustomerCard } from "@/components/order-detail/CustomerCard";
import { CourierHistoryCard } from "@/components/order-detail/CourierHistoryCard";
import { OrderItemsCard } from "@/components/order-detail/OrderItemsCard";
import { DeliveryPaymentCard } from "@/components/order-detail/DeliveryPaymentCard";
import { StatusSidebar } from "@/components/order-detail/StatusSidebar";
import { OrderInfoCard } from "@/components/order-detail/OrderInfoCard";
import { ActivityLog } from "@/components/order-detail/ActivityLog";
import { ExchangeHistoryCard } from "@/components/exchanges/ExchangeHistoryCard";
import { CreateExchangeModal } from "@/components/exchanges/CreateExchangeModal";

/* ─── STATUS CONFIG ─── */
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-800" },
  confirmed: { label: "Confirmed", color: "bg-emerald-100 text-emerald-800" },
  processing: { label: "Processing", color: "bg-amber-100 text-amber-800" },
  shipped: { label: "Shipped", color: "bg-blue-100 text-blue-800" },
  delivered: { label: "Delivered", color: "bg-emerald-100 text-emerald-800" },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-800" },
  confirm: { label: "Good", color: "bg-emerald-100 text-emerald-800" },
  good_but_no_response: { label: "Good No Resp", color: "bg-slate-100 text-slate-800" },
  no_response: { label: "No Response", color: "bg-slate-100 text-slate-700" },
  on_hold: { label: "On Hold", color: "bg-yellow-100 text-yellow-800" },
  advance_payment: { label: "Advance", color: "bg-blue-100 text-blue-800" },
  cancel: { label: "Cancelled", color: "bg-red-100 text-red-800" },
};

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { settings: company } = useCompanySettings();
  const { invoiceSettings } = useInvoiceSettings();

  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [exchangeOpen, setExchangeOpen] = useState(false);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [finalizing, setFinalizing] = useState(false);
  const [deliveryForm, setDeliveryForm] = useState({
    city: "", zone: "", area: "", fullName: "", phone: "",
    address: "", note: "", advanceEnabled: false, advanceVia: "",
    advanceAmount: 0, advanceTxnId: "",
  });

  /* ── Queries ── */
  const { data: order, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, customers(full_name, phone, phone2, address, district, thana, segment, total_orders, total_spent, email)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: items } = useQuery({
    queryKey: ["order-items", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("*, products(name, sku, image_url, stock_quantity)")
        .eq("order_id", id!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  // Populate local state from fetched data
  useEffect(() => {
    if (items) setOrderItems(items);
  }, [items]);

  useEffect(() => {
    if (!order) return;
    const c = order.customers as any;
    setPendingStatus(order.web_order_status || order.status || "pending");
    setDeliveryForm({
      city: order.delivery_district || c?.district || "",
      zone: order.delivery_thana || c?.thana || "",
      area: "",
      fullName: c?.full_name || "",
      phone: c?.phone || "",
      address: order.delivery_address || c?.address || "",
      note: order.notes || "",
      advanceEnabled: !!order.cod_amount && order.cod_amount < (order.total_amount || 0),
      advanceVia: order.payment_method || "",
      advanceAmount: order.cod_amount ? (order.total_amount || 0) - order.cod_amount : 0,
      advanceTxnId: "",
    });
  }, [order]);

  const customer = order?.customers as any;
  const customerPhone = customer?.phone || "";

  const { data: bdReport } = useBDCourierSingle(customerPhone, !!customer);
  const successRate = bdReport?.success_rate ?? 0;

  /* ── Save mutation ── */
  const saveMutation = useMutation({
    mutationFn: async () => {
      const oldStatus = order?.web_order_status || order?.status || "pending";
      const newStatus = pendingStatus || oldStatus;

      // Update order
      const updates: any = {
        status: newStatus === "confirm" ? "pending" : newStatus,
        web_order_status: newStatus,
        delivery_district: deliveryForm.city,
        delivery_thana: deliveryForm.zone,
        delivery_address: deliveryForm.address,
        notes: deliveryForm.note,
        updated_at: new Date().toISOString(),
      };
      if (deliveryForm.advanceEnabled && deliveryForm.advanceAmount > 0) {
        updates.payment_method = deliveryForm.advanceVia || "cash";
        const subtotal = orderItems.reduce((s, i) => s + (i.unit_price * i.quantity), 0);
        const totalDisc = orderItems.reduce((s, i) => s + (i.discount || 0), 0);
        const grand = subtotal - totalDisc + (order?.delivery_charge || 0);
        updates.cod_amount = grand - deliveryForm.advanceAmount;
      }

      const { error } = await supabase.from("orders").update(updates).eq("id", id!);
      if (error) throw error;

      // Update order items
      // Delete old items, insert new
      await supabase.from("order_items").delete().eq("order_id", id!);
      if (orderItems.length > 0) {
        const inserts = orderItems.map(i => ({
          order_id: id,
          product_id: i.product_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
          discount: i.discount || 0,
          total_price: i.total_price,
          product_name_fallback: i.product_name_fallback || (i.products as any)?.name || null,
        }));
        const { error: itemsErr } = await supabase.from("order_items").insert(inserts);
        if (itemsErr) throw itemsErr;
      }

      // Log status change
      if (newStatus !== oldStatus) {
        await supabase.from("order_activity_log").insert({
          order_id: id,
          action: `Status changed from ${oldStatus} to ${newStatus}`,
          old_status: oldStatus,
          new_status: newStatus,
          done_by: "Staff",
        });
      }

      // Recalculate totals
      const subtotal = orderItems.reduce((s, i) => s + (i.unit_price * i.quantity), 0);
      const totalDisc = orderItems.reduce((s, i) => s + (i.discount || 0), 0) + (order?.discount || 0);
      const grand = subtotal - totalDisc + (order?.delivery_charge || 0);
      await supabase.from("orders").update({
        subtotal, total_amount: grand,
      }).eq("id", id!);
    },
    onSuccess: () => {
      toast({ title: "✅ Order saved successfully" });
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      queryClient.invalidateQueries({ queryKey: ["order-items", id] });
      queryClient.invalidateQueries({ queryKey: ["order-activity-log", id] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handlePrintInvoice = useCallback(() => {
    if (!order) return;
    const orderWithItems = { ...order, order_items: items || [] };
    printInvoice(orderWithItems, company, invoiceSettings);
  }, [order, items, company, invoiceSettings]);

  const handleStatusChange = (status: string) => {
    setPendingStatus(status);
    toast({ title: `Status set to ${STATUS_LABELS[status]?.label || status}`, description: "Click Save Order to apply" });
  };

  /* ── Loading ── */
  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <Skeleton className="h-14 w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          <div className="space-y-5">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
            <Skeleton className="h-80 w-full rounded-xl" />
          </div>
          <div className="space-y-5">
            <Skeleton className="h-72 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!order) return <div className="text-center py-12 text-muted-foreground">Order not found</div>;

  const currentStatus = pendingStatus || order.web_order_status || order.status || "pending";
  const statusCfg = STATUS_LABELS[currentStatus] || { label: currentStatus, color: "bg-muted text-muted-foreground" };
  const isLegacy = (order as any).order_source === "LEGACY";
  const isLegacyFinalized = (order as any).legacy_finalized === true;

  const handleFinalizeLegacy = async () => {
    setFinalizing(true);
    const result = await finalizeLegacyOrder(order.id);
    setFinalizing(false);
    if (result.success) {
      toast({ title: "✅ Legacy order finalized", description: `${result.journalIds.length} GL entries posted` });
      queryClient.invalidateQueries({ queryKey: ["order", id] });
    } else {
      toast({ title: "⚠️ Finalize incomplete", description: result.exceptions.join("; "), variant: "destructive" });
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6 animate-fade-in" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

        {/* ═══ STICKY HEADER ═══ */}
        <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl -mx-6 px-6 py-4 border-b border-border/50">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/orders")} className="shrink-0 rounded-xl">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl font-bold tracking-tight">#{order.order_number}</h1>
                  <Badge className={cn("text-xs", statusCfg.color)}>{statusCfg.label}</Badge>
                  {isLegacy && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-amber-300 bg-amber-50 text-amber-700 font-semibold">
                      LEGACY {isLegacyFinalized ? "✓ FINALIZED" : "• UNPOSTED"}
                    </Badge>
                  )}
                  {isLegacy && (order as any).legacy_status && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-muted text-muted-foreground">
                      Legacy: {(order as any).legacy_status}
                    </Badge>
                  )}
                  {isLegacy && (order as any).courier_final_status && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-blue-300 bg-blue-50 text-blue-700">
                      Courier: {(order as any).courier_final_status}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{formatDateTime(order.created_at)}</p>
              </div>
            </div>
            <div className="flex gap-2">
              {isLegacy && !isLegacyFinalized && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs h-9 rounded-xl border-amber-300 text-amber-700 hover:bg-amber-50"
                  onClick={handleFinalizeLegacy}
                  disabled={finalizing}
                >
                  {finalizing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                  Finalize Legacy Posting
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-9 rounded-xl"
                onClick={handlePrintInvoice}
              >
                <Printer className="w-3.5 h-3.5" /> Print Invoice
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-9 rounded-xl"
                onClick={() => setExchangeOpen(true)}
              >
                <ArrowRightLeft className="w-3.5 h-3.5" /> Exchange
              </Button>
              <Button
                size="sm"
                className="gap-1.5 text-xs h-9 rounded-xl bg-[#6c63ff] hover:bg-[#5a52d5] text-white"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || (isLegacy && !isLegacyFinalized)}
              >
                <Save className="w-3.5 h-3.5" /> Save Changes
              </Button>
            </div>
          </div>
        </div>

        {/* ═══ TWO COLUMN LAYOUT ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">

          {/* ════ LEFT COLUMN ════ */}
          <div className="space-y-5">
            <CustomerCard order={order} customer={customer} />
            <CourierHistoryCard phone={customerPhone} orderId={id!} />
            <OrderItemsCard items={orderItems} onItemsChange={setOrderItems} />
            <DeliveryPaymentCard
              order={order}
              items={orderItems}
              deliveryForm={deliveryForm}
              onFormChange={setDeliveryForm}
            />
            <ExchangeHistoryCard orderId={id!} />
          </div>

          {/* ════ RIGHT COLUMN (sticky) ════ */}
          <div className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            <StatusSidebar
              currentStatus={currentStatus}
              onStatusChange={handleStatusChange}
              onSave={() => saveMutation.mutate()}
              isSaving={saveMutation.isPending}
            />
            <OrderInfoCard order={order} successRate={successRate} />
            <ActivityLog orderId={id!} />
          </div>
        </div>
      </div>

      {/* Exchange Modal */}
      {exchangeOpen && (
        <CreateExchangeModal
          open={exchangeOpen}
          onOpenChange={setExchangeOpen}
          order={order}
          orderItems={orderItems}
        />
      )}
    </TooltipProvider>
  );
}
