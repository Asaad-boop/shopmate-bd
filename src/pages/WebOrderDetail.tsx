import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { formatBDT, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Phone, MessageCircle, Send, Clock, MapPin,
  Package, Wallet, CheckCircle2, RefreshCw, Copy, ExternalLink,
  Plus, Minus, X, Search, ShieldCheck, Truck,
} from "lucide-react";
import {
  AlertDialog as AlertDialogRoot,
  AlertDialogAction as ADAction,
  AlertDialogCancel as ADCancel,
  AlertDialogContent as ADContent,
  AlertDialogDescription as ADDesc,
  AlertDialogFooter as ADFooter,
  AlertDialogHeader as ADHeader,
  AlertDialogTitle as ADTitle,
  AlertDialogTrigger as ADTrigger,
} from "@/components/ui/alert-dialog";
import { useBDCourierSingle, getRiskLevel, getSuccessColor } from "@/hooks/use-bd-courier";
import { PathaoBookingModal } from "@/components/pathao/PathaoBookingModal";
import { PathaoTrackingCard } from "@/components/pathao/PathaoTrackingCard";

/* ──────────────── STATUS CONFIG ──────────────── */
const STATUS_BUTTONS = [
  { key: "processing", label: "Processing", emoji: "🟡", bg: "bg-yellow-500", text: "text-yellow-700", border: "border-yellow-400", light: "bg-yellow-50" },
  { key: "confirm", label: "Confirm", emoji: "🟢", bg: "bg-green-500", text: "text-green-700", border: "border-green-400", light: "bg-green-50" },
  { key: "good_but_no_response", label: "Good No Resp", emoji: "🔵", bg: "bg-blue-500", text: "text-blue-700", border: "border-blue-400", light: "bg-blue-50" },
  { key: "no_response", label: "No Response", emoji: "🔴", bg: "bg-red-500", text: "text-red-700", border: "border-red-400", light: "bg-red-50" },
  { key: "on_hold", label: "On Hold", emoji: "⏸️", bg: "bg-indigo-500", text: "text-indigo-700", border: "border-indigo-400", light: "bg-indigo-50" },
  { key: "advance_payment", label: "Advance", emoji: "🟠", bg: "bg-orange-500", text: "text-orange-700", border: "border-orange-400", light: "bg-orange-50" },
] as const;

const CALL_OPTIONS = [
  { key: "answered", label: "Answered", emoji: "✅", active: "bg-green-500 text-white ring-green-500", idle: "text-green-700 ring-green-300 hover:bg-green-50" },
  { key: "no_answer", label: "No Answer", emoji: "📵", active: "bg-orange-500 text-white ring-orange-500", idle: "text-orange-700 ring-orange-300 hover:bg-orange-50" },
  { key: "busy", label: "Busy", emoji: "🔴", active: "bg-red-500 text-white ring-red-500", idle: "text-red-700 ring-red-300 hover:bg-red-50" },
  { key: "voicemail", label: "Voicemail", emoji: "📩", active: "bg-gray-500 text-white ring-gray-500", idle: "text-gray-600 ring-gray-300 hover:bg-gray-50" },
];

/* ──────────────── HELPERS ──────────────── */
const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const noteTypeDot = (type: string) => {
  switch (type) {
    case "call_log": return "bg-blue-500";
    case "status_change": return "bg-yellow-500";
    case "activity": return "bg-green-500";
    default: return "bg-gray-400";
  }
};

const segmentColors: Record<string, { bg: string; text: string; ring: string }> = {
  vip: { bg: "bg-amber-100", text: "text-amber-800", ring: "ring-amber-300" },
  regular: { bg: "bg-blue-100", text: "text-blue-800", ring: "ring-blue-300" },
  new: { bg: "bg-green-100", text: "text-green-800", ring: "ring-green-300" },
};

const avatarColors = [
  "from-blue-500 to-indigo-600",
  "from-emerald-500 to-teal-600",
  "from-orange-500 to-red-500",
  "from-purple-500 to-pink-600",
  "from-cyan-500 to-blue-600",
];

