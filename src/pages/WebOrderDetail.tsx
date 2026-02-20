import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { formatBDT, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Phone, MessageCircle, Send, Clock, MapPin,
  Package, CheckCircle2, RefreshCw, Copy, ExternalLink,
  Plus, Minus, X, Search, ShieldCheck, Truck, Loader2, AlertTriangle,
  Printer, Save, MoreHorizontal, History, User, ChevronRight,
} from "lucide-react";
import { useAddressParser } from "@/hooks/use-address-parser";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBDCourierSingle, getRiskLevel, getSuccessColor } from "@/hooks/use-bd-courier";
import { PathaoTrackingCard } from "@/components/pathao/PathaoTrackingCard";
import { PathaoBookingModal } from "@/components/pathao/PathaoBookingModal";

/* ─── Light Glass card utility ─── */
const glass = "bg-white/70 backdrop-blur-xl border border-white/60 rounded-2xl shadow-[0_12px_40px_rgba(15,23,42,0.10)]";
const glassLight = "bg-white/50 backdrop-blur-lg border border-slate-200/60 rounded-xl shadow-sm";
const glassHeader = "bg-white/60 backdrop-blur-xl border-b border-slate-200/60";

/* ─── STATUS CONFIG (light tinted) ─── */
const STATUS_BUTTONS = [
  { key: "processing", label: "Processing", emoji: "🟡", color: "bg-amber-50 border-l-4 border-l-amber-400 border-y border-r border-amber-200/60 text-amber-800", active: "bg-amber-100 border-l-4 border-l-amber-500 border-y border-r border-amber-300 text-amber-900 font-bold" },
  { key: "confirm", label: "Confirm", emoji: "🟢", color: "bg-emerald-50 border-l-4 border-l-emerald-400 border-y border-r border-emerald-200/60 text-emerald-800", active: "bg-emerald-100 border-l-4 border-l-emerald-500 border-y border-r border-emerald-300 text-emerald-900 font-bold" },
  { key: "good_but_no_response", label: "Good No Resp", emoji: "🔵", color: "bg-sky-50 border-l-4 border-l-sky-400 border-y border-r border-sky-200/60 text-sky-800", active: "bg-sky-100 border-l-4 border-l-sky-500 border-y border-r border-sky-300 text-sky-900 font-bold" },
  { key: "no_response", label: "No Response", emoji: "🔴", color: "bg-rose-50 border-l-4 border-l-rose-400 border-y border-r border-rose-200/60 text-rose-800", active: "bg-rose-100 border-l-4 border-l-rose-500 border-y border-r border-rose-300 text-rose-900 font-bold" },
  { key: "on_hold", label: "On Hold", emoji: "⏸️", color: "bg-indigo-50 border-l-4 border-l-indigo-400 border-y border-r border-indigo-200/60 text-indigo-800", active: "bg-indigo-100 border-l-4 border-l-indigo-500 border-y border-r border-indigo-300 text-indigo-900 font-bold" },
  { key: "advance_payment", label: "Advance", emoji: "🟠", color: "bg-orange-50 border-l-4 border-l-orange-400 border-y border-r border-orange-200/60 text-orange-800", active: "bg-orange-100 border-l-4 border-l-orange-500 border-y border-r border-orange-300 text-orange-900 font-bold" },
] as const;

const CALL_OPTIONS = [
  { key: "answered", label: "Answered", emoji: "✅", active: "bg-emerald-100 text-emerald-800 ring-emerald-400", idle: "text-emerald-700 ring-emerald-200 hover:bg-emerald-50" },
  { key: "no_answer", label: "No Answer", emoji: "📵", active: "bg-orange-100 text-orange-800 ring-orange-400", idle: "text-orange-700 ring-orange-200 hover:bg-orange-50" },
  { key: "busy", label: "Busy", emoji: "🔴", active: "bg-rose-100 text-rose-800 ring-rose-400", idle: "text-rose-700 ring-rose-200 hover:bg-rose-50" },
  { key: "voicemail", label: "Voicemail", emoji: "📩", active: "bg-slate-200 text-slate-800 ring-slate-400", idle: "text-slate-600 ring-slate-200 hover:bg-slate-50" },
];

const QUICK_NOTES = ["Call before delivery", "Fragile", "Gift wrap", "Deliver after 6 PM"];

const CANCEL_REASONS = [
  "Customer requested cancellation",
  "Duplicate order",
  "Out of stock",
  "Fraudulent order",
  "Price dispute",
  "Wrong product ordered",
  "Other",
];

