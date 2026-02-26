import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime, formatBDT, formatDate } from "@/lib/format";
import { calculateNetPayable } from "@/lib/courier-calc";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Printer, Copy, Phone, MessageCircle, MapPin, Package, Activity,
  Truck, RefreshCw, Loader2, AlertTriangle, CheckCircle2, XCircle, Clock,
  CreditCard, Shield, ExternalLink, FileText, ChevronRight, User, ShoppingBag, ArrowRightLeft
} from "lucide-react";
import { useBDCourierSingle, getRiskLevel } from "@/hooks/use-bd-courier";
import { useCompanySettings } from "@/hooks/use-company-settings";
import { useInvoiceSettings } from "@/hooks/use-invoice-settings";
import { printInvoice } from "@/components/orders/PrintInvoice";
import { isTransitionAllowed, getAllowedTransitions } from "@/hooks/use-orders";
import { useOrderExchanges } from "@/hooks/use-exchanges";
import { useOrderReturnCases } from "@/hooks/use-return-cases";
import { ExchangeInitiateModal } from "@/components/orders/ExchangeInitiateModal";
import { ExchangeSummaryCard } from "@/components/orders/ExchangeSummaryCard";
import { ReturnPendingCard } from "@/components/orders/ReturnPendingCard";

/* ─── ERP STATUS CONFIG ─── */
const ERP_STATUSES: Record<string, { label: string; color: string; icon: any; bg: string }> = {
  pending:      { label: "Pending",    color: "text-amber-700",   icon: Clock,          bg: "bg-amber-100" },
  packed:       { label: "Packed",     color: "text-blue-700",    icon: Package,        bg: "bg-blue-100" },
  ready_to_ship:{ label: "RTS",        color: "text-cyan-700",    icon: Truck,          bg: "bg-cyan-100" },
  shipped:      { label: "Shipped",    color: "text-indigo-700",  icon: Truck,          bg: "bg-indigo-100" },
  in_transit:   { label: "In Transit", color: "text-violet-700",  icon: Truck,          bg: "bg-violet-100" },
  delivered:    { label: "Delivered",  color: "text-emerald-700", icon: CheckCircle2,   bg: "bg-emerald-100" },
  returned:     { label: "Returned",   color: "text-orange-700",  icon: RefreshCw,      bg: "bg-orange-100" },
  cancelled:    { label: "Cancelled",  color: "text-red-700",     icon: XCircle,        bg: "bg-red-100" },
  damage_return:{ label: "Damage",     color: "text-red-700",     icon: AlertTriangle,  bg: "bg-red-100" },
  exchanged:    { label: "Exchanged",  color: "text-purple-700",  icon: RefreshCw,      bg: "bg-purple-100" },
  completed:    { label: "Completed",  color: "text-emerald-700", icon: CheckCircle2,   bg: "bg-emerald-100" },
};

/* ─── Error Boundary ─── */
import React from "react";
class OrderDetailErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="p-8 text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto" />
          <h2 className="text-lg font-semibold">Something went wrong</h2>
          <p className="text-sm text-muted-foreground">{this.state.error.message}</p>
          <Button variant="outline" onClick={() => window.location.reload()}>Reload Page</Button>
        </div>
      );
    }
    return this.state.error ? null : this.props.children;
  }
}

