import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { formatBDT, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Phone, MessageCircle, Send, Clock, Printer, Pencil,
  MoreHorizontal, MapPin, Package, Wallet, CheckCircle2, RefreshCw,
  Copy, ExternalLink,
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

/* ──────────────── STATUS CONFIG ──────────────── */
const STATUS_BUTTONS = [
  { key: "processing", label: "Processing", emoji: "🟡", border: "border-l-yellow-500", text: "text-yellow-700", bg: "bg-yellow-500", bgLight: "bg-yellow-50" },
  { key: "confirm", label: "Confirm", emoji: "🟢", border: "border-l-green-500", text: "text-green-700", bg: "bg-green-500", bgLight: "bg-green-50" },
  { key: "good_but_no_response", label: "Good But No Response", emoji: "🔵", border: "border-l-blue-500", text: "text-blue-700", bg: "bg-blue-500", bgLight: "bg-blue-50" },
  { key: "no_response", label: "No Response", emoji: "🔴", border: "border-l-red-500", text: "text-red-700", bg: "bg-red-500", bgLight: "bg-red-50" },
  { key: "on_hold", label: "On Hold", emoji: "⏸️", border: "border-l-indigo-500", text: "text-indigo-700", bg: "bg-indigo-500", bgLight: "bg-indigo-50" },
  { key: "advance_payment", label: "Advance Payment", emoji: "🟠", border: "border-l-orange-500", text: "text-orange-700", bg: "bg-orange-500", bgLight: "bg-orange-50" },
  { key: "cancel", label: "Cancel", emoji: "❌", border: "border-l-red-700", text: "text-red-800", bg: "bg-red-700", bgLight: "bg-red-50" },
] as const;

const CALL_OPTIONS = [
  { key: "answered", label: "Answered", emoji: "✅", ring: "ring-green-400 text-green-700 hover:bg-green-50" },
  { key: "no_answer", label: "No Answer", emoji: "📵", ring: "ring-orange-400 text-orange-700 hover:bg-orange-50" },
  { key: "busy", label: "Busy", emoji: "🔴", ring: "ring-red-400 text-red-700 hover:bg-red-50" },
  { key: "voicemail", label: "Voicemail", emoji: "📩", ring: "ring-gray-400 text-gray-600 hover:bg-gray-50" },
];

const segmentBorder: Record<string, string> = {
  vip: "border-l-amber-400",
  regular: "border-l-blue-400",
  new: "border-l-green-400",
};

/* ──────────────── HELPERS ──────────────── */
const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const noteTypeIcon = (type: string) => {
  switch (type) {
    case "call_log": return "📞";
    case "status_change": return "🔄";
    case "activity": return "⚡";
    default: return "📝";
  }
};

const noteTypeDot = (type: string) => {
  switch (type) {
    case "call_log": return "bg-blue-500";
    case "status_change": return "bg-yellow-500";
    case "activity": return "bg-green-500";
    default: return "bg-gray-400";
  }
};

/* ──────────────── COMPONENT ──────────────── */
export default function WebOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newNote, setNewNote] = useState("");
  const [callResult, setCallResult] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

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
        .select("*, products(name, sku, image_url)")
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
      await supabase
        .from("orders")
        .update({ web_order_status: "confirm", status: "confirmed", updated_at: new Date().toISOString() })
        .eq("id", id!);
      await supabase.from("web_order_notes").insert({
        order_id: id, note_type: "activity",
        content: "Order confirmed and moved to main order processing", created_by: "Staff",
      });
    },
    onSuccess: () => {
      toast({ title: "Order confirmed!", description: "Moved to main order processing" });
      setShowConfirmDialog(false);
      queryClient.invalidateQueries({ queryKey: ["web-order", id] });
      queryClient.invalidateQueries({ queryKey: ["web-order-notes", id] });
      queryClient.invalidateQueries({ queryKey: ["web-orders"] });
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

  /* ── Loading / Not Found ── */
  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
        <Skeleton className="h-16 w-full rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-72 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!order) return <div className="text-center py-20 text-muted-foreground text-lg">Order not found</div>;

  const currentStatus = order.web_order_status || "processing";
  const statusConfig = STATUS_BUTTONS.find((s) => s.key === currentStatus);

  const callLogs = notes?.filter((n) => n.note_type === "call_log") || [];

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* ═══════════ HEADER BAR ═══════════ */}
      <div className="flex items-center gap-4 bg-card rounded-2xl p-4 shadow-sm border border-border/50">
        <Button variant="ghost" size="icon" onClick={() => navigate("/web-orders")} className="rounded-xl hover:bg-muted">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">{order.order_number}</h1>
            <Badge variant="secondary" className="capitalize rounded-full px-3 text-xs font-medium">
              {order.channel}
            </Badge>
            {statusConfig && (
              <Badge className={cn("rounded-full px-3 py-1 text-xs font-semibold text-white", statusConfig.bg)}>
                {statusConfig.emoji} {currentStatus.replace(/_/g, " ").toUpperCase()}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{formatDateTime(order.created_at)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="rounded-xl" title="Print">
            <Printer className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" className="rounded-xl" title="Edit">
            <Pencil className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" className="rounded-xl" title="More">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* ═══════════ MAIN GRID ═══════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ──── LEFT COLUMN ──── */}
        <div className="lg:col-span-3 space-y-6">

          {/* Card: Customer Info */}
          <Card className={cn("rounded-2xl shadow-sm border-l-4 transition-shadow hover:shadow-md", segmentBorder[customer?.segment || "regular"] || "border-l-blue-400")}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-3 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold">{customer?.full_name || "Unknown"}</h2>
                    <Badge variant="outline" className="capitalize rounded-full text-xs">{customer?.segment || "regular"}</Badge>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{customer?.phone || "-"}</span>
                    {customer?.phone && (
                      <>
                        <a href={`tel:${customer.phone}`} className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-700 hover:bg-green-200 transition-colors">
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                        <a href={`https://wa.me/${customer.phone?.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-700 hover:bg-green-200 transition-colors">
                          <MessageCircle className="w-3.5 h-3.5" />
                        </a>
                      </>
                    )}
                    {customer?.phone2 && <span className="text-xs text-muted-foreground ml-2">Alt: {customer.phone2}</span>}
                  </div>
                  <div className="flex items-start gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    <span>{customer?.address || "-"}, {[customer?.district, customer?.thana].filter(Boolean).join(", ") || "-"}</span>
                  </div>
                </div>
              </div>
              <Separator className="my-4" />
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="flex items-center justify-center gap-1.5 text-muted-foreground text-xs mb-1">
                    <Package className="w-3.5 h-3.5" /> Orders
                  </div>
                  <p className="font-bold text-lg">{customer?.total_orders || 0}</p>
                </div>
                <div className="border-x border-border">
                  <div className="flex items-center justify-center gap-1.5 text-muted-foreground text-xs mb-1">
                    <Wallet className="w-3.5 h-3.5" /> Spent
                  </div>
                  <p className="font-bold text-lg">{formatBDT(customer?.total_spent)}</p>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-1.5 text-muted-foreground text-xs mb-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Success
                  </div>
                  <p className="font-bold text-lg">{bdReport ? `${Math.round(bdReport.success_rate)}%` : "--"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card: BD Courier Report */}
          <Card className="rounded-2xl shadow-sm transition-shadow hover:shadow-md">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold">Customer Quality Check</CardTitle>
              <Button variant="ghost" size="icon" className="rounded-full w-8 h-8" onClick={() => refetchBD()} title="Refresh">
                <RefreshCw className={cn("w-4 h-4", bdLoading && "animate-spin")} />
              </Button>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {bdLoading ? (
                <div className="flex items-center gap-5">
                  <Skeleton className="w-20 h-20 rounded-full" />
                  <div className="space-y-2 flex-1"><Skeleton className="h-4 w-32" /><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-28" /></div>
                </div>
              ) : !bdReport ? (
                <div className="text-center py-6">
                  <p className="text-3xl mb-2">🆕</p>
                  <p className="text-sm font-medium text-muted-foreground">New Customer — No courier history</p>
                </div>
              ) : (
                <div className="flex items-center gap-6">
                  {/* Circular gauge */}
                  <div className="relative w-20 h-20 flex-shrink-0">
                    <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                      <circle cx="40" cy="40" r="32" fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
                      <circle cx="40" cy="40" r="32" fill="none"
                        stroke={getSuccessColor(bdReport.success_rate)}
                        strokeWidth="6"
                        strokeDasharray={`${bdReport.success_rate * 2.01} 201`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg font-bold" style={{ color: getSuccessColor(bdReport.success_rate) }}>
                        {Math.round(bdReport.success_rate)}%
                      </span>
                    </div>
                  </div>
                  {/* Stats */}
                  <div className="flex-1 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Total Orders</span><span className="font-semibold">{bdReport.total_orders}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Successful</span><span className="font-semibold text-green-600">{bdReport.successful_orders}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Returned</span><span className="font-semibold text-orange-600">{bdReport.returned_orders}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Cancelled</span><span className="font-semibold text-red-600">{bdReport.cancelled_orders}</span></div>
                  </div>
                  {/* Risk badge */}
                  <Badge className={cn("rounded-full px-3 py-1 text-xs font-semibold", riskInfo.bg, riskInfo.color)}>
                    {riskInfo.label}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card: Call Log */}
          <Card className="rounded-2xl shadow-sm transition-shadow hover:shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Phone className="w-4 h-4" /> Call Log
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-4">
              <div className="flex gap-2 flex-wrap">
                {CALL_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setCallResult(opt.key)}
                    className={cn(
                      "px-4 py-2 rounded-full text-sm font-medium ring-1 ring-inset transition-all duration-200 hover:scale-105",
                      callResult === opt.key
                        ? "ring-2 bg-current/10 shadow-sm scale-105"
                        : "ring-border bg-card",
                      opt.ring,
                    )}
                  >
                    {opt.emoji} {opt.label}
                  </button>
                ))}
                {callResult && (
                  <Button
                    size="sm"
                    onClick={() => callLogMutation.mutate()}
                    disabled={callLogMutation.isPending}
                    className="rounded-full px-5 animate-fade-in"
                  >
                    <Send className="w-3.5 h-3.5 mr-1.5" /> Log Call
                  </Button>
                )}
              </div>
              {/* Mini timeline of previous calls */}
              {callLogs.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-border/50">
                  {callLogs.slice(0, 3).map((log) => (
                    <div key={log.id} className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>📞</span>
                      <span className="capitalize font-medium text-foreground">{log.call_result?.replace("_", " ")}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{timeAgo(log.created_at)}</span>
                      <span>•</span>
                      <span>{log.created_by || "Staff"}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card: Order Items */}
          <Card className="rounded-2xl shadow-sm transition-shadow hover:shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Order Items</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="space-y-3">
                {items?.map((item) => {
                  const product = item.products as any;
                  const initial = (product?.name || "?")[0].toUpperCase();
                  return (
                    <div key={item.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl transition-colors hover:bg-muted">
                      <div className="w-12 h-12 rounded-xl bg-card border border-border flex items-center justify-center overflow-hidden flex-shrink-0">
                        {product?.image_url ? (
                          <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm font-bold text-muted-foreground">{initial}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{product?.name || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">SKU: {product?.sku || "-"}</p>
                      </div>
                      <Badge variant="secondary" className="rounded-full text-xs">×{item.quantity}</Badge>
                      <div className="text-right text-sm">
                        <p className="text-muted-foreground">{formatBDT(item.unit_price)}</p>
                        <p className="font-semibold">{formatBDT(item.total_price)}</p>
                      </div>
                    </div>
                  );
                })}
                {(!items || items.length === 0) && <p className="text-center text-muted-foreground py-6 text-sm">No items</p>}
              </div>
              <Separator className="my-4" />
              <div className="space-y-2 text-sm max-w-xs ml-auto">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatBDT(order.subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="text-red-500">-{formatBDT(order.discount)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Delivery</span><span>{formatBDT(order.delivery_charge)}</span></div>
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span className="text-green-600">{formatBDT(order.total_amount)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card: Notes */}
          <Card className="rounded-2xl shadow-sm transition-shadow hover:shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Notes & Comments</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-4">
              <div className="flex gap-2">
                <Textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="কোনো নোট লিখুন..."
                  rows={2}
                  className="flex-1 rounded-xl resize-none"
                />
                <Button
                  onClick={() => noteMutation.mutate()}
                  disabled={!newNote.trim() || noteMutation.isPending}
                  className="self-end rounded-xl"
                  size="icon"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              {/* Previous notes as chat bubbles */}
              {notes?.filter((n) => n.note_type === "note").map((note) => (
                <div key={note.id} className="bg-muted/60 rounded-xl p-3 space-y-1">
                  <p className="text-sm">{note.content}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{note.created_by || "Staff"}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{timeAgo(note.created_at)}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* ──── RIGHT COLUMN (sticky) ──── */}
        <div className="lg:col-span-2 space-y-6 lg:sticky lg:top-4 lg:self-start">

          {/* Card: Status */}
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Order Status</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-2">
              {STATUS_BUTTONS.map((s) => {
                const isActive = currentStatus === s.key;

                if (s.key === "confirm") {
                  return (
                    <AlertDialogRoot key={s.key} open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                      <ADTrigger asChild>
                        <button
                          disabled={isActive || statusMutation.isPending}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 border-l-4 border",
                            isActive
                              ? cn(s.bg, "text-white border-transparent shadow-md")
                              : cn("bg-card border-border", s.border, s.text, "hover:shadow-sm hover:translate-x-0.5"),
                            (isActive || statusMutation.isPending) && "opacity-60 cursor-not-allowed"
                          )}
                        >
                          <span>{s.emoji}</span> {s.label}
                        </button>
                      </ADTrigger>
                      <ADContent className="rounded-2xl">
                        <ADHeader>
                          <ADTitle>এই order টি confirm করবেন?</ADTitle>
                          <ADDesc>
                            Confirmed orders main processing queue এ চলে যাবে।
                          </ADDesc>
                        </ADHeader>
                        <ADFooter>
                          <ADCancel className="rounded-xl">Cancel</ADCancel>
                          <ADAction onClick={() => confirmMutation.mutate()} disabled={confirmMutation.isPending} className="rounded-xl bg-green-600 hover:bg-green-700">
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
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 border-l-4 border",
                      isActive
                        ? cn(s.bg, "text-white border-transparent shadow-md")
                        : cn("bg-card border-border", s.border, s.text, "hover:shadow-sm hover:translate-x-0.5"),
                      (isActive || statusMutation.isPending) && "opacity-60 cursor-not-allowed"
                    )}
                  >
                    <span>{s.emoji}</span> {s.label}
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {/* Card: Activity Timeline */}
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {notes && notes.length > 0 ? (
                <div className="relative space-y-4 pl-6">
                  {/* Vertical line */}
                  <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border" />
                  {notes.map((note) => (
                    <div key={note.id} className="relative flex gap-3">
                      <div className={cn("absolute left-[-15px] top-1.5 w-2.5 h-2.5 rounded-full ring-2 ring-card", noteTypeDot(note.note_type))} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{note.content}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
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
                  <Clock className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">এখনো কোনো activity নেই</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card: Order Info */}
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Order Info</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Payment Method</span>
                <span className="capitalize font-medium">{order.payment_method || "-"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Payment Status</span>
                <Badge variant="outline" className={cn("capitalize rounded-full text-xs",
                  order.payment_status === "paid" ? "border-green-300 text-green-700 bg-green-50" :
                  order.payment_status === "pending" ? "border-orange-300 text-orange-700 bg-orange-50" :
                  ""
                )}>
                  {order.payment_status || "-"}
                </Badge>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Delivery Area</span>
                <span className="font-medium">{order.delivery_district || "-"}, {order.delivery_thana || "-"}</span>
              </div>
              {order.pathao_tracking_code && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Tracking</span>
                  <div className="flex items-center gap-1.5">
                    <code className="text-xs bg-muted px-2 py-1 rounded">{order.pathao_tracking_code}</code>
                    <Button variant="ghost" size="icon" className="w-7 h-7 rounded-full"
                      onClick={() => { navigator.clipboard.writeText(order.pathao_tracking_code!); toast({ title: "Copied!" }); }}>
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}
              {order.shopify_order_number && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Shopify</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">#{order.shopify_order_number}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                </div>
              )}
              {order.notes && (
                <>
                  <Separator />
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Order Notes</p>
                    <p className="text-sm bg-muted/50 rounded-xl p-3">{order.notes}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
