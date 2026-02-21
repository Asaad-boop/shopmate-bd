import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
} from "@/components/ui/alert-dialog";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { formatBDT, formatDateTime, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Phone, MessageCircle, Copy, Send, Clock, MapPin,
  Package, Search, Plus, Minus, X, CheckCircle2, Pencil, RefreshCw, Loader2, Printer, Save,
  Activity, CreditCard, FileText,
  PhoneOff, Pause, Wallet, XCircle, CircleCheck, Zap, Info, Globe, Truck, Calendar,
  ShoppingBag, TrendingUp, User,
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

/* ─── STATUS CONFIG ─── */
const STATUS_BUTTONS = [
  { key: "processing", label: "Processing", icon: Clock, theme: "amber" },
  { key: "confirm", label: "Good", icon: CircleCheck, theme: "emerald" },
  { key: "good_but_no_response", label: "Good No Resp", icon: CheckCircle2, theme: "slate" },
  { key: "no_response", label: "No Response", icon: PhoneOff, theme: "slate" },
  { key: "on_hold", label: "On Hold", icon: Pause, theme: "yellow" },
  { key: "advance_payment", label: "Advance", icon: Wallet, theme: "blue" },
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
  processing: { label: "PROCESSING", color: "bg-amber-100 text-amber-800 border border-amber-300" },
  confirm: { label: "CONFIRMED", color: "bg-emerald-100 text-emerald-800 border border-emerald-300" },
  good_but_no_response: { label: "GOOD NO RESP", color: "bg-sky-100 text-sky-800 border border-sky-300" },
  no_response: { label: "NO RESPONSE", color: "bg-rose-100 text-rose-800 border border-rose-300" },
  on_hold: { label: "ON HOLD", color: "bg-indigo-100 text-indigo-800 border border-indigo-300" },
  advance_payment: { label: "ADVANCE", color: "bg-orange-100 text-orange-800 border border-orange-300" },
  cancel: { label: "CANCELLED", color: "bg-red-100 text-red-800 border border-red-300" },
};

const CALL_OPTIONS = [
  { key: "answered", label: "Answered", icon: "✅", bg: "bg-emerald-50 hover:bg-emerald-100 border-emerald-200", iconBg: "bg-emerald-500", active: "bg-emerald-100 border-emerald-400 ring-2 ring-emerald-300" },
  { key: "no_answer", label: "No Answer", icon: "📵", bg: "bg-orange-50 hover:bg-orange-100 border-orange-200", iconBg: "bg-orange-500", active: "bg-orange-100 border-orange-400 ring-2 ring-orange-300" },
  { key: "busy", label: "Busy", icon: "🔴", bg: "bg-rose-50 hover:bg-rose-100 border-rose-200", iconBg: "bg-rose-500", active: "bg-rose-100 border-rose-400 ring-2 ring-rose-300" },
  { key: "voicemail", label: "Voicemail", icon: "📤", bg: "bg-blue-50 hover:bg-blue-100 border-blue-200", iconBg: "bg-blue-500", active: "bg-blue-100 border-blue-400 ring-2 ring-blue-300" },
];

const QUICK_NOTES = ["Call before delivery", "Fragile", "Gift wrap", "Deliver after 5 PM"];
const PAYMENT_METHODS = ["bKash", "Nagad", "Bank", "Cash"] as const;
const FILTER_PILLS = ["All Active", "Best Sellers", "New Arrivals", "On Sale"] as const;

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
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const formatTime = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
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

  // Product search
  const [nameSearch, setNameSearch] = useState("");
  const [skuSearch, setSkuSearch] = useState("");
  const [activePill, setActivePill] = useState<string>("All Active");
  const [editModal, setEditModal] = useState<{ open: boolean; item: any }>({ open: false, item: null });
  const [editForm, setEditForm] = useState({ name: "", sku: "", price: 0, qty: 1, note: "" });

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
        .select("*, customers(id, full_name, phone, phone2, address, district, thana, segment, total_orders, total_spent, email, created_at)")
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

  // Products search
  const { data: products } = useQuery({
    queryKey: ["products-for-order", nameSearch, skuSearch],
    queryFn: async () => {
      let q = supabase.from("products").select("id, name, sku, selling_price, image_url, status, stock_quantity")
        .eq("status", "active").order("name").limit(20);
      if (nameSearch) q = q.ilike("name", `%${nameSearch}%`);
      if (skuSearch) q = q.ilike("sku", `%${skuSearch}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: nameSearch.length > 0 || skuSearch.length > 0,
  });

  // Previous orders
  const customer = order?.customers as any;
  const customerPhone = customer?.phone || "";

  const { data: prevOrders } = useQuery({
    queryKey: ["customer-prev-orders-web", customerPhone],
    queryFn: async () => {
      if (!customerPhone) return [];
      const { data: cust } = await supabase.from("customers").select("id").eq("phone", customerPhone).maybeSingle();
      if (!cust) return [];
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, status, total_amount, created_at, channel, order_items(quantity, products(name))")
        .eq("customer_id", cust.id)
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data || [];
    },
    enabled: !!customerPhone,
  });

  const { data: bdReport } = useBDCourierSingle(customerPhone, !!customer);
  const successRate = bdReport?.success_rate ?? 0;

  // Populate local state
  useEffect(() => { if (items) setOrderItems(items); }, [items]);

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

  /* ── Computed values ── */
  const subtotal = orderItems.reduce((s, i) => s + (i.unit_price * i.quantity), 0);
  const totalDiscount = orderItems.reduce((s, i) => s + (i.discount || 0), 0) + (order?.discount || 0);
  const deliveryCharge = order?.delivery_charge || 0;
  const advancePaid = deliveryForm.advanceEnabled ? deliveryForm.advanceAmount : 0;
  const grandTotal = subtotal - totalDiscount + deliveryCharge;
  const codAmount = grandTotal - advancePaid;
  const selectedProductIds = useMemo(() => new Set(orderItems.map(i => i.product_id)), [orderItems]);

  const isReturning = (prevOrders?.length || 0) > 1;
  const totalOrders = customer?.total_orders || prevOrders?.length || 0;
  const totalSpent = customer?.total_spent || 0;

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
      toast({ title: "Pathao store not set", description: "Settings → Pathao → Default Store", variant: "destructive" });
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
        store_id: Number(storeId), merchant_order_id: order.order_number,
        recipient_name: customer.full_name, recipient_phone: normalizePhone(customer.phone),
        recipient_address: order.delivery_address || customer.address || "",
        recipient_city: cityId, recipient_zone: zoneId,
        delivery_type: Number(deliveryType), item_type: 2, special_instruction: "",
        item_quantity: totalItems, item_weight: weight,
        amount_to_collect: isCOD ? Number(order.total_amount || 0) : 0, item_description: desc,
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
        pathao_consignment_id: String(consignmentId), pathao_tracking_code: trackingCode,
        courier_status: "Pending", delivery_district: cityName, delivery_thana: zoneName,
        updated_at: new Date().toISOString(),
      }).eq("id", id!);
      await supabase.from("web_order_notes").insert({
        order_id: id, note_type: "activity",
        content: `Sent to Pathao • consignmentId=${consignmentId}`, created_by: "Staff",
      });
      toast({ title: "✅ Sent to Pathao!", description: `Consignment: ${consignmentId}` });
    } else {
      await supabase.from("orders").update({ courier_status: "Processing", updated_at: new Date().toISOString() }).eq("id", id!);
      toast({ title: "✅ Sent to Pathao!", description: result?.message || "Processing..." });
    }
  };

  /* ── CONFIRM with auto-mapping ── */
  const handleConfirmWithMapping = async () => {
    if (!order || !customer) return;
    setConfirmSending(true);
    try {
      await supabase.from("orders")
        .update({ web_order_status: "confirm", status: "pending", updated_at: new Date().toISOString() })
        .eq("id", id!);
      const { data: confirmItems } = await supabase.from("order_items")
        .select("product_id, quantity, products(id, name, stock_quantity)").eq("order_id", id!);
      if (confirmItems) {
        for (const item of confirmItems) {
          const product = item.products as any;
          if (!product?.id) continue;
          await supabase.from("products").update({
            stock_quantity: (product.stock_quantity || 0) - item.quantity, updated_at: new Date().toISOString(),
          }).eq("id", product.id);
          await supabase.from("inventory_movements").insert({
            product_id: product.id, movement_type: "order_pending", quantity: -item.quantity,
            reference_type: "order", reference_id: id, notes: "Web order confirmed → pending (stock decreased)",
          });
        }
      }
      await supabase.from("web_order_notes").insert({
        order_id: id, note_type: "status_change",
        content: "Order confirmed and moved to Orders list",
        old_status: order.web_order_status || "processing", new_status: "confirm", created_by: "Staff",
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
        if (fullMapping.success && fullMapping.cityId && fullMapping.zoneId) {
          try {
            await sendToPathao(fullMapping.cityId, fullMapping.cityName, fullMapping.zoneId, fullMapping.zoneName);
          } catch (pathaoErr: any) {
            toast({ title: "Order confirmed but Pathao send failed", description: pathaoErr.message, variant: "destructive" });
            await supabase.from("orders").update({ courier_status: "PATHAO_FAILED" }).eq("id", id!);
          }
        } else {
          setAddressMappingResult(fullMapping);
          await supabase.from("orders").update({ courier_status: "ADDRESS_FIX_REQUIRED" }).eq("id", id!);
          toast({ title: "📍 Address fix required" });
          setAddressFixOpen(true);
        }
      } else {
        setAddressMappingResult(mappingResult);
        await supabase.from("orders").update({ courier_status: "ADDRESS_FIX_REQUIRED" }).eq("id", id!);
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
        content: `Call — ${callResult}`, call_result: callResult, created_by: "Staff",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setCallResult("");
      toast({ title: "Call logged ✅" });
      queryClient.invalidateQueries({ queryKey: ["web-order-notes", id] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  /* ── Save mutation ── */
  const saveMutation = useMutation({
    mutationFn: async () => {
      const updates: any = {
        delivery_district: deliveryForm.city, delivery_thana: deliveryForm.zone,
        delivery_address: deliveryForm.address, notes: deliveryForm.note,
        updated_at: new Date().toISOString(),
      };
      if (deliveryForm.advanceEnabled && deliveryForm.advanceAmount > 0) {
        updates.payment_method = deliveryForm.advanceVia || "cash";
        updates.cod_amount = grandTotal - deliveryForm.advanceAmount;
      }
      const { error } = await supabase.from("orders").update(updates).eq("id", id!);
      if (error) throw error;
      await supabase.from("order_items").delete().eq("order_id", id!);
      if (orderItems.length > 0) {
        const inserts = orderItems.map(i => ({
          order_id: id, product_id: i.product_id, quantity: i.quantity,
          unit_price: i.unit_price, discount: i.discount || 0, total_price: i.total_price,
          product_name_fallback: i.product_name_fallback || (i.products as any)?.name || null,
        }));
        const { error: itemsErr } = await supabase.from("order_items").insert(inserts);
        if (itemsErr) throw itemsErr;
      }
      await supabase.from("orders").update({ subtotal, total_amount: grandTotal }).eq("id", id!);
    },
    onSuccess: () => {
      toast({ title: "✅ Order saved" });
      queryClient.invalidateQueries({ queryKey: ["web-order", id] });
      queryClient.invalidateQueries({ queryKey: ["web-order-items", id] });
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
      setReasonValue(""); setReasonNote("");
    } else if (key === "confirm") {
      setShowConfirmDialog(true);
    } else {
      statusMutation.mutate({ newStatus: key });
    }
  };

  // Product helpers
  const toggleProduct = (product: any) => {
    if (selectedProductIds.has(product.id)) {
      setOrderItems(orderItems.filter(i => i.product_id !== product.id));
    } else {
      setOrderItems([...orderItems, {
        id: `temp-${Date.now()}`, product_id: product.id, quantity: 1,
        unit_price: product.selling_price || 0, discount: 0, total_price: product.selling_price || 0,
        product_name_fallback: product.name,
        products: { name: product.name, sku: product.sku, image_url: product.image_url },
      }]);
    }
  };
  const updateQty = (itemId: string, delta: number) => {
    setOrderItems(orderItems.map(i => {
      if (i.id !== itemId) return i;
      const newQty = Math.max(1, i.quantity + delta);
      return { ...i, quantity: newQty, total_price: (i.unit_price * newQty) - (i.discount || 0) };
    }));
  };
  const updateDiscount = (itemId: string, disc: number) => {
    setOrderItems(orderItems.map(i => {
      if (i.id !== itemId) return i;
      return { ...i, discount: disc, total_price: (i.unit_price * i.quantity) - disc };
    }));
  };
  const openEditModal = (item: any) => {
    const p = item.products as any;
    setEditForm({ name: p?.name || item.product_name_fallback || "", sku: p?.sku || "", price: item.unit_price, qty: item.quantity, note: "" });
    setEditModal({ open: true, item });
  };
  const saveEdit = () => {
    if (!editModal.item) return;
    setOrderItems(orderItems.map(i => {
      if (i.id !== editModal.item!.id) return i;
      return { ...i, unit_price: editForm.price, quantity: editForm.qty, total_price: (editForm.price * editForm.qty) - (i.discount || 0), product_name_fallback: editForm.name };
    }));
    setEditModal({ open: false, item: null });
  };

  const copyPhone = () => { navigator.clipboard.writeText(customerPhone); toast({ title: "Phone copied!" }); };
  const statusColor = (status: string) => {
    if (status === "delivered") return "bg-emerald-100 text-emerald-700";
    if (status === "cancelled" || status === "cancel") return "bg-red-100 text-red-700";
    return "bg-amber-100 text-amber-700";
  };

  /* ── Loading ── */
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <Loader2 className="w-8 h-8 animate-spin text-[#6c63ff]" />
      </div>
    );
  }
  if (!order) return <div className="text-center py-12 text-muted-foreground">Order not found</div>;

  const currentStatus = order.web_order_status || "processing";
  const statusCfg = STATUS_LABELS[currentStatus] || { label: currentStatus.toUpperCase(), color: "bg-muted text-muted-foreground" };
  const callLogs = notes?.filter((n) => n.note_type === "call_log") || [];
  const srColor = successRate >= 80 ? "text-emerald-600" : successRate >= 50 ? "text-amber-600" : "text-red-600";
  const totalItemCount = orderItems.reduce((s, i) => s + i.quantity, 0);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col h-screen overflow-hidden" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

        {/* ═══ STICKY HEADER (48px) ═══ */}
        <div className="h-12 shrink-0 bg-background/80 backdrop-blur-xl border-b border-border/50 flex items-center justify-between px-4 z-30">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/web-orders")} className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Web Orders
            </Button>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold">#{order.order_number}</h1>
              <Badge className={cn("text-[10px] px-2 py-0.5 font-semibold", statusCfg.color)}>{statusCfg.label}</Badge>
            </div>
            <span className="text-xs text-muted-foreground">{formatDateTime(order.created_at)}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1 rounded-lg" onClick={handlePrintInvoice}>
              <Printer className="w-3 h-3" /> Print
            </Button>
            <Button size="sm" className="h-7 text-xs gap-1 rounded-lg bg-[#6c63ff] hover:bg-[#5a52d5] text-white"
              onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              <Save className="w-3 h-3" /> Save
            </Button>
          </div>
        </div>

        {/* ═══ 3-COLUMN MAIN ═══ */}
        <div className="flex-1 min-h-0 flex">

          {/* ════ COL 1 ════ */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 border-r border-border/30">

            {/* CUSTOMER INFORMATION */}
            <Card>
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-[#6c63ff]" /> CUSTOMER INFORMATION
                  </CardTitle>
                  {isReturning ? (
                    <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] gap-1">✓ Returning</Badge>
                  ) : (
                    <Badge className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px]">New Customer</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                {/* Phone row */}
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold font-mono tracking-wide">{customerPhone ? `+${customerPhone}` : "—"}</span>
                  <div className="flex gap-1 ml-auto">
                    <button onClick={() => window.open(`tel:${customerPhone}`, "_self")}
                      className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center hover:bg-sky-100 transition-colors">
                      <Phone className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => window.open(`https://wa.me/88${customerPhone.replace(/^0/, "")}`, "_blank")}
                      className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-100 transition-colors">
                      <MessageCircle className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={copyPhone}
                      className="w-7 h-7 rounded-lg bg-muted text-muted-foreground flex items-center justify-center hover:bg-muted/80 transition-colors">
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                {/* Name + address */}
                <div>
                  <p className="font-semibold text-sm">{customer?.full_name || "Unknown"}</p>
                  {(order.delivery_address || customer?.address) && (
                    <p className="text-xs text-muted-foreground flex items-start gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 mt-0.5 shrink-0 text-red-400" />
                      {order.delivery_address || customer?.address}
                    </p>
                  )}
                </div>
                {/* Badges */}
                {isReturning && (
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">✓ Returning</Badge>
                    <Badge variant="outline" className="text-[10px] bg-[#6c63ff]/5 text-[#6c63ff] border-[#6c63ff]/20 gap-1">
                      <ShoppingBag className="w-3 h-3" /> {totalOrders} Orders
                    </Badge>
                    <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
                      <TrendingUp className="w-3 h-3" /> {formatBDT(totalSpent)} spent
                    </Badge>
                  </div>
                )}

                {/* Previous Orders */}
                {prevOrders && prevOrders.length > 0 && (
                  <div className="border-t border-border pt-3 space-y-1.5">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">PREVIOUS ORDERS</p>
                    {prevOrders.filter(o => o.id !== order.id).slice(0, 4).map((o) => {
                      const oItems = (o as any).order_items || [];
                      const firstName = oItems[0]?.products?.name || "Product";
                      const totalQty = oItems.reduce((s: number, i: any) => s + (i.quantity || 0), 0);
                      return (
                        <div key={o.id} onClick={() => navigate(`/web-orders/${o.id}`)}
                          className="flex items-center justify-between text-xs p-2 rounded-lg border border-border/50 hover:bg-muted/50 cursor-pointer transition-colors">
                          <div className="flex-1 min-w-0">
                            <span className="font-bold text-[#6c63ff]">#{o.order_number}</span>
                            <span className="text-muted-foreground ml-2 text-[11px]">
                              {firstName} × {totalQty} · {formatBDT(o.total_amount)} · {o.channel}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <Badge className={cn("text-[9px] px-1.5 py-0", statusColor(o.status || ""))}>{o.status}</Badge>
                            <span className="text-[10px] text-muted-foreground">{formatDate(o.created_at)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ORDER ITEMS */}
            <Card>
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Package className="w-3.5 h-3.5 text-[#6c63ff]" /> 🛍️ ORDER ITEMS
                  </CardTitle>
                  <span className="text-xs text-muted-foreground">{orderItems.length} selected</span>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                {/* Search */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="Search by name..." value={nameSearch} onChange={(e) => setNameSearch(e.target.value)}
                      className="pl-8 h-8 text-xs" />
                  </div>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="Search by SKU..." value={skuSearch} onChange={(e) => setSkuSearch(e.target.value)}
                      className="pl-8 h-8 text-xs" />
                  </div>
                </div>
                {/* Filter pills */}
                <div className="flex gap-1.5 flex-wrap">
                  {FILTER_PILLS.map((pill) => (
                    <button key={pill} onClick={() => setActivePill(pill)}
                      className={cn("px-2.5 py-1 rounded-full text-[10px] font-medium transition-all border",
                        activePill === pill ? "bg-[#6c63ff] text-white border-[#6c63ff]" : "bg-background text-muted-foreground border-border hover:border-[#6c63ff]/30")}>
                      {pill}
                    </button>
                  ))}
                </div>
                {/* Product grid */}
                {(nameSearch || skuSearch) && products && products.length > 0 && (
                  <div className="grid grid-cols-4 gap-2">
                    {products.map((p) => {
                      const isSelected = selectedProductIds.has(p.id);
                      return (
                        <div key={p.id} onClick={() => toggleProduct(p)}
                          className={cn("relative rounded-xl border p-2 cursor-pointer transition-all hover:shadow-md",
                            isSelected ? "border-[#6c63ff] bg-[#6c63ff]/5 ring-1 ring-[#6c63ff]/20" : "border-border hover:border-[#6c63ff]/30")}>
                          {isSelected && (
                            <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#6c63ff] flex items-center justify-center">
                              <CheckCircle2 className="w-3 h-3 text-white" />
                            </div>
                          )}
                          <div className="w-full aspect-square rounded-lg overflow-hidden bg-muted mb-1.5">
                            {p.image_url ? (
                              <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-2xl">{p.name?.[0]?.toUpperCase()}</div>
                            )}
                          </div>
                          <p className="text-[11px] font-medium truncate">{p.name}</p>
                          <p className="text-[9px] text-muted-foreground">{p.sku}</p>
                          <p className="text-[11px] font-bold text-[#6c63ff] mt-0.5">{formatBDT(p.selling_price)}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
                {/* Selected items table */}
                {orderItems.length > 0 && (
                  <div className="border border-border rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/50 text-muted-foreground text-[10px]">
                          <th className="text-left p-2 font-medium">Product</th>
                          <th className="text-center p-2 font-medium">Price</th>
                          <th className="text-center p-2 font-medium">Qty</th>
                          <th className="text-center p-2 font-medium">Disc</th>
                          <th className="text-right p-2 font-medium">Total</th>
                          <th className="text-center p-2 font-medium w-14"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {orderItems.map((item) => {
                          const p = item.products as any;
                          const pName = p?.name || item.product_name_fallback || "Product";
                          return (
                            <tr key={item.id} className="border-t border-border/50 hover:bg-muted/30">
                              <td className="p-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-md overflow-hidden shrink-0 border border-border">
                                    {p?.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-cover" /> :
                                      <div className="w-full h-full bg-[#6c63ff]/10 flex items-center justify-center text-[9px] font-bold text-[#6c63ff]">{pName[0]}</div>}
                                  </div>
                                  <div><p className="font-medium text-[11px] truncate max-w-[120px]">{pName}</p><p className="text-[9px] text-muted-foreground">{p?.sku || "—"}</p></div>
                                </div>
                              </td>
                              <td className="p-2 text-center">{formatBDT(item.unit_price)}</td>
                              <td className="p-2">
                                <div className="flex items-center justify-center gap-0.5">
                                  <button onClick={() => updateQty(item.id, -1)} className="w-5 h-5 rounded bg-muted flex items-center justify-center hover:bg-muted-foreground/10"><Minus className="w-2.5 h-2.5" /></button>
                                  <span className="w-6 text-center text-[11px] font-medium">{item.quantity}</span>
                                  <button onClick={() => updateQty(item.id, 1)} className="w-5 h-5 rounded bg-muted flex items-center justify-center hover:bg-muted-foreground/10"><Plus className="w-2.5 h-2.5" /></button>
                                </div>
                              </td>
                              <td className="p-2">
                                <Input type="number" value={item.discount || 0} onChange={(e) => updateDiscount(item.id, Number(e.target.value) || 0)}
                                  className="h-6 w-12 text-center text-[10px] mx-auto" />
                              </td>
                              <td className="p-2 text-right font-semibold">{formatBDT(item.total_price)}</td>
                              <td className="p-2">
                                <div className="flex items-center justify-center gap-0.5">
                                  <button onClick={() => openEditModal(item)} className="w-5 h-5 rounded hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-[#6c63ff]"><Pencil className="w-2.5 h-2.5" /></button>
                                  <button onClick={() => setOrderItems(orderItems.filter(i => i.id !== item.id))} className="w-5 h-5 rounded hover:bg-red-50 flex items-center justify-center text-muted-foreground hover:text-red-600"><X className="w-2.5 h-2.5" /></button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ════ COL 2 ════ */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 border-r border-border/30">

            {/* DELIVERY & PAYMENT */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CreditCard className="w-3.5 h-3.5 text-[#6c63ff]" /> 🚚 DELIVERY & PAYMENT
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-4">
                {/* Chips */}
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="outline" className="text-[10px] capitalize gap-1">🛒 {order.channel || "Manual"}</Badge>
                  <Badge variant="outline" className="text-[10px] gap-1">🚚 Pathao</Badge>
                  <Badge className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 gap-1">💰 {order.payment_method || "COD"}</Badge>
                </div>
                {/* Location */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground uppercase">City</Label>
                    <Select value={deliveryForm.city} onValueChange={(v) => setDeliveryForm(f => ({ ...f, city: v }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="City" /></SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        <SelectItem value={deliveryForm.city || "Dhaka"}>{deliveryForm.city || "Dhaka"}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground uppercase">Zone</Label>
                    <Select value={deliveryForm.zone} onValueChange={(v) => setDeliveryForm(f => ({ ...f, zone: v }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Zone" /></SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        <SelectItem value={deliveryForm.zone || "-"}>{deliveryForm.zone || "-"}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground uppercase">Area</Label>
                    <Select value={deliveryForm.area || "default"} onValueChange={(v) => setDeliveryForm(f => ({ ...f, area: v }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Area" /></SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        <SelectItem value={deliveryForm.area || "default"}>{deliveryForm.area || "—"}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {/* Customer fields */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground uppercase">Full Name</Label>
                    <Input value={deliveryForm.fullName} onChange={(e) => setDeliveryForm(f => ({ ...f, fullName: e.target.value }))} className="h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground uppercase">Phone</Label>
                    <Input value={deliveryForm.phone} onChange={(e) => setDeliveryForm(f => ({ ...f, phone: e.target.value }))} className="h-8 text-xs" />
                  </div>
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground uppercase">Address</Label>
                  <Input value={deliveryForm.address} onChange={(e) => setDeliveryForm(f => ({ ...f, address: e.target.value }))} className="h-8 text-xs" />
                </div>
                {/* Advance Payment */}
                <div className="flex items-center gap-3 py-1">
                  <Switch checked={deliveryForm.advanceEnabled} onCheckedChange={(c) => setDeliveryForm(f => ({ ...f, advanceEnabled: c }))} />
                  <div>
                    <p className="text-xs font-semibold flex items-center gap-1">💰 Advance Payment</p>
                    <p className="text-[10px] text-muted-foreground">Customer paid in advance</p>
                  </div>
                </div>
                {deliveryForm.advanceEnabled && (
                  <div className="space-y-2 bg-muted/50 rounded-lg p-3 border border-border/50 animate-fade-in">
                    <div className="flex gap-1.5 flex-wrap">
                      {PAYMENT_METHODS.map((m) => (
                        <button key={m} onClick={() => setDeliveryForm(f => ({ ...f, advanceVia: m }))}
                          className={cn("px-2.5 py-1 rounded-full text-[10px] font-medium border transition-all",
                            deliveryForm.advanceVia === m ? "bg-[#6c63ff] text-white border-[#6c63ff]" : "bg-background text-foreground border-border")}>
                          {m}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px]">Amount (৳)</Label>
                        <Input type="number" value={deliveryForm.advanceAmount}
                          onChange={(e) => setDeliveryForm(f => ({ ...f, advanceAmount: Number(e.target.value) || 0 }))} className="h-8 text-xs" />
                      </div>
                      <div>
                        <Label className="text-[10px]">Transaction ID</Label>
                        <Input value={deliveryForm.advanceTxnId} onChange={(e) => setDeliveryForm(f => ({ ...f, advanceTxnId: e.target.value }))} className="h-8 text-xs" placeholder="Optional" />
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* CALL LOG */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-[#6c63ff]" /> 📞 CALL LOG
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                <div className="grid grid-cols-4 gap-2">
                  {CALL_OPTIONS.map((opt) => (
                    <button key={opt.key} onClick={() => { setCallResult(opt.key); callLogMutation.mutate(); }}
                      className={cn("flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-semibold transition-all",
                        callResult === opt.key ? opt.active : opt.bg)}>
                      <span className="text-xl">{opt.icon}</span>
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* NOTE */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-[#6c63ff]" /> ✏️ NOTE
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                <Textarea value={newNote} onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a note about this order..." rows={2} className="text-xs resize-none" />
                <div className="flex flex-wrap gap-1">
                  {QUICK_NOTES.map((chip) => (
                    <button key={chip} onClick={() => setNewNote((prev) => prev ? `${prev}, ${chip}` : chip)}
                      className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted hover:bg-muted/80 text-muted-foreground border border-border transition-all">
                      {chip}
                    </button>
                  ))}
                </div>
                {newNote.trim() && (
                  <Button onClick={() => noteMutation.mutate()} disabled={noteMutation.isPending} size="sm"
                    className="text-xs gap-1 bg-[#6c63ff] hover:bg-[#5a52d5] h-7">
                    <Send className="w-3 h-3" /> Save Note
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* ORDER SUMMARY */}
            <div className="rounded-xl bg-gradient-to-br from-[#6c63ff]/10 via-[#6c63ff]/5 to-transparent p-4 space-y-2 border border-[#6c63ff]/10">
              <p className="text-xs font-semibold text-[#6c63ff] uppercase tracking-wide flex items-center gap-1">🧾 ORDER SUMMARY</p>
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">Subtotal</span><span>{formatBDT(subtotal)}</span></div>
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">Discount</span><span className="text-red-500">-{formatBDT(totalDiscount)}</span></div>
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">Delivery Charge</span><span>{formatBDT(deliveryCharge)}</span></div>
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">Advance Paid</span><span className="text-emerald-600">{formatBDT(advancePaid)}</span></div>
              <div className="border-t border-[#6c63ff]/10 pt-2 flex justify-between items-center">
                <span className="text-sm font-bold text-[#6c63ff]">Grand Total</span>
                <span className="text-lg font-bold text-[#6c63ff]">{formatBDT(grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* ════ COL 3 (260px) ════ */}
          <div className="w-[260px] shrink-0 overflow-y-auto p-4 space-y-4">

            {/* ORDER STATUS */}
            <Card>
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-[#6c63ff]" /> ORDER STATUS
                  </CardTitle>
                  <span className="text-[10px] text-[#6c63ff] font-medium capitalize">{currentStatus}</span>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {STATUS_BUTTONS.map((s) => {
                    const isActive = currentStatus === s.key;
                    const t = themeMap[s.theme];
                    return (
                      <button key={s.key} onClick={() => handleStatusAction(s.key)}
                        disabled={isActive || statusMutation.isPending}
                        className={cn("relative flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 text-[10px] font-medium transition-all",
                          isActive ? `${t.bg} ${t.border} ring-2 ${t.ring}` : "border-border bg-background hover:border-muted-foreground/20 hover:bg-muted/30",
                          (isActive || statusMutation.isPending) && "opacity-60 cursor-not-allowed")}>
                        {isActive && (
                          <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-[#6c63ff] flex items-center justify-center">
                            <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                          </div>
                        )}
                        <s.icon className="w-4 h-4" />
                        <span className="text-center leading-tight">{s.label}</span>
                      </button>
                    );
                  })}
                </div>
                {/* Cancel */}
                <button onClick={() => handleStatusAction("cancel")}
                  disabled={currentStatus === "cancel" || statusMutation.isPending}
                  className={cn("w-full flex items-center justify-center gap-1.5 p-2.5 rounded-xl border-2 text-xs font-medium transition-all",
                    currentStatus === "cancel" ? "bg-red-50 border-red-300 text-red-700 opacity-50" : "border-border hover:border-red-200 hover:bg-red-50/50 text-red-600")}>
                  <XCircle className="w-3.5 h-3.5" /> Cancel Order
                </button>
                {/* Save */}
                <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
                  className="w-full h-9 rounded-xl bg-gradient-to-r from-[#6c63ff] to-[#5a52d5] hover:from-[#5a52d5] hover:to-[#4a42c5] text-white font-semibold text-xs shadow-lg shadow-[#6c63ff]/20">
                  <Save className="w-3.5 h-3.5 mr-1" /> Save Order
                </Button>
              </CardContent>
            </Card>

            {/* ORDER INFO */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Info className="w-3.5 h-3.5 text-[#6c63ff]" /> ORDER INFO
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Source</p>
                    <Badge variant="outline" className="text-[10px] capitalize mt-0.5">🛒 {order.channel || "Manual"}</Badge>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Courier</p>
                    <Badge variant="outline" className="text-[10px] mt-0.5">🚚 {order.pathao_consignment_id ? "Pathao" : "—"}</Badge>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Created</p>
                    <p className="text-xs font-medium mt-0.5">{formatDate(order.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Success Rate</p>
                    <p className={cn("text-xs font-bold mt-0.5", srColor)}>{successRate}% ✓</p>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase mb-1">Order History</p>
                  <div className="flex items-center gap-2">
                    <Progress value={successRate} className="h-1.5 flex-1" />
                    <span className={cn("text-[10px] font-bold", srColor)}>{bdReport?.successful_orders || 0}/{bdReport?.total_orders || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ACTIVITY LOG */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-[#6c63ff]" /> ACTIVITY LOG
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {notes && notes.length > 0 ? (
                  <div className="space-y-0">
                    {notes.slice(0, 10).map((note, i) => {
                      const isFirst = i === 0;
                      const isLast = i === Math.min(notes.length, 10) - 1;
                      const dotColor = isFirst ? "bg-[#6c63ff]" : noteTypeDot(note.note_type);
                      return (
                        <div key={note.id} className="flex gap-2.5 relative">
                          <div className="flex flex-col items-center">
                            <div className={cn("w-2 h-2 rounded-full shrink-0 mt-1.5 ring-2 ring-background", dotColor)} />
                            {!isLast && <div className="w-px flex-1 bg-border/50 mt-0.5" />}
                          </div>
                          <div className="pb-3 flex-1 min-w-0">
                            <p className="text-[11px] font-medium leading-relaxed">{note.content}</p>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[9px] text-muted-foreground">
                              <span>{note.created_by || "System"}</span>
                              <span>·</span>
                              <span>{formatTime(note.created_at)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <Clock className="w-5 h-5 mx-auto text-muted-foreground/30 mb-1" />
                    <p className="text-[10px] text-muted-foreground">No activity yet</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pathao tracking */}
            {order.pathao_consignment_id && (
              <PathaoTrackingCard consignmentId={order.pathao_consignment_id} trackingCode={order.pathao_tracking_code || undefined} />
            )}

            {/* Address Fix button */}
            {currentStatus === "confirm" && order.courier_status === "ADDRESS_FIX_REQUIRED" && (
              <Card className="border-orange-200 bg-orange-50/50">
                <CardContent className="p-3">
                  <Button onClick={() => setAddressFixOpen(true)} className="w-full bg-orange-600 hover:bg-orange-700 text-white gap-1 text-xs h-8">
                    <MapPin className="w-3 h-3" /> Fix Address
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* ═══ STICKY BOTTOM CONFIRM BAR (58px) ═══ */}
        <div className="h-[58px] shrink-0 bg-[#1a1a2e] backdrop-blur-xl border-t border-white/10 flex items-center px-5 z-30 shadow-[0_-4px_20px_rgba(0,0,0,0.3)]">
          {/* Left: Order info */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-2.5 h-2.5 rounded-full bg-[#6c63ff] shrink-0 ring-2 ring-[#6c63ff]/30" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">Order #{order.order_number} — {customer?.full_name || "Customer"}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  📋 {statusCfg.label}
                </span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-white/10 text-white/70">
                  🛒 {order.channel}
                </span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-white/10 text-white/70">
                  📦 {totalItemCount} Item{totalItemCount !== 1 ? "s" : ""}
                </span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-red-500/20 text-red-300 border border-red-500/30">
                  🚚 Pathao
                </span>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="w-px h-8 bg-white/10 mx-4" />

          {/* Center: Grand Total */}
          <div className="text-right mr-4">
            <p className="text-[10px] font-medium text-white/50 uppercase tracking-wider">Grand Total</p>
            <p className="text-2xl font-extrabold text-[#6c63ff]">৳{grandTotal.toLocaleString()}</p>
          </div>

          {/* Center-right: Confirm button */}
          <AlertDialogRoot open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
            <Button onClick={() => setShowConfirmDialog(true)} disabled={confirmSending || currentStatus === "confirm"}
              className="h-11 px-8 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-sm gap-2 shadow-lg shadow-emerald-500/30 hover:shadow-emerald-400/40 transition-all hover:-translate-y-0.5 disabled:opacity-50">
              {confirmSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
              Confirm Order
            </Button>
            <ADContent>
              <ADHeader>
                <ADTitle>Confirm this order?</ADTitle>
                <ADDesc>Order #{order.order_number} will be confirmed and moved to Orders list. Stock will be deducted.</ADDesc>
              </ADHeader>
              <ADFooter>
                <ADCancel>Cancel</ADCancel>
                <ADAction onClick={handleConfirmWithMapping} disabled={confirmSending}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  {confirmSending ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Confirming...</> : "✅ Yes, Confirm"}
                </ADAction>
              </ADFooter>
            </ADContent>
          </AlertDialogRoot>

          {/* Right spacer to push confirm toward middle */}
          <div className="flex-1" />
        </div>

        {/* ═══ REASON MODAL ═══ */}
        <Dialog open={reasonModal.open} onOpenChange={(open) => setReasonModal((prev) => ({ ...prev, open }))}>
          <DialogContent className="max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle>{reasonModal.type === "cancel" ? "❌ Cancel Order" : "⏸️ Put On Hold"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Reason <span className="text-destructive">*</span></label>
                <Select value={reasonValue} onValueChange={setReasonValue}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Select a reason..." /></SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    {(reasonModal.type === "cancel" ? CANCEL_REASONS : HOLD_REASONS).map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Additional Note (optional)</label>
                <Textarea value={reasonNote} onChange={(e) => setReasonNote(e.target.value)} placeholder="Add more details..." rows={3} className="resize-none" />
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

        {/* Edit Item Modal */}
        <Dialog open={editModal.open} onOpenChange={(o) => setEditModal({ open: o, item: editModal.item })}>
          <DialogContent className="rounded-2xl max-w-md">
            <DialogHeader><DialogTitle>Edit Item</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label className="text-xs">Product Name</Label><Input value={editForm.name} onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">SKU</Label><Input value={editForm.sku} readOnly className="bg-muted" /></div>
                <div><Label className="text-xs">Price (৳)</Label><Input type="number" value={editForm.price} onChange={(e) => setEditForm(f => ({ ...f, price: Number(e.target.value) }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Quantity</Label><Input type="number" value={editForm.qty} onChange={(e) => setEditForm(f => ({ ...f, qty: Number(e.target.value) || 1 }))} /></div>
                <div><Label className="text-xs">Variant/Note</Label><Input value={editForm.note} onChange={(e) => setEditForm(f => ({ ...f, note: e.target.value }))} placeholder="Optional" /></div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditModal({ open: false, item: null })}>Cancel</Button>
              <Button onClick={saveEdit} className="bg-[#6c63ff] hover:bg-[#5a52d5]">Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Address Fix Drawer */}
        <AddressFixDrawer
          open={addressFixOpen} onOpenChange={setAddressFixOpen}
          orderId={id || ""} orderNumber={order.order_number}
          fullAddress={order.delivery_address || customer?.address || ""}
          mappingResult={addressMappingResult}
          onAccept={handleAddressFixAccept} loading={addressFixSending}
        />
      </div>
    </TooltipProvider>
  );
}
