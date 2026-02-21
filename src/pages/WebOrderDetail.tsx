import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
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
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { formatBDT, formatDateTime, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Phone, MessageCircle, Send, Clock, MapPin,
  Package, CheckCircle2, RefreshCw, Copy, Plus, Minus, X, Search,
  Truck, Loader2, AlertTriangle, Printer, Save, MoreHorizontal,
  History, User, ChevronRight, Zap, Activity, CreditCard, ExternalLink,
  PhoneOff, Pause, Wallet, XCircle, CircleCheck,
} from "lucide-react";
import { useAddressParser } from "@/hooks/use-address-parser";
import { useBDCourierSingle, getRiskLevel, getSuccessColor } from "@/hooks/use-bd-courier";
import { PathaoTrackingCard } from "@/components/pathao/PathaoTrackingCard";
import { AddressFixDrawer } from "@/components/orders/AddressFixDrawer";
import { mapAddressToPathao, type MappingResult } from "@/lib/address-mapper";
import { useCompanySettings } from "@/hooks/use-company-settings";
import { useInvoiceSettings } from "@/hooks/use-invoice-settings";
import { printInvoice } from "@/components/orders/PrintInvoice";

/* ─── STATUS CONFIG ─── */
const STATUS_BUTTONS = [
  { key: "processing", label: "Processing", icon: Clock, dotColor: "bg-amber-500" },
  { key: "confirm", label: "Confirm", icon: CircleCheck, dotColor: "bg-emerald-500" },
  { key: "good_but_no_response", label: "Good No Response", icon: CheckCircle2, dotColor: "bg-sky-500" },
  { key: "no_response", label: "No Response", icon: PhoneOff, dotColor: "bg-rose-500" },
  { key: "on_hold", label: "On Hold", icon: Pause, dotColor: "bg-indigo-500" },
  { key: "advance_payment", label: "Advance Payment", icon: Wallet, dotColor: "bg-orange-500" },
] as const;

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  processing: { label: "Processing", color: "bg-amber-100 text-amber-800" },
  confirm: { label: "Confirmed", color: "bg-emerald-100 text-emerald-800" },
  good_but_no_response: { label: "Good No Resp", color: "bg-sky-100 text-sky-800" },
  no_response: { label: "No Response", color: "bg-rose-100 text-rose-800" },
  on_hold: { label: "On Hold", color: "bg-indigo-100 text-indigo-800" },
  advance_payment: { label: "Advance", color: "bg-orange-100 text-orange-800" },
  cancel: { label: "Cancelled", color: "bg-red-100 text-red-800" },
};

const CALL_OPTIONS = [
  { key: "answered", label: "Answered", emoji: "✅", color: "bg-emerald-50 border-emerald-200 text-emerald-700", active: "bg-emerald-100 border-emerald-400 text-emerald-900 ring-2 ring-emerald-300" },
  { key: "no_answer", label: "No Answer", emoji: "📵", color: "bg-orange-50 border-orange-200 text-orange-700", active: "bg-orange-100 border-orange-400 text-orange-900 ring-2 ring-orange-300" },
  { key: "busy", label: "Busy", emoji: "🔴", color: "bg-rose-50 border-rose-200 text-rose-700", active: "bg-rose-100 border-rose-400 text-rose-900 ring-2 ring-rose-300" },
  { key: "voicemail", label: "Voicemail", emoji: "📩", color: "bg-slate-50 border-slate-200 text-slate-600", active: "bg-slate-200 border-slate-400 text-slate-900 ring-2 ring-slate-300" },
];

const QUICK_NOTES = ["Call before delivery", "Fragile", "Gift wrap", "Deliver after 6 PM"];

const CANCEL_REASONS = [
  "Customer requested cancellation", "Duplicate order", "Out of stock",
  "Fraudulent order", "Price dispute", "Wrong product ordered", "Other",
];
const HOLD_REASONS = [
  "Waiting for customer confirmation", "Payment verification pending",
  "Address clarification needed", "Customer unreachable",
  "Stock arriving soon", "Customer requested delay", "Other",
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
    default: return "bg-muted-foreground/40";
  }
};