function OrderDetailInner() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { settings: company } = useCompanySettings();
  const { invoiceSettings } = useInvoiceSettings();

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

  const { data: activityLogs } = useQuery({
    queryKey: ["order-activity-log", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_activity_log")
        .select("*")
        .eq("order_id", id!)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const { data: couriers } = useQuery({
    queryKey: ["couriers-list"],
    queryFn: async () => {
      const { data } = await supabase.from("couriers").select("id, name").eq("is_active", true);
      return data || [];
    },
  });

  const customer = order?.customers as any;
  const phone = customer?.phone || "";
  const { data: bdReport } = useBDCourierSingle(phone, !!customer);
  const riskLevel = getRiskLevel(bdReport?.success_rate);

  const [showExchangeModal, setShowExchangeModal] = useState(false);

  const { data: orderExchanges } = useOrderExchanges(id);
  const { data: returnCases } = useOrderReturnCases(id);
  const status = order?.status || "pending";
  const statusCfg = ERP_STATUSES[status] || ERP_STATUSES.pending;
  const StatusIcon = statusCfg.icon;
  const isLegacy = (order as any)?.order_source === "LEGACY";
  const isPending = status === "pending";
  const isLocked = ["delivered", "returned", "cancelled", "damage_return", "completed", "exchanged"].includes(status);
  const isDelivered = status === "delivered";
  const isInTransit = status === "in_transit";
  const canExchangeStatus = isDelivered || isInTransit;
  const hasFullExchange = (orderExchanges || []).some(e => e.status === "completed" || e.status === "replacement_sent");
  const canInitiateExchange = canExchangeStatus && !hasFullExchange;

  // Courier charges computed
  const netPayableResult = useMemo(() => {
    if (!order) return null;
    return calculateNetPayable({
      collectable_amount: order.total_amount,
      courier_delivery_fee: order.courier_delivery_fee,
      courier_cod_fee: order.courier_cod_fee,
      courier_discount: order.courier_discount,
      courier_promo_discount: order.courier_promo_discount,
      courier_additional_charge: order.courier_additional_charge,
      courier_compensation_cost: order.courier_compensation_cost,
    });
  }, [order]);

  // Exceptions
  const exceptions = useMemo(() => {
    if (!order) return [];
    const ex: string[] = [];
    if (status === "delivered" && !order.courier_delivery_fee && order.courier_delivery_fee !== 0) ex.push("Missing courier cost for delivered order");
    if (["shipped", "in_transit"].includes(status) && !order.pathao_tracking_code && !(order as any).legacy_tracking_id) ex.push("Missing tracking ID");
    if (netPayableResult && netPayableResult.netPayable < 0) ex.push("Net payable is negative");
    if (order.settlement_posted && !order.settlement_journal_id) ex.push("Settlement posted without journal");
    return ex;
  }, [order, status, netPayableResult]);

  /* ── Status change mutation ── */
  const statusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const { error } = await supabase.from("orders").update({
        status: newStatus,
        updated_at: new Date().toISOString(),
        ...(newStatus === "delivered" ? { delivered_at: new Date().toISOString() } : {}),
        ...(newStatus === "cancelled" ? { cancelled_at: new Date().toISOString() } : {}),
      }).eq("id", id!);
      if (error) throw error;

      await supabase.from("order_activity_log").insert({
        order_id: id,
        action: `Status changed: ${status} → ${newStatus}`,
        old_status: status,
        new_status: newStatus,
        done_by: "Staff",
      });
    },
    onSuccess: () => {
      toast({ title: "✅ Status updated" });
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      queryClient.invalidateQueries({ queryKey: ["order-activity-log", id] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const allowedTransitions = useMemo(() => getAllowedTransitions(status), [status]);

  const handlePrint = useCallback(() => {
    if (!order) return;
    printInvoice({ ...order, order_items: items || [] }, company, invoiceSettings);
  }, [order, items, company, invoiceSettings]);

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied!` });
  };

  /* ── Loading ── */
  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-14 w-full rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
          <div className="space-y-4">
            {[200, 160, 200, 300].map((h, i) => <Skeleton key={i} className={`h-[${h}px] w-full rounded-xl`} />)}
          </div>
          <div className="space-y-4">
            {[200, 160, 200].map((h, i) => <Skeleton key={i} className={`h-[${h}px] w-full rounded-xl`} />)}
          </div>
        </div>
      </div>
    );
  }

  if (!order) return <div className="text-center py-16 text-muted-foreground">Order not found</div>;

  const subtotal = (items || []).reduce((s, i) => s + (i.unit_price * i.quantity), 0);
  const totalDiscount = (items || []).reduce((s, i) => s + (i.discount || 0), 0) + (order.discount || 0);
  const deliveryCharge = order.delivery_charge || 0;
  const grandTotal = order.total_amount || (subtotal - totalDiscount + deliveryCharge);
  const advancePaid = order.advance_amount || 0;
  const remaining = grandTotal - advancePaid;
  const invoiceDisplay = order.invoice_id || order.order_number || id;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-5 animate-fade-in">

        {/* ═══ STICKY HEADER ═══ */}
        <div className="sticky top-0 z-20 bg-background/90 backdrop-blur-xl -mx-6 px-6 py-3.5 border-b border-border/40">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/orders")} className="rounded-xl shrink-0">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl font-bold tracking-tight">{invoiceDisplay}</h1>
                  <Badge className={cn("text-xs gap-1", statusCfg.bg, statusCfg.color)}>
                    <StatusIcon className="w-3 h-3" /> {statusCfg.label}
                  </Badge>
                  {order.return_pending && (
                    <Badge className="text-[9px] px-1.5 py-0 bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950/40">
                      ⏳ Return Pending
                    </Badge>
                  )}
                  {isLegacy && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-amber-300 bg-amber-50 text-amber-700">LEGACY</Badge>
                  )}
                  {(order as any).courier_final_status && (order as any).courier_final_status !== "UNKNOWN" && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-blue-300 bg-blue-50 text-blue-700">
                      Courier: {(order as any).courier_final_status}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatDateTime(order.order_date || order.created_at)} · {order.channel || "Manual"}
                </p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 rounded-xl" onClick={handlePrint}>
                <Printer className="w-3.5 h-3.5" /> Print
              </Button>
              {order.pathao_tracking_code && (
                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 rounded-xl"
                  onClick={() => copyText(order.pathao_tracking_code!, "Tracking ID")}>
                  <Copy className="w-3.5 h-3.5" /> Copy Tracking
                </Button>
              )}
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 rounded-xl"
                onClick={() => navigate("/crm")}>
                <User className="w-3.5 h-3.5" /> CRM
              </Button>
            </div>
          </div>
        </div>

        {/* ═══ TWO COLUMN LAYOUT ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">

          {/* ════ LEFT COLUMN ════ */}
          <div className="space-y-4">

            {/* ── CUSTOMER ── */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <p className="font-semibold text-sm">{customer?.full_name || "Unknown"}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-muted-foreground">{phone}</span>
                      <Tooltip><TooltipTrigger asChild>
                        <button onClick={() => window.open(`tel:${phone}`)} className="p-1 rounded hover:bg-muted"><Phone className="w-3.5 h-3.5 text-sky-600" /></button>
                      </TooltipTrigger><TooltipContent className="text-xs">Call</TooltipContent></Tooltip>
                      <Tooltip><TooltipTrigger asChild>
                        <button onClick={() => window.open(`https://wa.me/88${phone.replace(/^0/,"")}`,"_blank")} className="p-1 rounded hover:bg-muted"><MessageCircle className="w-3.5 h-3.5 text-emerald-600" /></button>
                      </TooltipTrigger><TooltipContent className="text-xs">WhatsApp</TooltipContent></Tooltip>
                      <button onClick={() => copyText(phone,"Phone")} className="p-1 rounded hover:bg-muted"><Copy className="w-3 h-3 text-muted-foreground" /></button>
                    </div>
                    {(order.delivery_address || customer?.address) && (
                      <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                        <span className="flex-1">{order.delivery_address || customer?.address}</span>
                        <button onClick={() => copyText(order.delivery_address || customer?.address,"Address")} className="p-0.5 rounded hover:bg-muted shrink-0"><Copy className="w-3 h-3" /></button>
                      </div>
                    )}
                    {(order.delivery_district || customer?.district) && (
                      <Badge variant="outline" className="text-[10px]">{order.delivery_district || customer?.district}{order.delivery_thana ? ` / ${order.delivery_thana}` : ""}</Badge>
                    )}
                  </div>
                  <div className="text-right space-y-1 shrink-0">
                    <Badge className={cn("text-[10px]", riskLevel.bg, riskLevel.color)}>{riskLevel.label}</Badge>
                    {(customer?.total_orders || 0) > 0 && (
                      <p className="text-[10px] text-muted-foreground">{customer.total_orders} orders · {formatBDT(customer.total_spent || 0)}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── ITEMS + PRICING ── */}
            <Card>
              <CardHeader className="pb-2 px-4 pt-4">
                <CardTitle className="text-sm flex items-center gap-2"><Package className="w-4 h-4 text-primary" /> Items ({(items || []).length})</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                {(items || []).map((item) => {
                  const p = item.products as any;
                  const name = p?.name || item.product_name_fallback || "Product";
                  return (
                    <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                      <div className="w-10 h-10 rounded-lg overflow-hidden border border-border shrink-0 bg-muted">
                        {p?.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-cover" /> :
                          <div className="w-full h-full flex items-center justify-center text-xs font-bold text-muted-foreground">{name[0]}</div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{name}</p>
                        <p className="text-[10px] text-muted-foreground">{p?.sku || "—"}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-semibold">{formatBDT(item.unit_price)} × {item.quantity}</p>
                        <p className="text-[10px] text-muted-foreground">{formatBDT(item.total_price || item.unit_price * item.quantity)}</p>
                      </div>
                    </div>
                  );
                })}

                {/* Summary */}
                <div className="rounded-xl bg-muted/30 p-3 space-y-1.5 border border-border/30">
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Subtotal</span><span>{formatBDT(subtotal)}</span></div>
                  {totalDiscount > 0 && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Discount</span><span className="text-destructive">-{formatBDT(totalDiscount)}</span></div>}
                  {deliveryCharge > 0 && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Delivery Charge</span><span>{formatBDT(deliveryCharge)}</span></div>}
                  <div className="border-t border-border/30 pt-1.5 flex justify-between">
                    <span className="text-sm font-bold">Total</span>
                    <span className="text-sm font-bold text-primary">{formatBDT(grandTotal)}</span>
                  </div>
                  {advancePaid > 0 && (
                    <>
                      <div className="flex justify-between text-xs"><span className="text-emerald-600">Advance Paid</span><span className="text-emerald-600">-{formatBDT(advancePaid)}</span></div>
                      <div className="flex justify-between text-xs font-semibold"><span className="text-amber-600">COD Remaining</span><span className="text-amber-600">{formatBDT(remaining)}</span></div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* ── COURIER & CHARGES ── */}
            <Card>
              <CardHeader className="pb-2 px-4 pt-4">
                <CardTitle className="text-sm flex items-center gap-2"><Truck className="w-4 h-4 text-primary" /> Courier & Charges</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Courier</Label>
                    <p className="text-sm font-medium">{(order as any).legacy_courier_name || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Tracking ID</Label>
                    <div className="flex items-center gap-1">
                      <p className="text-sm font-mono">{order.pathao_tracking_code || (order as any).legacy_tracking_id || "—"}</p>
                      {(order.pathao_tracking_code || (order as any).legacy_tracking_id) && (
                        <button onClick={() => copyText(order.pathao_tracking_code || (order as any).legacy_tracking_id, "Tracking")} className="p-0.5 rounded hover:bg-muted"><Copy className="w-3 h-3 text-muted-foreground" /></button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Sync Status</Label>
                    <Badge variant="outline" className={cn("text-[10px]",
                      (order as any).courier_sync_status === "SYNCED" ? "border-emerald-300 bg-emerald-50 text-emerald-700" :
                      (order as any).courier_sync_status === "SYNC_ERROR" ? "border-red-300 bg-red-50 text-red-700" :
                      "border-muted text-muted-foreground"
                    )}>
                      {(order as any).courier_sync_status || "NOT_SYNCED"}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Courier Final</Label>
                    <p className="text-xs font-medium">{(order as any).courier_final_status || "—"}</p>
                  </div>
                </div>

                {/* Charge breakdown */}
                <div className="rounded-xl bg-muted/30 p-3 space-y-1 border border-border/30 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Delivery Fee</span><span>{formatBDT(order.courier_delivery_fee || 0)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">COD Fee</span><span>{formatBDT(order.courier_cod_fee || 0)}</span></div>
                  {(order.courier_discount || 0) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="text-emerald-600">-{formatBDT(order.courier_discount)}</span></div>}
                  {(order.courier_additional_charge || 0) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Additional</span><span>{formatBDT(order.courier_additional_charge)}</span></div>}
                  {(order.courier_compensation_cost || 0) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Compensation</span><span>{formatBDT(order.courier_compensation_cost)}</span></div>}
                  <div className="border-t border-border/30 pt-1 flex justify-between font-semibold">
                    <span>Total Cost</span><span>{formatBDT(netPayableResult?.totalCost || order.courier_total_cost || 0)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-primary">
                    <span>Net Payable</span><span>{formatBDT(netPayableResult?.netPayable || order.courier_net_payable || 0)}</span>
                  </div>
                  {order.courier_return_cost > 0 && (
                    <div className="flex justify-between text-orange-600"><span>Return Cost</span><span>{formatBDT(order.courier_return_cost)}</span></div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* ── PAYMENT & ADVANCE ── */}
            {advancePaid > 0 && (
              <Card>
                <CardHeader className="pb-2 px-4 pt-4">
                  <CardTitle className="text-sm flex items-center gap-2"><CreditCard className="w-4 h-4 text-primary" /> Advance Payment</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div><Label className="text-[10px] text-muted-foreground">Amount</Label><p className="text-sm font-semibold text-emerald-600">{formatBDT(advancePaid)}</p></div>
                    <div><Label className="text-[10px] text-muted-foreground">Method</Label><p className="text-sm">{order.advance_method || order.payment_method || "—"}</p></div>
                    <div><Label className="text-[10px] text-muted-foreground">Posted</Label>
                      <Badge variant="outline" className={cn("text-[10px]", order.advance_posted ? "border-emerald-300 text-emerald-700" : "border-amber-300 text-amber-700")}>
                        {order.advance_posted ? "Posted" : "Pending"}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── NOTES ── */}
            {order.notes && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <p className="text-sm text-muted-foreground">{order.notes}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── EXCHANGE SUMMARY ── */}
            {orderExchanges && orderExchanges.length > 0 && (
              <ExchangeSummaryCard exchanges={orderExchanges} orderId={id!} />
            )}

            {/* ── RETURN PENDING ── */}
            {returnCases && returnCases.length > 0 && (
              <ReturnPendingCard returnCases={returnCases} />
            )}

            {/* ── TIMELINE ── */}
            <Card>
              <CardHeader className="pb-2 px-4 pt-4">
                <CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /> Timeline</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {(!activityLogs || activityLogs.length === 0) ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No activity recorded</p>
                ) : (
                  <div className="space-y-0">
                    {activityLogs.map((log, i) => (
                      <div key={log.id} className="flex gap-3 relative">
                        <div className="flex flex-col items-center">
                          <div className={cn("w-2 h-2 rounded-full shrink-0 mt-1.5 ring-2 ring-background", i === 0 ? "bg-primary" : "bg-muted-foreground/30")} />
                          {i < activityLogs.length - 1 && <div className="w-px flex-1 bg-border/50 mt-1" />}
                        </div>
                        <div className="pb-3 flex-1 min-w-0">
                          <p className="text-xs font-medium">{log.action}</p>
                          {log.old_status && log.new_status && (
                            <p className="text-[10px] text-muted-foreground">{log.old_status} → {log.new_status}</p>
                          )}
                          <div className="flex items-center gap-2 mt-0.5">
                            {log.done_by && <span className="text-[10px] text-primary">{log.done_by}</span>}
                            <span className="text-[10px] text-muted-foreground">{formatDateTime(log.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ════ RIGHT COLUMN (sticky) ════ */}
          <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">

            {/* ── STATUS CONTROL ── */}
            <Card className="border-primary/20">
              <CardHeader className="pb-2 px-4 pt-4">
                <CardTitle className="text-sm flex items-center gap-2"><Shield className="w-4 h-4 text-primary" /> Status Control</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                {/* Current status */}
                <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/50 border border-border/30">
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", statusCfg.bg)}>
                    <StatusIcon className={cn("w-4 h-4", statusCfg.color)} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Current Status</p>
                    <p className={cn("text-sm font-bold", statusCfg.color)}>{statusCfg.label}</p>
                  </div>
                </div>

                {/* Next actions */}
                {allowedTransitions.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Next Actions</p>
                    <div className="grid grid-cols-1 gap-1.5">
                      {allowedTransitions.map((t) => {
                        const tCfg = ERP_STATUSES[t] || { label: t, color: "text-foreground", bg: "bg-muted", icon: ChevronRight };
                        const TIcon = tCfg.icon;
                        return (
                          <Button
                            key={t}
                            variant="outline"
                            size="sm"
                            className={cn("justify-start gap-2 text-xs h-9 rounded-xl", tCfg.color)}
                            onClick={() => statusMutation.mutate(t)}
                            disabled={statusMutation.isPending}
                          >
                            {statusMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TIcon className="w-3.5 h-3.5" />}
                            Mark as {tCfg.label}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {isLocked && (
                  <p className="text-[10px] text-muted-foreground text-center py-2">
                    This order is {statusCfg.label.toLowerCase()}. Admin reversal required for changes.
                  </p>
                )}

                {/* Exchange Button */}
                {canInitiateExchange && (
                  <div className="pt-1 border-t border-border/30 space-y-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs h-9 rounded-xl gap-1.5 border-amber-400 text-amber-700 hover:bg-amber-50 dark:border-amber-600 dark:text-amber-400 dark:hover:bg-amber-950"
                      onClick={() => setShowExchangeModal(true)}
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" /> Initiate Exchange
                    </Button>
                    <p className="text-[9px] text-muted-foreground text-center leading-tight">
                      Use for wrong/defective item cases. Creates a linked exchange order.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── SETTLEMENT / FINANCE ── */}
            <Card>
              <CardHeader className="pb-2 px-4 pt-4">
                <CardTitle className="text-sm flex items-center gap-2"><CreditCard className="w-4 h-4 text-primary" /> Settlement</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Status</span>
                  <Badge variant="outline" className={cn("text-[10px]",
                    order.settlement_posted ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-amber-300 bg-amber-50 text-amber-700"
                  )}>
                    {order.settlement_posted ? "Posted" : "Pending"}
                  </Badge>
                </div>
                {order.settlement_posted_at && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Posted at</span>
                    <span className="text-xs">{formatDate(order.settlement_posted_at)}</span>
                  </div>
                )}
                <Button variant="outline" size="sm" className="w-full text-xs h-8 rounded-xl gap-1.5 mt-1"
                  onClick={() => navigate("/finance/settlements")}>
                  <ExternalLink className="w-3 h-3" /> Go to Settlements
                </Button>
              </CardContent>
            </Card>

            {/* ── EXCEPTIONS ── */}
            {exceptions.length > 0 && (
              <Card className="border-destructive/30">
                <CardHeader className="pb-2 px-4 pt-4">
                  <CardTitle className="text-sm flex items-center gap-2 text-destructive"><AlertTriangle className="w-4 h-4" /> Exceptions ({exceptions.length})</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-1.5">
                  {exceptions.map((ex, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-destructive">
                      <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                      <span>{ex}</span>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="w-full text-xs h-8 rounded-xl gap-1.5 mt-1 text-destructive border-destructive/30"
                    onClick={() => navigate("/exceptions")}>
                    <ExternalLink className="w-3 h-3" /> View in Exceptions Center
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* ── ORDER INFO ── */}
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-muted/50"><span className="text-muted-foreground block text-[10px]">Order Source</span><span className="font-medium capitalize">{order.channel || "Manual"}</span></div>
                  <div className="p-2 rounded-lg bg-muted/50"><span className="text-muted-foreground block text-[10px]">Payment</span><span className="font-medium capitalize">{order.payment_method || "COD"}</span></div>
                  <div className="p-2 rounded-lg bg-muted/50"><span className="text-muted-foreground block text-[10px]">Created</span><span className="font-medium">{formatDate(order.created_at)}</span></div>
                  <div className="p-2 rounded-lg bg-muted/50"><span className="text-muted-foreground block text-[10px]">BD Courier Rate</span><span className="font-medium">{bdReport?.success_rate ?? "N/A"}%</span></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      {/* Exchange Modal */}
      {order && items && (
        <ExchangeInitiateModal
          open={showExchangeModal}
          onOpenChange={setShowExchangeModal}
          order={order}
          orderItems={items}
        />
      )}
    </TooltipProvider>
  );
}

export default function OrderDetail() {
  return (
    <OrderDetailErrorBoundary>
      <OrderDetailInner />
    </OrderDetailErrorBoundary>
  );
}
