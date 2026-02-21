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
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { formatBDT, formatDateTime, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Phone, Send, Clock, MapPin,
  Package, CheckCircle2, RefreshCw, Loader2, Printer, Save, MoreHorizontal,
  Activity, CreditCard,
  PhoneOff, Pause, Wallet, XCircle, CircleCheck, Zap, Info, Globe, Truck, Calendar,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useAddressParser } from "@/hooks/use-address-parser";
import { useBDCourierSingle, getRiskLevel, getSuccessColor } from "@/hooks/use-bd-courier";
import { PathaoTrackingCard } from "@/components/pathao/PathaoTrackingCard";
import { AddressFixDrawer } from "@/components/orders/AddressFixDrawer";
import { mapAddressToPathao, type MappingResult } from "@/lib/address-mapper";
import { useCompanySettings } from "@/hooks/use-company-settings";
import { useInvoiceSettings } from "@/hooks/use-invoice-settings";
import { printInvoice } from "@/components/orders/PrintInvoice";

// Shared components
import { CustomerCard } from "@/components/order-detail/CustomerCard";
import { CourierHistoryCard } from "@/components/order-detail/CourierHistoryCard";
import { OrderItemsCard } from "@/components/order-detail/OrderItemsCard";
import { DeliveryPaymentCard } from "@/components/order-detail/DeliveryPaymentCard";

/* ─── STATUS CONFIG ─── */
const STATUS_BUTTONS = [
  { key: "processing", label: "Processing", icon: Clock, theme: "amber" },
  { key: "confirm", label: "Good", icon: CircleCheck, theme: "emerald" },
  { key: "good_but_no_response", label: "Good But No Response", icon: CheckCircle2, theme: "slate" },
  { key: "no_response", label: "No Response", icon: PhoneOff, theme: "slate" },
  { key: "on_hold", label: "On Hold", icon: Pause, theme: "yellow" },
  { key: "advance_payment", label: "Advance Payment", icon: Wallet, theme: "blue" },
] as const;