const HOLD_REASONS = [
  "Waiting for customer confirmation",
  "Payment verification pending",
  "Address clarification needed",
  "Customer unreachable",
  "Stock arriving soon",
  "Customer requested delay",
  "Other",
];

/* ─── HELPERS ─── */
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
    case "call_log": return "bg-sky-400";
    case "status_change": return "bg-amber-400";
    case "activity": return "bg-emerald-400";
    default: return "bg-slate-300";
  }
};

const segmentColors: Record<string, { bg: string; text: string }> = {
  vip: { bg: "bg-amber-100", text: "text-amber-700" },
  regular: { bg: "bg-sky-100", text: "text-sky-700" },
  new: { bg: "bg-emerald-100", text: "text-emerald-700" },
};

const avatarColors = [
  "from-sky-400 to-indigo-500",
  "from-emerald-400 to-teal-500",
  "from-orange-400 to-rose-500",
  "from-purple-400 to-pink-500",
  "from-cyan-400 to-sky-500",
];

/* ═══════════════════════════════════════════ */
export default function WebOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newNote, setNewNote] = useState("");
  const [callResult, setCallResult] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  
  const [pathaoModalOpen, setPathaoModalOpen] = useState(false);
  const [detectedDistrict, setDetectedDistrict] = useState<string | null>(null);
  const [detectedThana, setDetectedThana] = useState<string | null>(null);
  const [addressParseApplied, setAddressParseApplied] = useState(false);
  const [reasonModal, setReasonModal] = useState<{ open: boolean; type: "cancel" | "on_hold" }>({ open: false, type: "cancel" });
  const [reasonValue, setReasonValue] = useState("");
  const [reasonNote, setReasonNote] = useState("");

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


  // Address auto-parsing
  const addressText = order?.delivery_address || customer?.address || "";
  const isEmptyValue = (v: string | null | undefined) => !v || v === "-" || v.trim() === "";
  const existingDistrict = order?.delivery_district || customer?.district || "";
  const existingThana = order?.delivery_thana || customer?.thana || "";
  const districtEmpty = isEmptyValue(existingDistrict);
  const thanaEmpty = isEmptyValue(existingThana);

  const { status: addressParseStatus } = useAddressParser({
    address: addressText,
    onAutoFill: (parsed) => {
      if (parsed.district) setDetectedDistrict(parsed.district);
      if (parsed.thana) setDetectedThana(parsed.thana);
    },
  });

  const addressSaveMutation = useMutation({
    mutationFn: async ({ district, thana }: { district?: string; thana?: string }) => {
      const updates: any = { updated_at: new Date().toISOString() };
      if (district) updates.delivery_district = district;
      if (thana) updates.delivery_thana = thana;
      const { error } = await supabase.from("orders").update(updates).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["web-order", id] });
      toast({ title: "✅ Address auto-filled", description: "District/Thana detected from address" });
    },
  });

  useEffect(() => {
    if (addressParseApplied || !order) return;
    const needsDistrict = districtEmpty && detectedDistrict;
    const needsThana = thanaEmpty && detectedThana;
    if (needsDistrict || needsThana) {
      setAddressParseApplied(true);
      addressSaveMutation.mutate({
        district: needsDistrict ? detectedDistrict! : undefined,
        thana: needsThana ? detectedThana! : undefined,
      });
    }
  }, [detectedDistrict, detectedThana, districtEmpty, thanaEmpty, order, addressParseApplied]);

  const districtAutoFilled = !!(detectedDistrict && (districtEmpty || existingDistrict === detectedDistrict));
  const thanaAutoFilled = !!(detectedThana && (thanaEmpty || existingThana === detectedThana));
  const showParsingIndicator = addressParseStatus === "parsing";

  /* ── Mutations ── */
  const statusMutation = useMutation({
    mutationFn: async ({ newStatus, reason, note }: { newStatus: string; reason?: string; note?: string }) => {
      const oldStatus = order?.web_order_status || "processing";
      const { error } = await supabase
        .from("orders")
        .update({ web_order_status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", id!);
      if (error) throw error;
      const reasonText = reason ? ` — Reason: ${reason}` : "";
      const noteText = note ? ` | Note: ${note}` : "";
      await supabase.from("web_order_notes").insert({
        order_id: id, note_type: "status_change",
        content: `Status changed from ${oldStatus} to ${newStatus}${reasonText}${noteText}`,
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
        .update({ web_order_status: "confirm", status: "pending", updated_at: new Date().toISOString() })
        .eq("id", id!);
      const { data: orderItems } = await supabase
        .from("order_items")
        .select("product_id, quantity, products(id, name, stock_quantity)")
        .eq("order_id", id!);
      if (orderItems) {
        for (const item of orderItems) {
          const product = item.products as any;
          if (!product?.id) continue;
          await supabase.from("products").update({
            stock_quantity: (product.stock_quantity || 0) - item.quantity,
            updated_at: new Date().toISOString(),
          }).eq("id", product.id);
          await supabase.from("inventory_movements").insert({
            product_id: product.id, movement_type: "order_pending", quantity: -item.quantity,
            reference_type: "order", reference_id: id,
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
      toast({ title: "✅ Order confirmed!", description: "Moved to Order List" });
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
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 p-6">
        <div className="max-w-[1600px] mx-auto space-y-5">
          <Skeleton className="h-16 w-full rounded-2xl bg-slate-100" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-8 space-y-5">
              <Skeleton className="h-80 rounded-2xl bg-slate-100" />
              <Skeleton className="h-48 rounded-2xl bg-slate-100" />
            </div>
            <div className="lg:col-span-4 space-y-5">
              <Skeleton className="h-60 rounded-2xl bg-slate-100" />
              <Skeleton className="h-48 rounded-2xl bg-slate-100" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!order) return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 flex items-center justify-center">
      <p className="text-slate-400 text-lg">Order not found</p>
    </div>
  );

  const currentStatus = order.web_order_status || "processing";
  const statusConfig = STATUS_BUTTONS.find((s) => s.key === currentStatus);
  const callLogs = notes?.filter((n) => n.note_type === "call_log") || [];
  const segment = customer?.segment || "regular";
  const segColor = segmentColors[segment] || segmentColors.regular;
  const avatarGrad = avatarColors[(customer?.full_name?.charCodeAt(0) || 0) % avatarColors.length];
  const initial = (customer?.full_name || "?")[0].toUpperCase();
  const subtotal = order.subtotal || 0;
  const discount = order.discount || 0;
  const deliveryCharge = order.delivery_charge || 0;
  const grandTotal = order.total_amount || 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 text-slate-900 relative overflow-hidden">
      {/* Decorative pastel gradients */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-sky-200/40 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 -right-40 w-[400px] h-[400px] bg-purple-200/35 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-1/3 w-[600px] h-[300px] bg-emerald-200/35 rounded-full blur-[120px]" />
      </div>

      {/* ═══ STICKY HEADER ═══ */}
      <header className={cn("sticky top-0 z-50 px-4 lg:px-6 py-3", glassHeader)}>
        <div className="max-w-[1600px] mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/web-orders")}
            className="rounded-xl h-9 w-9 text-slate-500 hover:text-slate-900 hover:bg-slate-100/80">
            <ArrowLeft className="w-4 h-4" />
          </Button>

          <h1 className="text-base font-bold tracking-tight text-slate-900">{order.order_number}</h1>

          {statusConfig && (
            <span className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold",
              statusConfig.active
            )}>
              {statusConfig.emoji} {currentStatus.replace(/_/g, " ").toUpperCase()}
            </span>
          )}

          <span className="text-[11px] text-slate-400 hidden sm:block">
            Updated {timeAgo(order.updated_at || order.created_at || "")}
          </span>

          <div className="ml-auto flex items-center gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100/80 gap-1.5 text-xs h-8">
                  <History className="w-3.5 h-3.5" /> Courier
                </Button>
              </SheetTrigger>
              <SheetContent className="bg-white/90 backdrop-blur-xl border-slate-200/60 text-slate-900">
                <SheetHeader><SheetTitle className="text-slate-900">Courier History</SheetTitle></SheetHeader>
                <div className="mt-6 space-y-3">
                  {order.pathao_tracking_code ? (
                    <div className={cn(glassLight, "p-4")}>
                      <p className="text-xs text-slate-500 mb-1">Tracking Code</p>
                      <p className="font-mono text-sm text-slate-900">{order.pathao_tracking_code}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 text-center py-8">No courier history yet</p>
                  )}
                </div>
              </SheetContent>
            </Sheet>
            <Button variant="ghost" size="icon" className="rounded-xl h-8 w-8 text-slate-500 hover:text-slate-900 hover:bg-slate-100/80">
              <Printer className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="rounded-xl h-8 w-8 text-slate-500 hover:text-slate-900 hover:bg-slate-100/80">
              <Save className="w-3.5 h-3.5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-xl h-8 w-8 text-slate-500 hover:text-slate-900 hover:bg-slate-100/80">
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-white/90 backdrop-blur-xl border-slate-200/60 text-slate-700 rounded-xl shadow-lg">
                <DropdownMenuItem className="text-xs focus:bg-slate-50">Duplicate Order</DropdownMenuItem>
                <DropdownMenuItem className="text-xs focus:bg-slate-50">Export PDF</DropdownMenuItem>
                <DropdownMenuItem className="text-xs text-rose-600 focus:bg-rose-50">Delete Order</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* ═══ MAIN LAYOUT ═══ */}
      <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-5 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

          {/* ════════ A) MAIN COLUMN (8/12) ════════ */}
          <div className="lg:col-span-8 space-y-5">

            {/* 1) ORDERED PRODUCTS */}
            <section className={cn(glass, "p-5")}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Package className="w-4 h-4 text-slate-400" />
                  Ordered Products ({items?.length || 0})
                </h2>
                <Button size="sm" className="rounded-xl h-8 text-xs gap-1.5 bg-sky-600 hover:bg-sky-700 text-white border-0">
                  <Plus className="w-3 h-3" /> Add Product
                </Button>
              </div>

              <div className="space-y-2">
                {items?.map((item) => {
                  const product = item.products as any;
                  const pName = product?.name || (item as any).product_name_fallback || "Product";
                  const pInitial = pName[0].toUpperCase();
                  return (
                    <div key={item.id} className="flex items-center gap-4 p-3 rounded-xl bg-white/60 border border-slate-200/60 hover:bg-white/90 transition-all duration-200 group">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200/60 flex items-center justify-center overflow-hidden shrink-0">
                        {product?.image_url ? (
                          <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm font-bold text-slate-400">{pInitial}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-slate-900 truncate">{pName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-sky-600 font-mono">{product?.sku || "-"}</span>
                          {product?.stock_quantity != null && (
                            <span className={cn("text-[10px]", product.stock_quantity < 10 ? "text-rose-500" : "text-slate-400")}>
                              Stock: {product.stock_quantity}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors border border-slate-200/60">
                          <Minus className="w-3 h-3 text-slate-500" />
                        </button>
                        <span className="w-8 text-center font-bold text-sm tabular-nums text-slate-900">{item.quantity}</span>
                        <button className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors border border-slate-200/60">
                          <Plus className="w-3 h-3 text-slate-500" />
                        </button>
                      </div>
                      <div className="text-right shrink-0 w-20">
                        <p className="text-[11px] text-slate-400">{formatBDT(item.unit_price)} ea</p>
                        <p className="text-sm font-semibold tabular-nums text-slate-900">{formatBDT(item.total_price)}</p>
                      </div>
                      <button className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
                {(!items || items.length === 0) && (
                  <div className="text-center py-10">
                    <Package className="w-8 h-8 mx-auto text-slate-200 mb-2" />
                    <p className="text-sm text-slate-400">No products added yet</p>
                  </div>
                )}
              </div>

              {/* Subtotal footer */}
              {items && items.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-sm">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="font-semibold tabular-nums text-slate-900">{formatBDT(subtotal)}</span>
                </div>
              )}
            </section>

            {/* 2) DELIVERY & NOTES */}
            <section className={cn(glass, "p-5")}>
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-4">
                <Truck className="w-4 h-4 text-slate-400" />
                Delivery & Notes
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div>
                  <label className="text-[11px] text-slate-500 font-medium mb-1.5 block">Source</label>
                  <div className="h-9 rounded-xl bg-white/80 border border-slate-200/60 flex items-center px-3 text-sm capitalize text-slate-900">
                    {order.channel || "Manual"}
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 font-medium mb-1.5 block">Delivery Method</label>
                  <div className="h-9 rounded-xl bg-white/80 border border-slate-200/60 flex items-center px-3 text-sm text-slate-900">
                    {order.pathao_consignment_id ? "Pathao" : "Custom"}
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 font-medium mb-1.5 block">Tracking ID</label>
                  <div className="h-9 rounded-xl bg-white/80 border border-slate-200/60 flex items-center px-3 text-sm font-mono text-slate-900">
                    {order.pathao_tracking_code || "—"}
                    {order.pathao_tracking_code && (
                      <button onClick={() => { navigator.clipboard.writeText(order.pathao_tracking_code!); toast({ title: "Copied!" }); }}
                        className="ml-auto text-slate-400 hover:text-slate-600"><Copy className="w-3 h-3" /></button>
                    )}
                  </div>
                </div>
              </div>

              {/* Note */}
              <div className="space-y-2">
                <label className="text-[11px] text-slate-500 font-medium block">Note</label>
                <Textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add delivery instructions..."
                  rows={3}
                  className="bg-white/80 border-slate-200/60 text-slate-900 placeholder:text-slate-300 rounded-xl resize-none focus:ring-2 focus:ring-sky-400/40 focus:border-sky-300"
                />
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_NOTES.map((chip) => (
                    <button
                      key={chip}
                      onClick={() => setNewNote((prev) => prev ? `${prev}, ${chip}` : chip)}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200/60 transition-all"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
                {newNote.trim() && (
                  <Button
                    onClick={() => noteMutation.mutate()}
                    disabled={noteMutation.isPending}
                    className="rounded-xl h-8 text-xs bg-sky-600 hover:bg-sky-700 text-white border-0 gap-1.5"
                    size="sm"
                  >
                    <Send className="w-3 h-3" /> Save Note
                  </Button>
                )}
              </div>

              {/* Previous notes */}
              {notes?.filter((n) => n.note_type === "note").slice(0, 3).map((note) => (
                <div key={note.id} className="mt-2 p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/40">
                  <p className="text-xs text-slate-600">{note.content}</p>
                  <p className="text-[10px] text-slate-400 mt-1">{note.created_by} • {timeAgo(note.created_at)}</p>
                </div>
              ))}
            </section>

            {/* 3) ADDRESS */}
            <section className={cn(glass, "p-5")}>
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-4">
                <MapPin className="w-4 h-4 text-slate-400" />
                Address
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <label className="text-[11px] text-slate-500 font-medium">District</label>
                    {districtAutoFilled && (
                      <span className="flex items-center gap-0.5 text-[10px] text-emerald-600 font-medium">
                        <CheckCircle2 className="w-3 h-3" /> Auto
                      </span>
                    )}
                    {showParsingIndicator && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
                  </div>
                  <Input
                    value={detectedDistrict || (districtEmpty ? "" : existingDistrict)}
                    readOnly
                    className={cn("rounded-xl h-9 text-sm bg-white/80 border-slate-200/60 text-slate-900", districtAutoFilled && "border-emerald-300 ring-1 ring-emerald-200")}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <label className="text-[11px] text-slate-500 font-medium">Thana</label>
                    {thanaAutoFilled && (
                      <span className="flex items-center gap-0.5 text-[10px] text-emerald-600 font-medium">
                        <CheckCircle2 className="w-3 h-3" /> Auto
                      </span>
                    )}
                  </div>
                  <Input
                    value={detectedThana || (thanaEmpty ? "" : existingThana)}
                    readOnly
                    className={cn("rounded-xl h-9 text-sm bg-white/80 border-slate-200/60 text-slate-900", thanaAutoFilled && "border-emerald-300 ring-1 ring-emerald-200")}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[11px] text-slate-500 font-medium mb-1.5 block">Full Address</label>
                  <Textarea
                    value={order.delivery_address || customer?.address || ""}
                    readOnly rows={2}
                    className="rounded-xl text-sm bg-white/80 border-slate-200/60 text-slate-900 resize-none"
                  />
                </div>
              </div>
            </section>

            {/* 4) CALL LOG */}
            <section className={cn(glass, "p-5")}>
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-4">
                <Phone className="w-4 h-4 text-slate-400" />
                Call Log
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
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
                <Button onClick={() => callLogMutation.mutate()} disabled={callLogMutation.isPending}
                  className="w-full rounded-xl h-9 bg-sky-600 hover:bg-sky-700 text-white border-0 text-xs gap-1.5 mb-3">
                  <Send className="w-3 h-3" /> Log Call
                </Button>
              )}
              {callLogs.length > 0 && (
                <div className="space-y-1.5 mt-2">
                  {callLogs.slice(0, 5).map((log) => (
                    <div key={log.id} className="flex items-center gap-3 p-2 rounded-lg bg-slate-50/80 text-xs border border-slate-200/40">
                      <span>📞</span>
                      <span className="capitalize font-medium text-slate-700">{log.call_result?.replace("_", " ")}</span>
                      <span className="text-slate-300">•</span>
                      <span className="text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" />{timeAgo(log.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 5) ACTIVITY LOG */}
            <section className={cn(glass, "p-5")}>
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-slate-400" />
                Activity Log
              </h2>
              {notes && notes.length > 0 ? (
                <div className="relative space-y-4 pl-6">
                  <div className="absolute left-[9px] top-2 bottom-2 w-px bg-slate-200" />
                  {notes.map((note) => (
                    <div key={note.id} className="relative flex gap-3">
                      <div className={cn("absolute left-[-15px] top-1.5 w-2.5 h-2.5 rounded-full ring-2 ring-white", noteTypeDot(note.note_type))} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-700">{note.content}</p>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                          <span>{note.created_by || "System"}</span>
                          <span>•</span>
                          <span>{timeAgo(note.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Clock className="w-6 h-6 mx-auto text-slate-200 mb-2" />
                  <p className="text-xs text-slate-400">No activity yet</p>
                </div>
              )}
            </section>
          </div>

          {/* ════════ B) SIDEBAR (4/12) ════════ */}
          <div className="lg:col-span-4 space-y-5 lg:sticky lg:top-[72px] lg:self-start">

            {/* 1) CUSTOMER CARD */}
            <section className={cn(glass, "p-5")}>
              <div className="flex items-center gap-3 mb-4">
                <div className={cn("w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center text-white font-bold text-lg shadow-md", avatarGrad)}>
                  {initial}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-sm text-slate-900 truncate">{customer?.full_name || "Unknown"}</p>
                    <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold uppercase", segColor.bg, segColor.text)}>
                      {segment}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">{customerPhone}</p>
                </div>
              </div>

              {/* Quick actions */}
              <div className="flex items-center gap-2 mb-4">
                {customerPhone && (
                  <>
                    <a href={`tel:${customerPhone}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200/60 hover:bg-sky-100 transition-colors">
                      <Phone className="w-3 h-3" /> Call
                    </a>
                    <a href={`sms:${customerPhone}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-slate-50 text-slate-700 border border-slate-200/60 hover:bg-slate-100 transition-colors">
                      <MessageCircle className="w-3 h-3" /> SMS
                    </a>
                    <a href={`https://wa.me/88${customerPhone.replace(/^0/, "")}`} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 hover:bg-emerald-100 transition-colors">
                      <Send className="w-3 h-3" /> WA
                    </a>
                  </>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2 rounded-xl bg-slate-50/80 border border-slate-200/40 text-center">
                  <p className="text-[10px] text-slate-400 uppercase">Orders</p>
                  <p className="font-bold text-sm mt-0.5 text-slate-900">{customer?.total_orders ?? 0}</p>
                </div>
                <div className="p-2 rounded-xl bg-slate-50/80 border border-slate-200/40 text-center">
                  <p className="text-[10px] text-slate-400 uppercase">Spent</p>
                  <p className="font-bold text-sm mt-0.5 text-slate-900">{formatBDT(customer?.total_spent)}</p>
                </div>
                <div className="p-2 rounded-xl bg-slate-50/80 border border-slate-200/40 text-center">
                  <p className="text-[10px] text-slate-400 uppercase">Success</p>
                  <p className="font-bold text-sm mt-0.5" style={{ color: bdReport ? getSuccessColor(bdReport.success_rate) : undefined }}>
                    {bdReport ? `${Math.round(bdReport.success_rate)}%` : "--"}
                  </p>
                </div>
              </div>

              {/* BD Courier gauge */}
              {bdReport && (
                <div className="mt-3 p-3 rounded-xl bg-slate-50/80 border border-slate-200/40">
                  <div className="flex items-center gap-3">
                    <div className="relative w-12 h-12 shrink-0">
                      <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
                        <circle cx="24" cy="24" r="18" fill="none" stroke="hsl(214 32% 91%)" strokeWidth="4" />
                        <circle cx="24" cy="24" r="18" fill="none"
                          stroke={getSuccessColor(bdReport.success_rate)}
                          strokeWidth="4"
                          strokeDasharray={`${bdReport.success_rate * 1.131} 113.1`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[11px] font-bold" style={{ color: getSuccessColor(bdReport.success_rate) }}>
                          {Math.round(bdReport.success_rate)}%
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold", riskInfo.bg || "bg-slate-100", riskInfo.color || "text-slate-600")}>
                        {riskInfo.label}
                      </span>
                      <p className="text-[10px] text-slate-400 mt-1">{bdReport.total_orders} total • {bdReport.successful_orders} success</p>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* 2) PAYMENT CARD */}
            <section className={cn(glass, "p-5")}>
              <h2 className="text-sm font-semibold text-slate-900 mb-4">Payment</h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Method</span>
                  <span className="capitalize font-medium text-slate-900">{order.payment_method || "COD"}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Status</span>
                  <span className={cn("px-2 py-0.5 rounded-lg text-[10px] font-semibold",
                    order.payment_status === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                  )}>
                    {order.payment_status || "pending"}
                  </span>
                </div>
                <Separator className="bg-slate-200/60" />
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Discount</span>
                  {discount > 0 ? (
                    <span className="text-rose-600">-{formatBDT(discount)}</span>
                  ) : (
                    <span className="text-slate-400">৳0</span>
                  )}
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Delivery</span>
                  <span className="tabular-nums text-slate-900">{formatBDT(deliveryCharge)}</span>
                </div>
                {order.cod_amount ? (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">COD Amount</span>
                    <span className="tabular-nums text-slate-900">{formatBDT(order.cod_amount)}</span>
                  </div>
                ) : null}
              </div>
            </section>

            {/* 3) TOTALS / ORDER SUMMARY */}
            <section className={cn(glass, "p-5")}>
              <h2 className="text-sm font-semibold text-slate-900 mb-4">Order Summary</h2>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="tabular-nums text-slate-900">{formatBDT(subtotal)}</span></div>
                {discount > 0 && (
                  <div className="flex justify-between"><span className="text-slate-500">Discount</span><span className="text-rose-600 tabular-nums">-{formatBDT(discount)}</span></div>
                )}
                <div className="flex justify-between"><span className="text-slate-500">Delivery</span><span className="tabular-nums text-slate-900">{formatBDT(deliveryCharge)}</span></div>
                <Separator className="bg-slate-200/60 my-2" />
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-semibold text-slate-900">Grand Total</span>
                  <span className="text-2xl font-bold bg-gradient-to-r from-sky-600 to-emerald-500 bg-clip-text text-transparent tabular-nums">
                    {formatBDT(grandTotal)}
                  </span>
                </div>
              </div>
              {/* Mini summary */}
              <div className="mt-3 p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/40 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px]">
                <div className="flex justify-between"><span className="text-slate-400">Items</span><span className="text-slate-600">{items?.length || 0}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Qty</span><span className="text-slate-600">{items?.reduce((s, i) => s + i.quantity, 0) || 0}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Source</span><span className="text-slate-600 capitalize">{order.channel}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Method</span><span className="text-slate-600">{order.payment_method || "COD"}</span></div>
              </div>
            </section>

            {/* 4) ORDER ACTIONS / STATUS */}
            <section className={cn(glass, "p-5")}>
              <h2 className="text-sm font-semibold text-slate-900 mb-3">Status Actions</h2>
              <div className="space-y-1.5">
                {STATUS_BUTTONS.map((s) => {
                  const isActive = currentStatus === s.key;
                  if (s.key === "confirm") {
                    return (
                      <AlertDialogRoot key={s.key} open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                        <ADTrigger asChild>
                          <button
                            disabled={isActive || statusMutation.isPending}
                            className={cn(
                              "w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200",
                              isActive ? s.active : s.color,
                              (isActive || statusMutation.isPending) && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            <span>{s.emoji}</span> {s.label}
                            {isActive && <CheckCircle2 className="w-3.5 h-3.5 ml-auto" />}
                          </button>
                        </ADTrigger>
                        <ADContent className="rounded-2xl bg-white/90 backdrop-blur-xl border-slate-200/60 text-slate-900 shadow-xl">
                          <ADHeader>
                            <ADTitle className="text-slate-900">Confirm this order?</ADTitle>
                            <ADDesc className="text-slate-500">This will move the order to the main processing queue.</ADDesc>
                          </ADHeader>
                          <ADFooter>
                            <ADCancel className="rounded-xl bg-white/70 border-slate-200 text-slate-900 hover:bg-white">Cancel</ADCancel>
                            <ADAction onClick={() => confirmMutation.mutate()} disabled={confirmMutation.isPending}
                              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white">
                              {confirmMutation.isPending ? "Confirming..." : "✅ Confirm Order"}
                            </ADAction>
                          </ADFooter>
                        </ADContent>
                      </AlertDialogRoot>
                    );
                  }
                  if (s.key === "on_hold") {
                    return (
                      <button
                        key={s.key}
                        onClick={() => { setReasonModal({ open: true, type: "on_hold" }); setReasonValue(""); setReasonNote(""); }}
                        disabled={isActive || statusMutation.isPending}
                        className={cn(
                          "w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200",
                          isActive ? s.active : s.color,
                          (isActive || statusMutation.isPending) && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <span>{s.emoji}</span> {s.label}
                        {isActive && <CheckCircle2 className="w-3.5 h-3.5 ml-auto" />}
                      </button>
                    );
                  }
                  return (
                    <button
                      key={s.key}
                      onClick={() => statusMutation.mutate({ newStatus: s.key })}
                      disabled={isActive || statusMutation.isPending}
                      className={cn(
                        "w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200",
                        isActive ? s.active : s.color,
                        (isActive || statusMutation.isPending) && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <span>{s.emoji}</span> {s.label}
                      {isActive && <CheckCircle2 className="w-3.5 h-3.5 ml-auto" />}
                    </button>
                  );
                })}
                {/* Cancel */}
                <button
                  onClick={() => { setReasonModal({ open: true, type: "cancel" }); setReasonValue(""); setReasonNote(""); }}
                  disabled={currentStatus === "cancel" || statusMutation.isPending}
                  className={cn(
                    "w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 mt-2",
                    currentStatus === "cancel"
                      ? "bg-rose-100 border-l-4 border-l-rose-500 border-y border-r border-rose-300 text-rose-900 opacity-50 cursor-not-allowed"
                      : "bg-rose-50 border-l-4 border-l-rose-400 border-y border-r border-rose-200/60 text-rose-700 hover:bg-rose-100"
                  )}
                >
                  ❌ Cancel
                  {currentStatus === "cancel" && <CheckCircle2 className="w-3.5 h-3.5 ml-auto" />}
                </button>
              </div>
            </section>

            {/* Pathao */}
            {currentStatus === "confirm" && !order.pathao_consignment_id && (
              <section className="bg-emerald-50/80 backdrop-blur-xl border border-emerald-200/60 rounded-2xl p-4 shadow-sm">
                <Button
                  onClick={() => setPathaoModalOpen(true)}
                  className="w-full rounded-xl h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs gap-2"
                >
                  <Truck className="w-4 h-4" />
                  Send to Pathao
                </Button>
                <p className="text-[10px] text-emerald-600 text-center mt-2">Order confirmed — ready to ship</p>
              </section>
            )}

            {order.pathao_consignment_id && (
              <PathaoTrackingCard
                consignmentId={order.pathao_consignment_id}
                trackingCode={order.pathao_tracking_code || undefined}
              />
            )}
          </div>
        </div>
      </div>

      {/* Reason Modal for Cancel / On Hold */}
      <Dialog open={reasonModal.open} onOpenChange={(open) => setReasonModal((prev) => ({ ...prev, open }))}>
        <DialogContent className="rounded-2xl bg-white/90 backdrop-blur-xl border-slate-200/60 text-slate-900 max-w-md shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-slate-900 flex items-center gap-2">
              {reasonModal.type === "cancel" ? "❌ Cancel Order" : "⏸️ Put On Hold"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-[11px] text-slate-500 font-medium mb-1.5 block">
                Reason <span className="text-rose-500">*</span>
              </label>
              <Select value={reasonValue} onValueChange={setReasonValue}>
                <SelectTrigger className="rounded-xl bg-white/80 border-slate-200/60 text-slate-900 h-10 focus:ring-sky-400/40">
                  <SelectValue placeholder="Select a reason..." />
                </SelectTrigger>
                <SelectContent className="bg-white/95 backdrop-blur-xl border-slate-200/60 text-slate-900 rounded-xl shadow-lg">
                  {(reasonModal.type === "cancel" ? CANCEL_REASONS : HOLD_REASONS).map((r) => (
                    <SelectItem key={r} value={r} className="text-slate-700 focus:bg-slate-50 focus:text-slate-900 rounded-lg">
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] text-slate-500 font-medium mb-1.5 block">Additional Note (optional)</label>
              <Textarea
                value={reasonNote}
                onChange={(e) => setReasonNote(e.target.value)}
                placeholder="Add more details..."
                rows={3}
                className="bg-white/80 border-slate-200/60 text-slate-900 placeholder:text-slate-300 rounded-xl resize-none focus:ring-2 focus:ring-sky-400/40 focus:border-sky-300"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setReasonModal({ open: false, type: "cancel" })}
              className="rounded-xl bg-white/70 border border-slate-200 text-slate-900 hover:bg-white">
              Go Back
            </Button>
            <Button
              disabled={!reasonValue || statusMutation.isPending}
              onClick={() => {
                statusMutation.mutate(
                  { newStatus: reasonModal.type, reason: reasonValue, note: reasonNote },
                  { onSuccess: () => { setReasonModal({ open: false, type: "cancel" }); setReasonValue(""); setReasonNote(""); } }
                );
              }}
              className={cn(
                "rounded-xl font-semibold",
                reasonModal.type === "cancel"
                  ? "bg-rose-600 hover:bg-rose-700 text-white"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white"
              )}
            >
              {statusMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> :
                reasonModal.type === "cancel" ? "❌ Confirm Cancel" : "⏸️ Confirm Hold"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pathao Booking Modal */}
      <PathaoBookingModal
        open={pathaoModalOpen}
        onOpenChange={setPathaoModalOpen}
        order={order}
        customer={customer}
        items={items || []}
      />

    </div>
  );
}