const normalizePhone = (phone: string) => {
  let p = phone.replace(/\s+/g, "");
  if (p.startsWith("+88")) p = p.slice(3);
  else if (p.startsWith("88") && p.length > 11) p = p.slice(2);
  return p;
};

/* ═══════════════════════════════════════════ */
export default function WebOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { settings: company } = useCompanySettings();
  const { invoiceSettings } = useInvoiceSettings();

  const [newNote, setNewNote] = useState("");
  const [callResult, setCallResult] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmSending, setConfirmSending] = useState(false);

  // Address fix
  const [addressFixOpen, setAddressFixOpen] = useState(false);
  const [addressMappingResult, setAddressMappingResult] = useState<MappingResult | null>(null);
  const [detectedDistrict, setDetectedDistrict] = useState<string | null>(null);
  const [detectedThana, setDetectedThana] = useState<string | null>(null);
  const [addressParseApplied, setAddressParseApplied] = useState(false);
  const [reasonModal, setReasonModal] = useState<{ open: boolean; type: "cancel" | "on_hold" }>({ open: false, type: "cancel" });
  const [reasonValue, setReasonValue] = useState("");
  const [reasonNote, setReasonNote] = useState("");
  const [addressFixSending, setAddressFixSending] = useState(false);

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
        .select("*, products(name, sku, image_url, stock_quantity, weight_kg)")
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

  const { data: pathaoDefaults } = useQuery({
    queryKey: ["pathao-defaults"],
    queryFn: async () => {
      const { data } = await supabase
        .from("settings")
        .select("key, value")
        .in("key", ["pathao_default_store", "pathao_delivery_type", "pathao_default_weight"]);
      const map: Record<string, string> = {};
      data?.forEach((s: any) => { map[s.key] = s.value || ""; });
      return map;
    },
    staleTime: 60 * 1000,
  });

  // Previous orders for returning customer check
  const customer = order?.customers as any;
  const customerPhone = customer?.phone || "";

  const { data: prevOrders } = useQuery({
    queryKey: ["customer-prev-orders-web", customerPhone],
    queryFn: async () => {
      if (!customerPhone) return [];
      const { data: cust } = await supabase
        .from("customers").select("id").eq("phone", customerPhone).maybeSingle();
      if (!cust) return [];
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, status, total_amount, created_at, channel, order_items(quantity, products(name))")
        .eq("customer_id", cust.id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
    enabled: !!customerPhone,
  });

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
      toast({ title: "✅ Address auto-filled" });
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

  /* ── Status mutation ── */
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

  /* ── Send to Pathao ── */
  const sendToPathao = async (cityId: number, cityName: string, zoneId: number, zoneName: string) => {
    if (!order || !customer) return;
    const storeId = pathaoDefaults?.pathao_default_store;
    const deliveryType = pathaoDefaults?.pathao_delivery_type || "48";
    const defaultWeight = pathaoDefaults?.pathao_default_weight || "0.5";

    if (!storeId) {
      toast({ title: "Pathao store সেট করুন", description: "Settings → Pathao → Default Store", variant: "destructive" });
      return;
    }

    const orderItems = items || [];
    const totalWeight = orderItems.reduce((sum: number, i: any) => sum + ((i.products as any)?.weight_kg || 0) * i.quantity, 0);
    const weight = totalWeight > 0 ? Math.round(totalWeight * 10) / 10 : Number(defaultWeight);
    const isCOD = order.payment_method?.toLowerCase() === "cod" || order.payment_status !== "paid";
    const totalItems = orderItems.reduce((sum: number, i: any) => sum + i.quantity, 0) || 1;
    const desc = orderItems.map((i: any) => (i.products as any)?.name).filter(Boolean).join(", ") || "";

    const orderPayload = {
      orders: [{
        store_id: Number(storeId),
        merchant_order_id: order.order_number,
        recipient_name: customer.full_name,
        recipient_phone: normalizePhone(customer.phone),
        recipient_address: order.delivery_address || customer.address || "",
        recipient_city: cityId,
        recipient_zone: zoneId,
        delivery_type: Number(deliveryType),
        item_type: 2,
        special_instruction: "",
        item_quantity: totalItems,
        item_weight: weight,
        amount_to_collect: isCOD ? Number(order.total_amount || 0) : 0,
        item_description: desc,
      }],
    };

    const { data: result, error: sendErr } = await supabase.functions.invoke("pathao-proxy", { body: { action: "create_order", order: orderPayload } });
    if (sendErr) throw sendErr;
    if (result?._ok === false) throw new Error(result?.message || JSON.stringify(result?.errors) || "Pathao API error");

    const consignment = result?.data?.[0] || result?.[0];
    const consignmentId = consignment?.consignment_id || "";
    const trackingCode = consignment?.tracking_code || "";

    if (consignmentId) {
      await supabase.from("orders").update({
        pathao_consignment_id: String(consignmentId),
        pathao_tracking_code: trackingCode,
        courier_status: "Pending",
        delivery_district: cityName,
        delivery_thana: zoneName,
        updated_at: new Date().toISOString(),
      }).eq("id", id!);
      await supabase.from("web_order_notes").insert({
        order_id: id, note_type: "activity",
        content: `Sent to Pathao • consignmentId=${consignmentId}`, created_by: "Staff",
      });
      toast({ title: "✅ Pathao এ পাঠানো হয়েছে!", description: `Consignment: ${consignmentId}` });
    } else {
      await supabase.from("orders").update({ courier_status: "Processing", updated_at: new Date().toISOString() }).eq("id", id!);
      await supabase.from("web_order_notes").insert({
        order_id: id, note_type: "activity",
        content: `Sent to Pathao (bulk). ${result?.message || "Processing..."}`, created_by: "Staff",
      });
      toast({ title: "✅ Pathao এ পাঠানো হয়েছে!", description: result?.message || "Processing..." });
    }
  };

  /* ── CONFIRM with auto-mapping ── */
  const handleConfirmWithMapping = async () => {
    if (!order || !customer) return;
    setConfirmSending(true);
    try {
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

      const fullAddress = order.delivery_address || customer?.address || "";
      const { data: citiesData, error: citiesErr } = await supabase.functions.invoke("pathao-proxy", { body: { action: "cities" } });
      if (citiesErr) throw citiesErr;
      const cities = citiesData?.data?.data || [];
      const mappingResult = mapAddressToPathao(fullAddress, cities, []);

      if (mappingResult.success && mappingResult.cityId) {
        const { data: zonesData } = await supabase.functions.invoke("pathao-proxy", { body: { action: "zones", city_id: mappingResult.cityId } });
        const zones = zonesData?.data?.data || [];
        const fullMapping = mapAddressToPathao(fullAddress, cities, zones);

        await supabase.from("web_order_notes").insert({
          order_id: id, note_type: "activity",
          content: `Auto-mapped: district=${fullMapping.cityName} (${Math.round(fullMapping.cityScore * 100)}%), thana=${fullMapping.zoneName} (${Math.round(fullMapping.zoneScore * 100)}%)`,
          created_by: "System",
        });

        if (fullMapping.success && fullMapping.cityId && fullMapping.zoneId) {
          await supabase.from("web_order_notes").insert({
            order_id: id, note_type: "activity",
            content: "Order confirmed and moved to Order List (Pending)", created_by: "Staff",
          });
          try {
            await sendToPathao(fullMapping.cityId, fullMapping.cityName, fullMapping.zoneId, fullMapping.zoneName);
          } catch (pathaoErr: any) {
            console.error("Pathao send error:", pathaoErr);
            toast({ title: "Order confirmed but Pathao send failed", description: pathaoErr.message, variant: "destructive" });
            await supabase.from("orders").update({ courier_status: "PATHAO_FAILED", updated_at: new Date().toISOString() }).eq("id", id!);
            await supabase.from("web_order_notes").insert({ order_id: id, note_type: "activity", content: `Pathao failed: ${pathaoErr.message}`, created_by: "Staff" });
          }
        } else {
          setAddressMappingResult(fullMapping);
          await supabase.from("orders").update({ courier_status: "ADDRESS_FIX_REQUIRED", updated_at: new Date().toISOString() }).eq("id", id!);
          await supabase.from("web_order_notes").insert({ order_id: id, note_type: "activity", content: "Order confirmed and moved to Order List (Pending)", created_by: "Staff" });
          toast({ title: "📍 Address fix required" });
          setAddressFixOpen(true);
        }
      } else {
        setAddressMappingResult(mappingResult);
        await supabase.from("orders").update({ courier_status: "ADDRESS_FIX_REQUIRED", updated_at: new Date().toISOString() }).eq("id", id!);
        await supabase.from("web_order_notes").insert({ order_id: id, note_type: "activity", content: "Order confirmed and moved to Order List (Pending)", created_by: "Staff" });
        toast({ title: "📍 Address fix required" });
        setAddressFixOpen(true);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setConfirmSending(false);
      setShowConfirmDialog(false);
      queryClient.invalidateQueries({ queryKey: ["web-order", id] });
      queryClient.invalidateQueries({ queryKey: ["web-order-notes", id] });
      queryClient.invalidateQueries({ queryKey: ["web-orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders-full"] });
      queryClient.invalidateQueries({ queryKey: ["order-status-counts"] });
    }
  };

  const handleAddressFixAccept = async (cityId: number, cityName: string, zoneId: number, zoneName: string) => {
    setAddressFixSending(true);
    try {
      await sendToPathao(cityId, cityName, zoneId, zoneName);
      setAddressFixOpen(false);
    } catch (err: any) {
      toast({ title: "Pathao send failed", description: err.message, variant: "destructive" });
      await supabase.from("orders").update({ courier_status: "PATHAO_FAILED" }).eq("id", id!);
    } finally {
      setAddressFixSending(false);
      queryClient.invalidateQueries({ queryKey: ["web-order", id] });
      queryClient.invalidateQueries({ queryKey: ["web-order-notes", id] });
    }
  };

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

  const handlePrintInvoice = useCallback(() => {
    if (!order) return;
    const orderWithItems = { ...order, order_items: items || [] };
    printInvoice(orderWithItems, company, invoiceSettings);
  }, [order, items, company, invoiceSettings]);

  /* ── Loading ── */
  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-14 w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
          <div className="space-y-5">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
          <div className="space-y-5">
            <Skeleton className="h-72 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!order) return <div className="text-center py-12 text-muted-foreground">Order not found</div>;

  const currentStatus = order.web_order_status || "processing";
  const statusCfg = STATUS_LABELS[currentStatus] || { label: currentStatus, color: "bg-muted text-muted-foreground" };
  const callLogs = notes?.filter((n) => n.note_type === "call_log") || [];
  const isReturning = (prevOrders?.length || 0) > 1;
  const subtotal = order.subtotal || 0;
  const discount = order.discount || 0;
  const deliveryCharge = order.delivery_charge || 0;
  const grandTotal = order.total_amount || 0;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6 animate-fade-in">
        {/* ═══ STICKY HEADER ═══ */}
        <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl -mx-6 px-6 py-4 border-b border-border/50">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/web-orders")} className="shrink-0">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-xl font-bold tracking-tight">#{order.order_number}</h1>
                  <Badge className={cn("text-xs", statusCfg.color)}>{statusCfg.label}</Badge>
                  {order.courier_status === "ADDRESS_FIX_REQUIRED" && (
                    <Badge variant="outline" className="text-[10px] bg-orange-50 text-orange-700 border-orange-200 gap-1 cursor-pointer" onClick={() => setAddressFixOpen(true)}>
                      <MapPin className="w-3 h-3" /> Fix Address
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Created {formatDateTime(order.created_at)} · Updated {timeAgo(order.updated_at || order.created_at || "")}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9 rounded-xl" onClick={handlePrintInvoice}>
                <Printer className="w-3.5 h-3.5" /> Print
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="text-xs">Duplicate Order</DropdownMenuItem>
                  <DropdownMenuItem className="text-xs">Export PDF</DropdownMenuItem>
                  <DropdownMenuItem className="text-xs text-destructive">Delete Order</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* ═══ TWO COLUMN LAYOUT ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">

          {/* ════ LEFT COLUMN ════ */}
          <div className="space-y-5">

            {/* 1) CUSTOMER CARD */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" /> Customer
                  </CardTitle>
                  <Badge variant="outline" className={cn("text-xs", isReturning ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-emerald-50 text-emerald-700 border-emerald-200")}>
                    {isReturning ? `🔄 Returning (${prevOrders?.length} orders)` : "🆕 New Customer"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Phone row */}
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold font-mono tracking-wider">{customerPhone}</span>
                  <div className="flex gap-1 ml-auto">
                    <Tooltip><TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-sky-600 hover:bg-sky-50" onClick={() => window.open(`tel:${customerPhone}`, "_self")}>
                        <Phone className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger><TooltipContent className="text-xs">Call</TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600 hover:bg-emerald-50"
                        onClick={() => window.open(`https://wa.me/88${customerPhone.replace(/^0/, "")}`, "_blank")}>
                        <MessageCircle className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger><TooltipContent className="text-xs">WhatsApp</TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-muted"
                        onClick={() => { navigator.clipboard.writeText(customerPhone); toast({ title: "Copied!" }); }}>
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    </TooltipTrigger><TooltipContent className="text-xs">Copy</TooltipContent></Tooltip>
                  </div>
                </div>
                <div>
                  <p className="font-medium text-sm">{customer?.full_name || "Unknown"}</p>
                  {(order.delivery_address || customer?.address) && (
                    <p className="text-xs text-muted-foreground flex items-start gap-1 mt-1">
                      <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                      {order.delivery_address || customer?.address}
                    </p>
                  )}
                </div>

                {/* BD Courier success */}
                {bdReport && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                    <div className="relative w-11 h-11 shrink-0">
                      <svg className="w-11 h-11 -rotate-90" viewBox="0 0 48 48">
                        <circle cx="24" cy="24" r="18" fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
                        <circle cx="24" cy="24" r="18" fill="none"
                          stroke={getSuccessColor(bdReport.success_rate)} strokeWidth="4"
                          strokeDasharray={`${bdReport.success_rate * 1.131} 113.1`} strokeLinecap="round" />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">{Math.round(bdReport.success_rate)}%</span>
                    </div>
                    <div>
                      <Badge className={cn("text-[10px]", riskInfo.bg, riskInfo.color)}>{riskInfo.label}</Badge>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{bdReport.total_orders} total · {bdReport.successful_orders} success</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 ml-auto" onClick={() => refetchBD()}>
                      <RefreshCw className={cn("w-3 h-3", bdLoading && "animate-spin")} />
                    </Button>
                  </div>
                )}

                {/* Previous orders */}
                {isReturning && prevOrders && prevOrders.length > 0 && (
                  <div className="border-t border-border pt-3 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Previous Orders</p>
                    {prevOrders.slice(0, 4).map((o) => {
                      const oItems = (o as any).order_items || [];
                      const firstName = oItems[0]?.products?.name || "Product";
                      return (
                        <div key={o.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/50">
                          <div className="flex-1 min-w-0">
                            <span className="font-medium">#{o.order_number}</span>
                            <span className="text-muted-foreground ml-2 truncate">{firstName} · {formatBDT(o.total_amount)}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <Badge className={cn("text-[10px] px-1.5 py-0",
                              o.status === "delivered" ? "bg-emerald-100 text-emerald-800" :
                              o.status === "cancelled" ? "bg-red-100 text-red-800" : "bg-muted text-muted-foreground"
                            )}>{o.status}</Badge>
                            <span className="text-[10px] text-muted-foreground">{formatDate(o.created_at)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 2) ORDER ITEMS */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="w-4 h-4 text-muted-foreground" /> Order Items ({items?.length || 0})
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {items?.map((item) => {
                    const product = item.products as any;
                    const pName = product?.name || (item as any).product_name_fallback || "Product";
                    return (
                      <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border hover:bg-muted/50 transition-all group">
                        <div className="w-11 h-11 rounded-lg overflow-hidden border border-border shrink-0">
                          {product?.image_url ? (
                            <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-primary/5 flex items-center justify-center text-xs font-bold text-primary">{pName[0]}</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{pName}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-primary font-mono">{product?.sku || "-"}</span>
                            {product?.stock_quantity != null && (
                              <span className={cn("text-[10px]", product.stock_quantity < 10 ? "text-destructive" : "text-muted-foreground")}>
                                Stock: {product.stock_quantity}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="w-8 text-center font-bold text-sm tabular-nums">×{item.quantity}</span>
                        </div>
                        <div className="text-right shrink-0 w-20">
                          <p className="text-[11px] text-muted-foreground">{formatBDT(item.unit_price)} ea</p>
                          <p className="text-sm font-semibold tabular-nums">{formatBDT(item.total_price)}</p>
                        </div>
                      </div>
                    );
                  })}
                  {(!items || items.length === 0) && (
                    <div className="text-center py-6 text-muted-foreground text-sm">
                      <Package className="w-6 h-6 mx-auto mb-2 opacity-30" />No items
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 3) DELIVERY & NOTES */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" /> Delivery & Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Note input */}
                <div className="space-y-2">
                  <Textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add a note about this order..."
                    rows={2}
                    className="text-sm resize-none"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_NOTES.map((chip) => (
                      <button key={chip} onClick={() => setNewNote((prev) => prev ? `${prev}, ${chip}` : chip)}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-border transition-all">
                        {chip}
                      </button>
                    ))}
                  </div>
                  {newNote.trim() && (
                    <Button onClick={() => noteMutation.mutate()} disabled={noteMutation.isPending} size="sm" className="gap-1.5 text-xs">
                      <Send className="w-3 h-3" /> Save Note
                    </Button>
                  )}
                </div>
                {notes?.filter((n) => n.note_type === "note").slice(0, 3).map((note) => (
                  <div key={note.id} className="p-2.5 rounded-lg bg-muted/50 border border-border">
                    <p className="text-xs">{note.content}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{note.created_by} · {timeAgo(note.created_at)}</p>
                  </div>
                ))}

                <Separator />

                {/* Address */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <label className="text-[11px] text-muted-foreground font-medium">District</label>
                      {districtAutoFilled && <span className="flex items-center gap-0.5 text-[10px] text-emerald-600 font-medium"><CheckCircle2 className="w-3 h-3" /> Auto</span>}
                      {showParsingIndicator && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                    </div>
                    <Input value={detectedDistrict || (districtEmpty ? "" : existingDistrict)} readOnly
                      className={cn("h-9 text-sm", districtAutoFilled && "border-emerald-300 ring-1 ring-emerald-200")} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <label className="text-[11px] text-muted-foreground font-medium">Thana</label>
                      {thanaAutoFilled && <span className="flex items-center gap-0.5 text-[10px] text-emerald-600 font-medium"><CheckCircle2 className="w-3 h-3" /> Auto</span>}
                    </div>
                    <Input value={detectedThana || (thanaEmpty ? "" : existingThana)} readOnly
                      className={cn("h-9 text-sm", thanaAutoFilled && "border-emerald-300 ring-1 ring-emerald-200")} />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[11px] text-muted-foreground font-medium mb-1 block">Full Address</label>
                    <Textarea value={order.delivery_address || customer?.address || ""} readOnly rows={2} className="text-sm resize-none" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 4) CALL LOG */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" /> Call Log
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {CALL_OPTIONS.map((opt) => (
                    <button key={opt.key} onClick={() => setCallResult(opt.key)}
                      className={cn("flex flex-col items-center gap-1 px-3 py-3 rounded-xl text-xs font-semibold border transition-all",
                        callResult === opt.key ? opt.active : opt.color)}>
                      <span className="text-lg">{opt.emoji}</span>
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
                {callResult && (
                  <Button onClick={() => callLogMutation.mutate()} disabled={callLogMutation.isPending}
                    className="w-full text-xs gap-1.5" size="sm">
                    <Send className="w-3 h-3" /> Log Call
                  </Button>
                )}
                {callLogs.length > 0 && (
                  <div className="space-y-1.5">
                    {callLogs.slice(0, 5).map((log) => (
                      <div key={log.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 text-xs border border-border">
                        <span>📞</span>
                        <span className="capitalize font-medium">{log.call_result?.replace("_", " ")}</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{timeAgo(log.created_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 5) ACTIVITY LOG */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="w-4 h-4 text-muted-foreground" /> Activity Log
                </CardTitle>
              </CardHeader>
              <CardContent>
                {notes && notes.length > 0 ? (
                  <div className="relative space-y-4 pl-6">
                    <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border" />
                    {notes.map((note) => (
                      <div key={note.id} className="relative flex gap-3">
                        <div className={cn("absolute left-[-15px] top-1.5 w-2.5 h-2.5 rounded-full ring-2 ring-background", noteTypeDot(note.note_type))} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs">{note.content}</p>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                            <span>{note.created_by || "System"}</span>
                            <span>·</span>
                            <span>{timeAgo(note.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Clock className="w-6 h-6 mx-auto text-muted-foreground/30 mb-2" />
                    <p className="text-xs text-muted-foreground">No activity yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ════ RIGHT COLUMN (Sticky) ════ */}
          <div className="space-y-5 lg:sticky lg:top-24 lg:self-start">

            {/* 1) STATUS ACTIONS */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="w-4 h-4 text-muted-foreground" /> Status Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {STATUS_BUTTONS.map((s) => {
                  const Icon = s.icon;
                  const isActive = currentStatus === s.key;

                  if (s.key === "confirm") {
                    return (
                      <AlertDialogRoot key={s.key} open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                        <ADTrigger asChild>
                          <button disabled={isActive || statusMutation.isPending || confirmSending}
                            className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left",
                              isActive ? "bg-foreground text-background" : "hover:bg-muted/80",
                              (isActive || statusMutation.isPending || confirmSending) && "opacity-50 cursor-not-allowed")}>
                            <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", s.dotColor)} />
                            <Icon className="w-4 h-4 shrink-0" />
                            <span className="flex-1">{s.label}</span>
                            {confirmSending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            {isActive && !confirmSending && <CheckCircle2 className="w-3.5 h-3.5" />}
                          </button>
                        </ADTrigger>
                        <ADContent>
                          <ADHeader>
                            <ADTitle>Confirm this order?</ADTitle>
                            <ADDesc>This will confirm the order, deduct stock, and automatically map the address for Pathao courier.</ADDesc>
                          </ADHeader>
                          <ADFooter>
                            <ADCancel>Cancel</ADCancel>
                            <ADAction onClick={handleConfirmWithMapping} disabled={confirmSending}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white">
                              {confirmSending ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Confirming...</> : "✅ Confirm Order"}
                            </ADAction>
                          </ADFooter>
                        </ADContent>
                      </AlertDialogRoot>
                    );
                  }

                  if (s.key === "on_hold") {
                    return (
                      <button key={s.key}
                        onClick={() => { setReasonModal({ open: true, type: "on_hold" }); setReasonValue(""); setReasonNote(""); }}
                        disabled={isActive || statusMutation.isPending}
                        className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left",
                          isActive ? "bg-foreground text-background" : "hover:bg-muted/80",
                          (isActive || statusMutation.isPending) && "opacity-50 cursor-not-allowed")}>
                        <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", s.dotColor)} />
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="flex-1">{s.label}</span>
                        {isActive && <CheckCircle2 className="w-3.5 h-3.5" />}
                      </button>
                    );
                  }

                  return (
                    <button key={s.key}
                      onClick={() => statusMutation.mutate({ newStatus: s.key })}
                      disabled={isActive || statusMutation.isPending}
                      className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left",
                        isActive ? "bg-foreground text-background" : "hover:bg-muted/80",
                        (isActive || statusMutation.isPending) && "opacity-50 cursor-not-allowed")}>
                      <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", s.dotColor)} />
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="flex-1">{s.label}</span>
                      {isActive && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </button>
                  );
                })}

                {/* Cancel */}
                <button
                  onClick={() => { setReasonModal({ open: true, type: "cancel" }); setReasonValue(""); setReasonNote(""); }}
                  disabled={currentStatus === "cancel" || statusMutation.isPending}
                  className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left mt-2",
                    currentStatus === "cancel" ? "bg-foreground text-background opacity-50 cursor-not-allowed" : "hover:bg-destructive/10 text-destructive")}>
                  <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-red-500" />
                  <XCircle className="w-4 h-4 shrink-0" />
                  <span className="flex-1">Cancel</span>
                  {currentStatus === "cancel" && <CheckCircle2 className="w-3.5 h-3.5" />}
                </button>
              </CardContent>
            </Card>

            {/* 2) PAYMENT & SUMMARY */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-muted-foreground" /> Payment Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Method</span><span className="capitalize font-medium">{order.payment_method || "COD"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Status</span>
                  <Badge className={cn("text-[10px]", order.payment_status === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>{order.payment_status || "pending"}</Badge>
                </div>
                <Separator />
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{formatBDT(subtotal)}</span></div>
                {discount > 0 && <div className="flex justify-between text-destructive"><span>Discount</span><span className="tabular-nums">-{formatBDT(discount)}</span></div>}
                <div className="flex justify-between"><span className="text-muted-foreground">Delivery</span><span className="tabular-nums">{formatBDT(deliveryCharge)}</span></div>
                {order.cod_amount ? <div className="flex justify-between"><span className="text-muted-foreground">COD Amount</span><span className="tabular-nums">{formatBDT(order.cod_amount)}</span></div> : null}
                <Separator />
                <div className="flex justify-between items-baseline">
                  <span className="font-semibold">Grand Total</span>
                  <span className="text-xl font-bold text-primary tabular-nums">{formatBDT(grandTotal)}</span>
                </div>
                <div className="bg-muted/50 rounded-lg p-2.5 grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                  <div className="flex justify-between"><span className="text-muted-foreground">Items</span><span>{items?.length || 0}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Qty</span><span>{items?.reduce((s, i) => s + i.quantity, 0) || 0}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Source</span><span className="capitalize">{order.channel}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Order #</span><span>{order.order_number}</span></div>
                </div>
              </CardContent>
            </Card>

            {/* Address Fix button */}
            {currentStatus === "confirm" && order.courier_status === "ADDRESS_FIX_REQUIRED" && (
              <Card className="border-orange-200 bg-orange-50/50">
                <CardContent className="p-4">
                  <Button onClick={() => setAddressFixOpen(true)} className="w-full bg-orange-600 hover:bg-orange-700 text-white gap-2">
                    <MapPin className="w-4 h-4" /> Fix Address & Send to Pathao
                  </Button>
                  <p className="text-[10px] text-orange-600 text-center mt-2">Address mapping failed — manual selection needed</p>
                </CardContent>
              </Card>
            )}

            {/* Pathao tracking */}
            {order.pathao_consignment_id && (
              <PathaoTrackingCard
                consignmentId={order.pathao_consignment_id}
                trackingCode={order.pathao_tracking_code || undefined}
              />
            )}
          </div>
        </div>

        {/* ═══ REASON MODAL ═══ */}
        <Dialog open={reasonModal.open} onOpenChange={(open) => setReasonModal((prev) => ({ ...prev, open }))}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {reasonModal.type === "cancel" ? "❌ Cancel Order" : "⏸️ Put On Hold"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1.5 block">
                  Reason <span className="text-destructive">*</span>
                </label>
                <Select value={reasonValue} onValueChange={setReasonValue}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Select a reason..." /></SelectTrigger>
                  <SelectContent>
                    {(reasonModal.type === "cancel" ? CANCEL_REASONS : HOLD_REASONS).map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Additional Note (optional)</label>
                <Textarea value={reasonNote} onChange={(e) => setReasonNote(e.target.value)}
                  placeholder="Add more details..." rows={3} className="resize-none" />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setReasonModal({ open: false, type: "cancel" })}>Go Back</Button>
              <Button disabled={!reasonValue || statusMutation.isPending}
                variant={reasonModal.type === "cancel" ? "destructive" : "default"}
                onClick={() => {
                  statusMutation.mutate(
                    { newStatus: reasonModal.type, reason: reasonValue, note: reasonNote },
                    { onSuccess: () => { setReasonModal({ open: false, type: "cancel" }); setReasonValue(""); setReasonNote(""); } }
                  );
                }}>
                {statusMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> :
                  reasonModal.type === "cancel" ? "❌ Confirm Cancel" : "⏸️ Confirm Hold"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Address Fix Drawer */}
        <AddressFixDrawer
          open={addressFixOpen}
          onOpenChange={setAddressFixOpen}
          orderId={id || ""}
          orderNumber={order.order_number}
          fullAddress={order.delivery_address || customer?.address || ""}
          mappingResult={addressMappingResult}
          onAccept={handleAddressFixAccept}
          loading={addressFixSending}
        />
      </div>
    </TooltipProvider>
  );
}