const themeMap: Record<string, { bg: string; border: string; ring: string; dot: string }> = {
  amber: { bg: "bg-amber-50", border: "border-amber-300", ring: "ring-amber-200", dot: "bg-amber-500" },
  emerald: { bg: "bg-emerald-50", border: "border-emerald-300", ring: "ring-emerald-200", dot: "bg-emerald-500" },
  slate: { bg: "bg-slate-100", border: "border-slate-300", ring: "ring-slate-200", dot: "bg-slate-500" },
  yellow: { bg: "bg-yellow-50", border: "border-yellow-300", ring: "ring-yellow-200", dot: "bg-yellow-500" },
  blue: { bg: "bg-blue-50", border: "border-blue-300", ring: "ring-blue-200", dot: "bg-blue-500" },
  red: { bg: "bg-red-50", border: "border-red-300", ring: "ring-red-200", dot: "bg-red-500" },
};

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
  const [orderItems, setOrderItems] = useState<any[]>([]);

  // Delivery form state
  const [deliveryForm, setDeliveryForm] = useState({
    city: "", zone: "", area: "", fullName: "", phone: "",
    address: "", note: "", advanceEnabled: false, advanceVia: "",
    advanceAmount: 0, advanceTxnId: "",
  });

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

  // Populate local state from fetched data
  useEffect(() => {
    if (items) setOrderItems(items);
  }, [items]);

  useEffect(() => {
    if (!order) return;
    const c = order.customers as any;
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

  const { data: bdReport, isLoading: bdLoading, refetch: refetchBD } = useBDCourierSingle(customerPhone, !!customer);
  const riskInfo = getRiskLevel(bdReport?.success_rate);
  const successRate = bdReport?.success_rate ?? 0;

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

    const orderItemsList = items || [];
    const totalWeight = orderItemsList.reduce((sum: number, i: any) => sum + ((i.products as any)?.weight_kg || 0) * i.quantity, 0);
    const weight = totalWeight > 0 ? Math.round(totalWeight * 10) / 10 : Number(defaultWeight);
    const isCOD = order.payment_method?.toLowerCase() === "cod" || order.payment_status !== "paid";
    const totalItems = orderItemsList.reduce((sum: number, i: any) => sum + i.quantity, 0) || 1;
    const desc = orderItemsList.map((i: any) => (i.products as any)?.name).filter(Boolean).join(", ") || "";

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

      const { data: confirmItems } = await supabase
        .from("order_items")
        .select("product_id, quantity, products(id, name, stock_quantity)")
        .eq("order_id", id!);

      if (confirmItems) {
        for (const item of confirmItems) {
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
        order_id: id, note_type: "status_change",
        content: "Status changed from processing to confirm",
        old_status: order.web_order_status || "processing",
        new_status: "confirm", created_by: "Staff",
      });

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

  /* ── Save mutation ── */
  const saveMutation = useMutation({
    mutationFn: async () => {
      const updates: any = {
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

      // Recalculate totals
      const subtotal = orderItems.reduce((s, i) => s + (i.unit_price * i.quantity), 0);
      const totalDisc = orderItems.reduce((s, i) => s + (i.discount || 0), 0) + (order?.discount || 0);
      const grand = subtotal - totalDisc + (order?.delivery_charge || 0);
      await supabase.from("orders").update({ subtotal, total_amount: grand }).eq("id", id!);
    },
    onSuccess: () => {
      toast({ title: "✅ Order saved successfully" });
      queryClient.invalidateQueries({ queryKey: ["web-order", id] });
      queryClient.invalidateQueries({ queryKey: ["web-order-items", id] });
      queryClient.invalidateQueries({ queryKey: ["web-order-notes", id] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handlePrintInvoice = useCallback(() => {
    if (!order) return;
    const orderWithItems = { ...order, order_items: items || [] };
    printInvoice(orderWithItems, company, invoiceSettings);
  }, [order, items, company, invoiceSettings]);

  const handleStatusAction = (key: string) => {
    if (key === "cancel" || key === "on_hold") {
      setReasonModal({ open: true, type: key as "cancel" | "on_hold" });
      setReasonValue("");
      setReasonNote("");
    } else if (key === "confirm") {
      setShowConfirmDialog(true);
    } else {
      statusMutation.mutate({ newStatus: key });
    }
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

  const currentStatus = order.web_order_status || "processing";
  const statusCfg = STATUS_LABELS[currentStatus] || { label: currentStatus, color: "bg-muted text-muted-foreground" };
  const callLogs = notes?.filter((n) => n.note_type === "call_log") || [];
  const srColor = successRate >= 80 ? "text-emerald-600" : successRate >= 50 ? "text-amber-600" : "text-red-600";

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6 animate-fade-in" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

        {/* ═══ STICKY HEADER ═══ */}
        <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl -mx-6 px-6 py-4 border-b border-border/50">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/web-orders")} className="shrink-0 rounded-xl">
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
                <p className="text-xs text-muted-foreground mt-0.5">{formatDateTime(order.created_at)}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9 rounded-xl" onClick={handlePrintInvoice}>
                <Printer className="w-3.5 h-3.5" /> Print Invoice
              </Button>
              <Button
                size="sm"
                className="gap-1.5 text-xs h-9 rounded-xl bg-[#6c63ff] hover:bg-[#5a52d5] text-white"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
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
            {/* Customer Card (shared component) */}
            <CustomerCard order={order} customer={customer} />

            {/* Courier History (shared component) */}
            <CourierHistoryCard phone={customerPhone} orderId={id!} />

            {/* Order Items (shared component) */}
            <OrderItemsCard items={orderItems} onItemsChange={setOrderItems} />

            {/* Delivery & Payment (shared component) */}
            <DeliveryPaymentCard
              order={order}
              items={orderItems}
              deliveryForm={deliveryForm}
              onFormChange={setDeliveryForm}
            />

            {/* Call Log (web-order-specific) */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Phone className="w-4 h-4 text-[#6c63ff]" /> Call Log
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
                    className="w-full text-xs gap-1.5 bg-[#6c63ff] hover:bg-[#5a52d5]" size="sm">
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

            {/* Delivery Notes (web-order-specific) */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#6c63ff]" /> Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
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
                  <Button onClick={() => noteMutation.mutate()} disabled={noteMutation.isPending} size="sm" className="gap-1.5 text-xs bg-[#6c63ff] hover:bg-[#5a52d5]">
                    <Send className="w-3 h-3" /> Save Note
                  </Button>
                )}
                {notes?.filter((n) => n.note_type === "note").slice(0, 3).map((note) => (
                  <div key={note.id} className="p-2.5 rounded-lg bg-muted/50 border border-border">
                    <p className="text-xs">{note.content}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{note.created_by} · {timeAgo(note.created_at)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Activity Log (web-order-specific, uses web_order_notes) */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#6c63ff]" /> Activity Log
                </CardTitle>
              </CardHeader>
              <CardContent>
                {notes && notes.length > 0 ? (
                  <div className="space-y-0">
                    {notes.map((note, i) => {
                      const isFirst = i === 0;
                      const isLast = i === notes.length - 1;
                      const dotColor = isFirst ? "bg-[#6c63ff]" : noteTypeDot(note.note_type);
                      return (
                        <div key={note.id} className="flex gap-3 relative">
                          <div className="flex flex-col items-center">
                            <div className={cn("w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 ring-2 ring-background", dotColor)} />
                            {!isLast && <div className="w-px flex-1 bg-border/50 mt-1" />}
                          </div>
                          <div className="pb-4 flex-1 min-w-0">
                            <p className="text-xs font-medium leading-relaxed">{note.content}</p>
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                              <span>{note.created_by || "System"}</span>
                              <span>·</span>
                              <span>{timeAgo(note.created_at)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
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

          {/* ════ RIGHT COLUMN (sticky) ════ */}
          <div className="space-y-5 lg:sticky lg:top-24 lg:self-start">

            {/* 1) ORDER STATUS (2×2 grid design) */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#6c63ff]" /> Order Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {STATUS_BUTTONS.map((s) => {
                    const isActive = currentStatus === s.key;
                    const t = themeMap[s.theme];
                    const isConfirm = s.key === "confirm";

                    if (isConfirm) {
                      return (
                        <AlertDialogRoot key={s.key} open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                          <ADTrigger asChild>
                            <button
                              disabled={isActive || statusMutation.isPending || confirmSending}
                              className={cn(
                                "relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-xs font-medium transition-all",
                                isActive
                                  ? `${t.bg} ${t.border} ring-2 ${t.ring}`
                                  : "border-border bg-background hover:border-muted-foreground/20 hover:bg-muted/30",
                                (isActive || statusMutation.isPending || confirmSending) && "opacity-50 cursor-not-allowed"
                              )}
                            >
                              {isActive && (
                                <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#6c63ff] flex items-center justify-center">
                                  <CheckCircle2 className="w-3 h-3 text-white" />
                                </div>
                              )}
                              <div className={cn("w-2.5 h-2.5 rounded-full", t.dot)} />
                              <s.icon className="w-4 h-4" />
                              <span className="text-center leading-tight">{s.label}</span>
                              {confirmSending && <Loader2 className="w-3 h-3 animate-spin" />}
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

                    return (
                      <button
                        key={s.key}
                        onClick={() => handleStatusAction(s.key)}
                        disabled={isActive || statusMutation.isPending}
                        className={cn(
                          "relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-xs font-medium transition-all",
                          isActive
                            ? `${t.bg} ${t.border} ring-2 ${t.ring}`
                            : "border-border bg-background hover:border-muted-foreground/20 hover:bg-muted/30",
                          (isActive || statusMutation.isPending) && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        {isActive && (
                          <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#6c63ff] flex items-center justify-center">
                            <CheckCircle2 className="w-3 h-3 text-white" />
                          </div>
                        )}
                        <div className={cn("w-2.5 h-2.5 rounded-full", t.dot)} />
                        <s.icon className="w-4 h-4" />
                        <span className="text-center leading-tight">{s.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Cancel button full width */}
                <button
                  onClick={() => handleStatusAction("cancel")}
                  disabled={currentStatus === "cancel" || statusMutation.isPending}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-all",
                    currentStatus === "cancel"
                      ? "bg-red-50 border-red-300 ring-2 ring-red-200 text-red-700 opacity-50 cursor-not-allowed"
                      : "border-border hover:border-red-200 hover:bg-red-50/50 text-red-600"
                  )}
                >
                  <XCircle className="w-4 h-4" />
                  🚫 Cancel Order
                </button>

                {/* Save button */}
                <Button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                  className="w-full h-11 rounded-xl bg-gradient-to-r from-[#6c63ff] to-[#5a52d5] hover:from-[#5a52d5] hover:to-[#4a42c5] text-white font-semibold shadow-lg shadow-[#6c63ff]/20 hover:shadow-xl hover:shadow-[#6c63ff]/30 transition-all hover:-translate-y-0.5"
                >
                  <Save className="w-4 h-4 mr-2" /> Save Order
                </Button>
              </CardContent>
            </Card>

            {/* 2) ORDER INFO */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Info className="w-4 h-4 text-[#6c63ff]" /> Order Info
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Globe className="w-3 h-3" />
                      <span className="text-[10px] uppercase tracking-wide">Source</span>
                    </div>
                    <Badge variant="outline" className="text-xs capitalize">{order.channel || "Manual"}</Badge>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Truck className="w-3 h-3" />
                      <span className="text-[10px] uppercase tracking-wide">Courier</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {order.pathao_consignment_id ? "Pathao" : "—"}
                    </Badge>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      <span className="text-[10px] uppercase tracking-wide">Created</span>
                    </div>
                    <span className="text-xs font-medium">{formatDate(order.created_at)}</span>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Success Rate</span>
                      <span className={cn("text-xs font-bold", srColor)}>{successRate}%</span>
                    </div>
                    <Progress value={successRate} className="h-1.5" />
                  </div>
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
          <DialogContent className="max-w-md rounded-2xl">
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