/* ──────────────── COMPONENT ──────────────── */
export default function WebOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newNote, setNewNote] = useState("");
  const [callResult, setCallResult] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showPathaoModal, setShowPathaoModal] = useState(false);

  /* ── Queries ── */
  const { data: order, isLoading } = useQuery({
    queryKey: ["web-order", id],
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
    queryKey: ["web-order-items", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("*, products(name, sku, image_url, stock_quantity)")
        .eq("order_id", id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: notes } = useQuery({
    queryKey: ["web-order-notes", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("web_order_notes")
        .select("*")
        .eq("order_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const customer = order?.customers as any;
  const customerPhone = customer?.phone || "";

  const { data: bdReport, isLoading: bdLoading, refetch: refetchBD } = useBDCourierSingle(customerPhone, !!customer);
  const riskInfo = getRiskLevel(bdReport?.success_rate);

  /* ── Mutations ── */
  const statusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const oldStatus = order?.web_order_status || "processing";
      const { error } = await supabase
        .from("orders")
        .update({ web_order_status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", id!);
      if (error) throw error;
      await supabase.from("web_order_notes").insert({
        order_id: id, note_type: "status_change",
        content: `Status changed from ${oldStatus} to ${newStatus}`,
        old_status: oldStatus, new_status: newStatus, created_by: "Staff",
      });
    },
    onSuccess: () => {
      toast({ title: "Status updated" });
      queryClient.invalidateQueries({ queryKey: ["web-order", id] });
      queryClient.invalidateQueries({ queryKey: ["web-order-notes", id] });
      queryClient.invalidateQueries({ queryKey: ["web-orders"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      // Update order: set status to 'pending' so it appears in Order List
      await supabase
        .from("orders")
        .update({ web_order_status: "confirm", status: "pending", updated_at: new Date().toISOString() })
        .eq("id", id!);

      // Apply stock decrease (pending = stock minus)
      const { data: orderItems } = await supabase
        .from("order_items")
        .select("product_id, quantity, products(id, name, stock_quantity)")
        .eq("order_id", id!);

      if (orderItems) {
        for (const item of orderItems) {
          const product = item.products as any;
          if (!product?.id) continue;
          await supabase
            .from("products")
            .update({
              stock_quantity: (product.stock_quantity || 0) - item.quantity,
              updated_at: new Date().toISOString(),
            })
            .eq("id", product.id);
          await supabase.from("inventory_movements").insert({
            product_id: product.id,
            movement_type: "order_pending",
            quantity: -item.quantity,
            reference_type: "order",
            reference_id: id,
            notes: "Web order confirmed → pending (stock decreased)",
          });
        }
      }

      await supabase.from("web_order_notes").insert({
        order_id: id, note_type: "activity",
        content: "Order confirmed and moved to Order List (Pending)", created_by: "Staff",
      });
    },
    onSuccess: () => {
      toast({ title: "✅ Order confirmed and moved to Order List!", description: "Stock has been adjusted" });
      setShowConfirmDialog(false);
      queryClient.invalidateQueries({ queryKey: ["web-order", id] });
      queryClient.invalidateQueries({ queryKey: ["web-order-notes", id] });
      queryClient.invalidateQueries({ queryKey: ["web-orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders-full"] });
      queryClient.invalidateQueries({ queryKey: ["order-status-counts"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const noteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("web_order_notes").insert({
        order_id: id, note_type: "note", content: newNote, created_by: "Staff",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewNote("");
      toast({ title: "Note added" });
      queryClient.invalidateQueries({ queryKey: ["web-order-notes", id] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const callLogMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("web_order_notes").insert({
        order_id: id, note_type: "call_log",
        content: `Call made — Result: ${callResult}`, call_result: callResult, created_by: "Staff",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setCallResult("");
      toast({ title: "Call logged" });
      queryClient.invalidateQueries({ queryKey: ["web-order-notes", id] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  /* ── Loading ── */
  if (isLoading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <Skeleton className="h-14 w-full rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-3 space-y-4"><Skeleton className="h-60 rounded-xl" /><Skeleton className="h-48 rounded-xl" /></div>
          <div className="lg:col-span-6 space-y-4"><Skeleton className="h-96 rounded-xl" /></div>
          <div className="lg:col-span-3 space-y-4"><Skeleton className="h-72 rounded-xl" /><Skeleton className="h-48 rounded-xl" /></div>
        </div>
      </div>
    );
  }

  if (!order) return <div className="text-center py-20 text-muted-foreground text-lg">Order not found</div>;

  const currentStatus = order.web_order_status || "processing";
  const statusConfig = STATUS_BUTTONS.find((s) => s.key === currentStatus);
  const callLogs = notes?.filter((n) => n.note_type === "call_log") || [];
  const segment = customer?.segment || "regular";
  const segColor = segmentColors[segment] || segmentColors.regular;
  const avatarGrad = avatarColors[(customer?.full_name?.charCodeAt(0) || 0) % avatarColors.length];
  const initial = (customer?.full_name || "?")[0].toUpperCase();

  return (
    <div className="animate-fade-in pb-8">
      {/* ═══════════ TOP HEADER ═══════════ */}
      <div className="bg-card border-b border-border px-5 py-3 -mx-4 -mt-4 mb-5 lg:-mx-6 lg:-mt-6">
        <div className="max-w-[1600px] mx-auto flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="icon" onClick={() => navigate("/web-orders")} className="rounded-lg h-9 w-9 shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-lg font-bold tracking-tight">{order.order_number}</h1>
          <Badge variant="secondary" className="capitalize rounded-md px-2 py-0.5 text-[11px] font-semibold bg-blue-100 text-blue-700 border-0">
            {order.channel}
          </Badge>
          {statusConfig && (
            <Badge className={cn("rounded-md px-2.5 py-0.5 text-[11px] font-semibold text-white border-0", statusConfig.bg)}>
              {statusConfig.emoji} {currentStatus.replace(/_/g, " ").toUpperCase()}
            </Badge>
          )}
          <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
            <span>Created: {timeAgo(order.created_at || "")}</span>
            <span className="hidden sm:inline">•</span>
            <span className="hidden sm:inline">Updated: {timeAgo(order.updated_at || "")}</span>
            <Badge variant="outline" className="rounded-md text-[10px] font-semibold uppercase">WEB</Badge>
          </div>
        </div>
      </div>

      {/* ═══════════ 3-COLUMN LAYOUT ═══════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 max-w-[1600px] mx-auto">

        {/* ──────── LEFT SIDEBAR ──────── */}
        <div className="lg:col-span-3 space-y-4 order-2 lg:order-1">

          {/* Customer Card */}
          <Card className="rounded-xl border-border/60 shadow-sm overflow-hidden">
            <CardContent className="p-0">
              {/* Avatar header */}
              <div className="flex items-center gap-3 p-4 pb-3">
                <div className={cn("w-12 h-12 rounded-full bg-gradient-to-br flex items-center justify-center text-white font-bold text-lg shrink-0", avatarGrad)}>
                  {initial}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm truncate">{customer?.full_name || "Unknown"}</h3>
                    <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold capitalize", segColor.bg, segColor.text)}>
                      {segment}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-xs text-muted-foreground font-mono">{customer?.phone || "-"}</span>
                    {customer?.phone && (
                      <>
                        <a href={`tel:${customer.phone}`} className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-green-100 text-green-700 hover:bg-green-200 transition-colors">
                          <Phone className="w-3 h-3" />
                        </a>
                        <a href={`https://wa.me/${customer.phone?.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-green-100 text-green-700 hover:bg-green-200 transition-colors">
                          <MessageCircle className="w-3 h-3" />
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </div>
              {/* Address */}
              {customer?.address && (
                <div className="px-4 pb-3">
                  <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                    <span className="line-clamp-2">{customer.address}, {[customer?.thana, customer?.district].filter(Boolean).join(", ")}</span>
                  </div>
                </div>
              )}
              {/* Stats */}
              <div className="grid grid-cols-3 border-t border-border/60">
                <div className="p-3 text-center border-r border-border/60">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Orders</p>
                  <p className="font-bold text-sm mt-0.5">{customer?.total_orders || 0}</p>
                </div>
                <div className="p-3 text-center border-r border-border/60">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Spent</p>
                  <p className="font-bold text-sm mt-0.5">{formatBDT(customer?.total_spent)}</p>
                </div>
                <div className="p-3 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Success</p>
                  <p className="font-bold text-sm mt-0.5" style={{ color: bdReport ? getSuccessColor(bdReport.success_rate) : undefined }}>
                    {bdReport ? `${Math.round(bdReport.success_rate)}%` : "--"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* BD Courier Quality */}
          <Card className="rounded-xl border-border/60 shadow-sm">
            <CardHeader className="p-4 pb-3 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-xs font-semibold">Quality Check</CardTitle>
              </div>
              <Button variant="ghost" size="icon" className="rounded-md w-7 h-7" onClick={() => refetchBD()}>
                <RefreshCw className={cn("w-3.5 h-3.5", bdLoading && "animate-spin")} />
              </Button>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {bdLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full rounded-lg" />
                  <div className="grid grid-cols-2 gap-2">
                    <Skeleton className="h-14 rounded-lg" />
                    <Skeleton className="h-14 rounded-lg" />
                  </div>
                </div>
              ) : !bdReport ? (
                <div className="text-center py-4">
                  <p className="text-2xl mb-1">🆕</p>
                  <p className="text-xs text-muted-foreground">New Customer</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Overall gauge */}
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
                    <div className="relative w-14 h-14 shrink-0">
                      <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                        <circle cx="28" cy="28" r="22" fill="none" stroke="hsl(var(--muted))" strokeWidth="5" />
                        <circle cx="28" cy="28" r="22" fill="none"
                          stroke={getSuccessColor(bdReport.success_rate)}
                          strokeWidth="5"
                          strokeDasharray={`${bdReport.success_rate * 1.382} 138.2`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm font-bold" style={{ color: getSuccessColor(bdReport.success_rate) }}>
                          {Math.round(bdReport.success_rate)}%
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold", riskInfo.bg, riskInfo.color)}>
                        {riskInfo.label}
                      </span>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {bdReport.total_orders} total orders
                      </p>
                    </div>
                  </div>
                  {/* Stats grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-lg bg-green-50 border border-green-100">
                      <p className="text-[10px] text-green-600 font-medium">Successful</p>
                      <p className="text-lg font-bold text-green-700">{bdReport.successful_orders}</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-red-50 border border-red-100">
                      <p className="text-[10px] text-red-600 font-medium">Returned</p>
                      <p className="text-lg font-bold text-red-700">{bdReport.returned_orders}</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-orange-50 border border-orange-100 col-span-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] text-orange-600 font-medium">Cancelled</p>
                          <p className="text-lg font-bold text-orange-700">{bdReport.cancelled_orders}</p>
                        </div>
                        {bdReport.last_fetched_at && (
                          <span className="text-[9px] text-muted-foreground">
                            Updated {timeAgo(bdReport.last_fetched_at)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Order Summary (sticky) */}
          <div className="lg:sticky lg:top-4">
            <Card className="rounded-xl border-border/60 shadow-sm">
              <CardHeader className="p-4 pb-3">
                <CardTitle className="text-xs font-semibold">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    {statusConfig && (
                      <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold text-white", statusConfig.bg)}>
                        {statusConfig.emoji} {currentStatus.replace(/_/g, " ").toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payment</span>
                    <span className="capitalize font-medium">{order.payment_method || "COD"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payment Status</span>
                    <Badge variant="outline" className={cn("rounded text-[10px] px-1.5 py-0",
                      order.payment_status === "paid" ? "border-green-300 text-green-700 bg-green-50" :
                      "border-orange-300 text-orange-700 bg-orange-50"
                    )}>
                      {order.payment_status || "pending"}
                    </Badge>
                  </div>
                </div>
                <Separator className="my-2" />
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatBDT(order.subtotal)}</span></div>
                  {(order.discount || 0) > 0 && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="text-red-500">-{formatBDT(order.discount)}</span></div>
                  )}
                  <div className="flex justify-between"><span className="text-muted-foreground">Delivery</span><span>{formatBDT(order.delivery_charge)}</span></div>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between items-baseline">
                  <span className="font-semibold text-sm">Total</span>
                  <span className="text-xl font-bold text-green-600">{formatBDT(order.total_amount)}</span>
                </div>
                <Button className="w-full rounded-lg mt-2 bg-green-600 hover:bg-green-700 text-white font-semibold h-10">
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Create Order
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ──────── MAIN CONTENT ──────── */}
        <div className="lg:col-span-6 order-1 lg:order-2">
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="w-full justify-start rounded-lg bg-muted/60 h-10 p-1">
              <TabsTrigger value="overview" className="rounded-md text-xs data-[state=active]:shadow-sm">📋 Overview</TabsTrigger>
              <TabsTrigger value="products" className="rounded-md text-xs data-[state=active]:shadow-sm">📦 Products</TabsTrigger>
              <TabsTrigger value="calls" className="rounded-md text-xs data-[state=active]:shadow-sm">📞 Call Log</TabsTrigger>
              <TabsTrigger value="activity" className="rounded-md text-xs data-[state=active]:shadow-sm">🕐 Activity</TabsTrigger>
            </TabsList>

            {/* ── TAB: Overview ── */}
            <TabsContent value="overview" className="space-y-4">
              {/* Customer Details editable */}
              <Card className="rounded-xl border-border/60 shadow-sm">
                <CardHeader className="p-4 pb-3">
                  <CardTitle className="text-xs font-semibold">Customer Details</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Mobile Number</label>
                      <div className="flex gap-1.5">
                        <Input value={customer?.phone || ""} readOnly className="rounded-lg h-9 text-sm font-mono flex-1" />
                        {customer?.phone && (
                          <>
                            <a href={`tel:${customer.phone}`} className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors shrink-0">
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                            <a href={`https://wa.me/${customer.phone?.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors shrink-0">
                              <MessageCircle className="w-3.5 h-3.5" />
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Name</label>
                      <Input value={customer?.full_name || ""} readOnly className="rounded-lg h-9 text-sm" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Address</label>
                      <Textarea value={order.delivery_address || customer?.address || ""} readOnly rows={2} className="rounded-lg text-sm resize-none" />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground mb-1 block">District</label>
                      <Input value={order.delivery_district || customer?.district || ""} readOnly className="rounded-lg h-9 text-sm" />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Thana</label>
                      <Input value={order.delivery_thana || customer?.thana || ""} readOnly className="rounded-lg h-9 text-sm" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Order Items quick view */}
              <Card className="rounded-xl border-border/60 shadow-sm">
                <CardHeader className="p-4 pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-xs font-semibold">Ordered Products ({items?.length || 0})</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="space-y-2">
                    {items?.map((item) => {
                      const product = item.products as any;
                      const pName = product?.name || (item as any).product_name_fallback || "Product";
                      const pInitial = pName[0].toUpperCase();
                      return (
                        <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                          <div className="w-10 h-10 rounded-lg bg-card border border-border flex items-center justify-center overflow-hidden shrink-0">
                            {product?.image_url ? (
                              <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{pInitial}</div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-xs truncate">{pName}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-blue-600 font-mono">{product?.sku || "-"}</span>
                              {product?.stock_quantity != null && (
                                <span className={cn("text-[10px] font-medium", product.stock_quantity < 10 ? "text-red-500" : "text-muted-foreground")}>
                                  Stock: {product.stock_quantity}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="bg-muted rounded-md px-2 py-0.5 text-xs font-bold">×{item.quantity}</span>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs text-muted-foreground">{formatBDT(item.unit_price)}</p>
                            <p className="text-sm font-bold">{formatBDT(item.total_price)}</p>
                          </div>
                        </div>
                      );
                    })}
                    {(!items || items.length === 0) && (
                      <p className="text-center text-muted-foreground py-6 text-xs">No items</p>
                    )}
                  </div>
                  {/* Totals */}
                  <div className="mt-4 pt-3 border-t border-border/50">
                    <div className="space-y-1.5 text-xs max-w-xs ml-auto">
                      <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatBDT(order.subtotal)}</span></div>
                      {(order.discount || 0) > 0 && (
                        <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="text-red-500">-{formatBDT(order.discount)}</span></div>
                      )}
                      <div className="flex justify-between"><span className="text-muted-foreground">Delivery</span><span>{formatBDT(order.delivery_charge)}</span></div>
                      <Separator />
                      <div className="flex justify-between font-bold text-base">
                        <span>Total</span>
                        <span className="text-green-600">{formatBDT(order.total_amount)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Order Info */}
              <Card className="rounded-xl border-border/60 shadow-sm">
                <CardHeader className="p-4 pb-3">
                  <CardTitle className="text-xs font-semibold">Order Information</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Payment Method</span>
                    <span className="capitalize font-medium">{order.payment_method || "-"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Delivery Area</span>
                    <span className="font-medium">{order.delivery_district || "-"}{order.delivery_thana ? `, ${order.delivery_thana}` : ""}</span>
                  </div>
                  {order.pathao_tracking_code && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Tracking</span>
                      <div className="flex items-center gap-1">
                        <code className="text-[11px] bg-muted px-2 py-0.5 rounded font-mono">{order.pathao_tracking_code}</code>
                        <Button variant="ghost" size="icon" className="w-6 h-6 rounded"
                          onClick={() => { navigator.clipboard.writeText(order.pathao_tracking_code!); toast({ title: "Copied!" }); }}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                  {order.shopify_order_number && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Shopify</span>
                      <div className="flex items-center gap-1">
                        <span className="font-medium">#{order.shopify_order_number}</span>
                        <ExternalLink className="w-3 h-3 text-muted-foreground" />
                      </div>
                    </div>
                  )}
                  {order.notes && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-muted-foreground text-[10px] mb-1">Shopify Notes</p>
                        <p className="text-xs bg-muted/50 rounded-lg p-2.5">{order.notes}</p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── TAB: Products ── */}
            <TabsContent value="products" className="space-y-4">
              <Card className="rounded-xl border-border/60 shadow-sm">
                <CardHeader className="p-4 pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-xs font-semibold">Ordered Products ({items?.length || 0})</CardTitle>
                  <Button size="sm" variant="outline" className="rounded-lg h-8 text-xs gap-1.5">
                    <Plus className="w-3 h-3" /> Add Product
                  </Button>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="space-y-3">
                    {items?.map((item) => {
                      const product = item.products as any;
                      const pInitial = (product?.name || "?")[0].toUpperCase();
                      return (
                        <div key={item.id} className="flex items-center gap-4 p-4 rounded-xl border border-border/60 bg-card hover:shadow-sm transition-shadow">
                          <div className="w-14 h-14 rounded-xl bg-muted border border-border flex items-center justify-center overflow-hidden shrink-0">
                            {product?.image_url ? (
                              <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-base font-bold text-muted-foreground">{pInitial}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm">{product?.name || "Unknown"}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] bg-blue-50 text-blue-700 rounded px-1.5 py-0.5 font-mono font-medium">{product?.sku || "-"}</span>
                              {product?.stock_quantity != null && (
                                <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium",
                                  product.stock_quantity < 10 ? "bg-red-50 text-red-600" : "bg-muted text-muted-foreground"
                                )}>
                                  Stock: {product.stock_quantity}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Button variant="outline" size="icon" className="w-7 h-7 rounded-md"><Minus className="w-3 h-3" /></Button>
                            <span className="w-8 text-center font-bold text-sm">{item.quantity}</span>
                            <Button variant="outline" size="icon" className="w-7 h-7 rounded-md"><Plus className="w-3 h-3" /></Button>
                          </div>
                          <div className="text-right shrink-0 w-20">
                            <p className="text-xs text-muted-foreground">{formatBDT(item.unit_price)} ea</p>
                            <p className="text-sm font-bold">{formatBDT(item.total_price)}</p>
                          </div>
                          <Button variant="ghost" size="icon" className="w-7 h-7 rounded-md text-muted-foreground hover:text-red-500 shrink-0">
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                  {/* Totals row */}
                  <div className="mt-4 pt-4 border-t border-border/50">
                    <div className="flex items-center gap-3 flex-wrap text-xs">
                      <div className="flex-1 min-w-[120px]">
                        <label className="text-[10px] text-muted-foreground block mb-1">Discount</label>
                        <Input value={order.discount || 0} readOnly className="rounded-lg h-8 text-xs" />
                      </div>
                      <div className="flex-1 min-w-[120px]">
                        <label className="text-[10px] text-muted-foreground block mb-1">Delivery</label>
                        <Input value={order.delivery_charge || 0} readOnly className="rounded-lg h-8 text-xs" />
                      </div>
                      <div className="flex-1 min-w-[120px]">
                        <label className="text-[10px] text-muted-foreground block mb-1">Grand Total</label>
                        <div className="h-8 rounded-lg bg-green-50 border border-green-200 flex items-center px-3 font-bold text-green-700 text-sm">
                          {formatBDT(order.total_amount)}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* COD warning */}
              {order.payment_method?.toLowerCase() === "cod" && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                  <span className="text-lg">⚠️</span>
                  <p className="font-medium">Payment method is Cash on Delivery (COD). Please confirm with the customer.</p>
                </div>
              )}
            </TabsContent>

            {/* ── TAB: Call Log ── */}
            <TabsContent value="calls" className="space-y-4">
              <Card className="rounded-xl border-border/60 shadow-sm">
                <CardHeader className="p-4 pb-3">
                  <CardTitle className="text-xs font-semibold flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5" /> Log a Call
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {CALL_OPTIONS.map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => setCallResult(opt.key)}
                        className={cn(
                          "flex flex-col items-center gap-1 px-3 py-3 rounded-xl text-xs font-semibold ring-1 ring-inset transition-all duration-200",
                          callResult === opt.key ? opt.active : opt.idle,
                        )}
                      >
                        <span className="text-lg">{opt.emoji}</span>
                        <span>{opt.label}</span>
                      </button>
                    ))}
                  </div>
                  {callResult && (
                    <Button
                      onClick={() => callLogMutation.mutate()}
                      disabled={callLogMutation.isPending}
                      className="w-full rounded-xl h-9 animate-fade-in"
                    >
                      <Send className="w-3.5 h-3.5 mr-2" /> Log Call
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Previous calls */}
              <Card className="rounded-xl border-border/60 shadow-sm">
                <CardHeader className="p-4 pb-3">
                  <CardTitle className="text-xs font-semibold">Call History</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {callLogs.length > 0 ? (
                    <div className="space-y-2">
                      {callLogs.map((log) => (
                        <div key={log.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30 text-xs">
                          <span className="text-base">📞</span>
                          <span className="capitalize font-semibold text-foreground">{log.call_result?.replace("_", " ")}</span>
                          <span className="text-muted-foreground">•</span>
                          <span className="text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{timeAgo(log.created_at)}</span>
                          <span className="ml-auto text-muted-foreground">{log.created_by || "Staff"}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <Phone className="w-6 h-6 mx-auto text-muted-foreground/30 mb-2" />
                      <p className="text-xs text-muted-foreground">No calls logged yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── TAB: Activity ── */}
            <TabsContent value="activity" className="space-y-4">
              <Card className="rounded-xl border-border/60 shadow-sm">
                <CardHeader className="p-4 pb-3">
                  <CardTitle className="text-xs font-semibold">Activity Timeline</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {notes && notes.length > 0 ? (
                    <div className="relative space-y-4 pl-6">
                      <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border" />
                      {notes.map((note) => (
                        <div key={note.id} className="relative flex gap-3">
                          <div className={cn("absolute left-[-15px] top-1.5 w-2.5 h-2.5 rounded-full ring-2 ring-card", noteTypeDot(note.note_type))} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs">{note.content}</p>
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                              <span>{note.created_by || "System"}</span>
                              <span>•</span>
                              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{timeAgo(note.created_at)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Clock className="w-6 h-6 mx-auto text-muted-foreground/30 mb-2" />
                      <p className="text-xs text-muted-foreground">এখনো কোনো activity নেই</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* ──────── RIGHT SIDEBAR ──────── */}
        <div className="lg:col-span-3 space-y-4 order-3 lg:sticky lg:top-4 lg:self-start">

          {/* Status Update */}
          <Card className="rounded-xl border-border/60 shadow-sm">
            <CardHeader className="p-4 pb-3">
              <CardTitle className="text-xs font-semibold">Order Actions</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-2 gap-2">
                {STATUS_BUTTONS.map((s) => {
                  const isActive = currentStatus === s.key;
                  if (s.key === "confirm") {
                    return (
                      <AlertDialogRoot key={s.key} open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                        <ADTrigger asChild>
                          <button
                            disabled={isActive || statusMutation.isPending}
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-[11px] font-semibold transition-all duration-200 border",
                              isActive
                                ? cn(s.bg, "text-white border-transparent shadow-md")
                                : cn("bg-card", s.text, "border-border/60 hover:shadow-sm", s.light),
                              (isActive || statusMutation.isPending) && "opacity-60 cursor-not-allowed"
                            )}
                          >
                            <span>{s.emoji}</span> {s.label}
                          </button>
                        </ADTrigger>
                        <ADContent className="rounded-xl">
                          <ADHeader>
                            <ADTitle>এই order টি confirm করবেন?</ADTitle>
                            <ADDesc>Confirmed orders main processing queue এ চলে যাবে।</ADDesc>
                          </ADHeader>
                          <ADFooter>
                            <ADCancel className="rounded-lg">Cancel</ADCancel>
                            <ADAction onClick={() => confirmMutation.mutate()} disabled={confirmMutation.isPending} className="rounded-lg bg-green-600 hover:bg-green-700">
                              {confirmMutation.isPending ? "Confirming..." : "✅ Confirm Order"}
                            </ADAction>
                          </ADFooter>
                        </ADContent>
                      </AlertDialogRoot>
                    );
                  }
                  return (
                    <button
                      key={s.key}
                      onClick={() => statusMutation.mutate(s.key)}
                      disabled={isActive || statusMutation.isPending}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-[11px] font-semibold transition-all duration-200 border",
                        isActive
                          ? cn(s.bg, "text-white border-transparent shadow-md")
                          : cn("bg-card", s.text, "border-border/60 hover:shadow-sm", s.light),
                        (isActive || statusMutation.isPending) && "opacity-60 cursor-not-allowed"
                      )}
                    >
                      <span>{s.emoji}</span> {s.label}
                    </button>
                  );
                })}
              </div>
              {/* Cancel - full width */}
              <button
                onClick={() => statusMutation.mutate("cancel")}
                disabled={currentStatus === "cancel" || statusMutation.isPending}
                className={cn(
                  "w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-[11px] font-semibold transition-all duration-200 border mt-2",
                  currentStatus === "cancel"
                    ? "bg-red-700 text-white border-transparent shadow-md opacity-60 cursor-not-allowed"
                    : "bg-card text-red-700 border-border/60 hover:shadow-sm bg-red-50 hover:bg-red-100",
                )}
              >
                ❌ Cancel
              </button>
            </CardContent>
          </Card>

          {/* Pathao Section */}
          {currentStatus === "confirm" && !order.pathao_consignment_id && (
            <Card className="rounded-xl border-green-200 bg-green-50/50 shadow-sm">
              <CardContent className="p-4">
                <Button
                  onClick={() => setShowPathaoModal(true)}
                  className="w-full rounded-lg h-10 bg-green-600 hover:bg-green-700 text-white font-semibold text-xs gap-2"
                >
                  <Truck className="w-4 h-4" /> Send to Pathao
                </Button>
                <p className="text-[10px] text-green-700 text-center mt-2">Order confirmed — ready to ship</p>
              </CardContent>
            </Card>
          )}

          {/* Pathao Tracking */}
          {order.pathao_consignment_id && (
            <PathaoTrackingCard
              consignmentId={order.pathao_consignment_id}
              trackingCode={order.pathao_tracking_code || undefined}
            />
          )}

          {/* Notes */}
          <Card className="rounded-xl border-border/60 shadow-sm">
            <CardHeader className="p-4 pb-3">
              <CardTitle className="text-xs font-semibold">Notes</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div className="flex gap-2">
                <Textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a note..."
                  rows={2}
                  className="flex-1 rounded-lg resize-none text-xs"
                />
                <Button
                  onClick={() => noteMutation.mutate()}
                  disabled={!newNote.trim() || noteMutation.isPending}
                  className="self-end rounded-lg"
                  size="icon"
                >
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </div>
              {notes?.filter((n) => n.note_type === "note").slice(0, 5).map((note) => (
                <div key={note.id} className="bg-muted/40 rounded-lg p-2.5 space-y-1">
                  <p className="text-xs">{note.content}</p>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{note.created_by || "Staff"}</span>
                    <span>•</span>
                    <span>{timeAgo(note.created_at)}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* SMS Actions */}
          <Card className="rounded-xl border-border/60 shadow-sm">
            <CardHeader className="p-4 pb-3">
              <CardTitle className="text-xs font-semibold">SMS Actions</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              <Button variant="outline" className="w-full rounded-lg h-9 text-xs justify-start gap-2">
                📱 Send Reminder SMS
              </Button>
              <Button variant="outline" className="w-full rounded-lg h-9 text-xs justify-start gap-2 border-orange-200 text-orange-700 hover:bg-orange-50">
                💰 Send Advance SMS
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Pathao Booking Modal */}
      <PathaoBookingModal
        open={showPathaoModal}
        onOpenChange={setShowPathaoModal}
        order={order}
        customer={customer}
        items={items || []}
      />
    </div>
  );
}
