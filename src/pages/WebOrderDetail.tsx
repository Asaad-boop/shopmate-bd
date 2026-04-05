import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { useTheme } from "next-themes";
import { useAddressParser } from "@/hooks/use-address-parser";
import { WebOrderTopGrid } from "@/components/web-order/WebOrderTopGrid";
import { WebOrderLocationStrip } from "@/components/web-order/WebOrderLocationStrip";
import { OrderedProductsCard } from "@/components/web-order/OrderedProductsCard";
import { ProductPickerCard } from "@/components/web-order/ProductPickerCard";
import { WebOrderSidebar } from "@/components/web-order/WebOrderSidebar";
import { WebOrderTotalsStrip } from "@/components/web-order/WebOrderTotalsStrip";
import { WebOrderThemeToggle } from "@/components/web-order/WebOrderThemeToggle";
import { useBDCourierSingle, getRiskLevel, getSuccessColor } from "@/hooks/use-bd-courier";
import { PathaoTrackingCard } from "@/components/pathao/PathaoTrackingCard";
import { AddressFixDrawer } from "@/components/orders/AddressFixDrawer";
import { mapAddressToPathao, type MappingResult, findBestMatch, DISTRICT_SYNONYMS, THANA_SYNONYMS } from "@/lib/address-mapper";
import { extractSpecificZone, calculateConfidence, getConfidenceLevel } from "@/lib/dhaka-area-dictionary";
import { resolveDistrict } from "@/lib/address-variations";
import { parseAddress, getParseConfidenceLevel, type ParseAddressResult, type ZoneSuggestion } from "@/lib/pathao-address-parser";
import { AddressMapperPanel } from "@/components/orders/AddressMapperPanel";
import { usePathaoCities, usePathaoZones, usePathaoAreas } from "@/hooks/use-pathao";
import { useCompanySettings } from "@/hooks/use-company-settings";
import { useInvoiceSettings } from "@/hooks/use-invoice-settings";
import { getErrorMessage } from "@/types";

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

  const { theme, setTheme } = useTheme();
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

  // Pathao City/Zone/Area inline selects
  const [pathaoCityId, setPathaoCityId] = useState<number | null>(null);
  const [pathaoZoneId, setPathaoZoneId] = useState<number | null>(null);
  const [pathaoAreaId, setPathaoAreaId] = useState<number | null>(null);
  const [citySearch, setCitySearch] = useState("");
  const [zoneSearch, setZoneSearch] = useState("");
  const isAutoMappingCity = useRef(false);
  const [addressConfidence, setAddressConfidence] = useState<number | null>(null);
  const [dictionaryZoneHint, setDictionaryZoneHint] = useState<string | null>(null);
  const [isReparsing, setIsReparsing] = useState(false);
  const [manuallyChanged, setManuallyChanged] = useState<{ city?: boolean; zone?: boolean; area?: boolean }>({});
  const [parseResult, setParseResult] = useState<ParseAddressResult | null>(null);
  const [mappingMode, setMappingMode] = useState<"auto" | "manual">("auto");
  const autoMapDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: pathaoCities, isLoading: citiesLoading } = usePathaoCities();
  const { data: pathaoZones, isLoading: zonesLoading } = usePathaoZones(pathaoCityId);
  const { data: pathaoAreas } = usePathaoAreas(pathaoZoneId);

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
      data?.forEach((s) => { map[s.key] = s.value || ""; });
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
  const customer = order?.customers;
  const customerPhone = (customer as any)?.phone || "";

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

  // Set dark theme as default for this page
  useEffect(() => {
    if (theme !== "dark") setTheme("dark");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Populate local state
  useEffect(() => { if (items) setOrderItems(items); }, [items]);

  useEffect(() => {
    if (!order) return;
    const c = order.customers as Record<string, any> | null;
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
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (district) updates.delivery_district = district;
      if (thana) updates.delivery_thana = thana;
      const { error } = await supabase.from("orders").update(updates as any).eq("id", id!);
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

  // Auto-match detected district → Pathao city (with romanization variation support)
  useEffect(() => {
    if (!pathaoCities?.length) return;
    const district = detectedDistrict || deliveryForm.city;
    if (!district || district === "-" || pathaoCityId) return;
    const candidates = pathaoCities.map(c => ({ id: c.city_id, name: c.city_name }));
    
    // Priority 1: Use variation dictionary to resolve misspellings/romanization
    const resolved = resolveDistrict(district) || resolveDistrict(order?.delivery_address || deliveryForm.address);
    if (resolved) {
      const exactMatch = candidates.find(c => c.name.toLowerCase() === resolved.toLowerCase());
      if (exactMatch) {
        isAutoMappingCity.current = true;
        setPathaoCityId(exactMatch.id);
        setDeliveryForm(f => ({ ...f, city: exactMatch.name }));
        return;
      }
    }
    
    // Priority 2: Fuzzy match with synonyms
    let match = findBestMatch(district, candidates, DISTRICT_SYNONYMS);
    if (!match.best || match.score < 0.70) {
      const address = order?.delivery_address || deliveryForm.address;
      if (address) match = findBestMatch(address, candidates, DISTRICT_SYNONYMS);
    }
    if (match.best && match.score >= 0.70) {
      isAutoMappingCity.current = true;
      setPathaoCityId(match.best.id);
      setDeliveryForm(f => ({ ...f, city: match.best!.name }));
    }
  }, [pathaoCities, detectedDistrict, deliveryForm.city, order?.delivery_address]);

  // Auto-match detected thana → Pathao zone using new scoring parser
  const runAutoMap = useCallback((address: string) => {
    if (!pathaoZones?.length) return;
    const candidates = pathaoZones.map(z => ({ id: z.zone_id, name: z.zone_name }));

    // Run the scoring-based parser with the currently selected city
    const currentCity = pathaoCities?.find(c => c.city_id === pathaoCityId)?.city_name || "Dhaka";
    const parsed = parseAddress(address, currentCity);
    setParseResult(parsed);
    setAddressConfidence(Math.round(parsed.confidence * 100));

    // In manual mode, only update suggestions panel — NOT dropdowns
    if (mappingMode === "manual") return;

    if (parsed.zone) {
      setDictionaryZoneHint(parsed.zone);
      const conf = parsed.confidence;

      // High confidence (>=0.85): auto-select zone + area
      // Medium (>=0.70): auto-select zone, area if matched
      // Low (<0.70): don't force-select
      if (conf >= 0.70) {
        const exactMatch = candidates.find(c => c.name.toLowerCase() === parsed.zone.toLowerCase());
        const fuzzyMatch = !exactMatch ? findBestMatch(parsed.zone, candidates, THANA_SYNONYMS) : null;
        const matchedZone = exactMatch || (fuzzyMatch?.best && fuzzyMatch.score >= 0.65 ? fuzzyMatch.best : null);
        if (matchedZone) {
          setPathaoZoneId(matchedZone.id);
          setDeliveryForm(f => ({ ...f, zone: matchedZone.name }));
          return;
        }
      }
    }

    // Fallback: try thana from AI parser (only in auto mode with decent confidence)
    const thana = detectedThana || deliveryForm.zone;
    if (thana && thana !== "-") {
      const thanaMatch = findBestMatch(thana, candidates, THANA_SYNONYMS);
      if (thanaMatch.best && thanaMatch.score >= 0.65) {
        setPathaoZoneId(thanaMatch.best.id);
        setDeliveryForm(f => ({ ...f, zone: thanaMatch.best!.name }));
      }
    }
  }, [pathaoZones, pathaoCities, pathaoCityId, mappingMode, detectedThana, deliveryForm.zone]);

  // Trigger auto-map on initial load
  useEffect(() => {
    if (!pathaoZones?.length || pathaoZoneId) return;
    const address = order?.delivery_address || deliveryForm.address;
    if (!address) return;
    runAutoMap(address);
  }, [pathaoZones, order?.delivery_address]);

  // Debounced auto-map on address input change (400ms)
  useEffect(() => {
    if (!deliveryForm.address || !pathaoZones?.length) return;
    if (autoMapDebounceRef.current) clearTimeout(autoMapDebounceRef.current);
    autoMapDebounceRef.current = setTimeout(() => {
      runAutoMap(deliveryForm.address);
    }, 400);
    return () => { if (autoMapDebounceRef.current) clearTimeout(autoMapDebounceRef.current); };
  }, [deliveryForm.address, runAutoMap]);

  // Auto-match address → Pathao area (fuzzy match against area names)
  useEffect(() => {
    if (!pathaoAreas?.length || pathaoAreaId) return;
    const address = order?.delivery_address || deliveryForm.address;
    if (!address) return;
    const candidates = pathaoAreas.map(a => ({ id: a.area_id, name: a.area_name }));
    const match = findBestMatch(address, candidates);
    if (match.best && match.score >= 0.55) {
      setPathaoAreaId(match.best.id);
      setDeliveryForm(f => ({ ...f, area: match.best!.name }));
    }
  }, [pathaoAreas, order?.delivery_address, deliveryForm.address]);

  // Reset zone/area only on MANUAL city changes (skip auto-mapping)
  useEffect(() => {
    if (isAutoMappingCity.current) {
      isAutoMappingCity.current = false;
      return;
    }
    setPathaoZoneId(null);
    setPathaoAreaId(null);
  }, [pathaoCityId]);

  // Filtered lists for search
  const filteredCities = pathaoCities?.filter(c => c.city_name.toLowerCase().includes(citySearch.toLowerCase())) || [];
  const filteredZones = pathaoZones?.filter(z => z.zone_name.toLowerCase().includes(zoneSearch.toLowerCase())) || [];
  const selectedCityName = pathaoCities?.find(c => c.city_id === pathaoCityId)?.city_name || "";
  const selectedZoneName = pathaoZones?.find(z => z.zone_id === pathaoZoneId)?.zone_name || "";
  const selectedAreaName = pathaoAreas?.find(a => a.area_id === pathaoAreaId)?.area_name || "";
  const confidenceInfo = addressConfidence !== null ? getParseConfidenceLevel(addressConfidence / 100) : null;

  // Re-parse / Re-auto-map handler
  const handleReparse = async () => {
    setIsReparsing(true);
    setMappingMode("auto");
    setManuallyChanged({});
    setPathaoCityId(null);
    setPathaoZoneId(null);
    setPathaoAreaId(null);
    setAddressConfidence(null);
    setDictionaryZoneHint(null);
    setDetectedDistrict(null);
    setDetectedThana(null);
    setAddressParseApplied(false);
    setParseResult(null);
    setTimeout(() => setIsReparsing(false), 500);
  };

  // Apply a suggestion from the parser
  const applySuggestion = (suggestion: ZoneSuggestion) => {
    if (!pathaoZones?.length) return;
    const candidates = pathaoZones.map(z => ({ id: z.zone_id, name: z.zone_name }));
    const match = candidates.find(c => c.name.toLowerCase() === suggestion.zone.toLowerCase())
      || findBestMatch(suggestion.zone, candidates, THANA_SYNONYMS).best;
    if (match) {
      setPathaoZoneId(match.id);
      setDeliveryForm(f => ({ ...f, zone: match.name }));
      setDictionaryZoneHint(suggestion.zone);
      setMappingMode("auto"); // applying suggestion resets to auto
      toast({ title: `✓ Applied: ${match.name}`, description: suggestion.reasons[0] || "" });
    }
  };

  // Save correction when user manually changes zone/area (with frequency tracking)
  const saveCorrection = async (field: "city" | "zone" | "area", newValue: string) => {
    const rawAddress = order?.delivery_address || deliveryForm.address;
    if (!rawAddress) return;
    try {
      // Check if this exact correction already exists → increment frequency
      const { data: existing } = await supabase
        .from("address_corrections")
        .select("id, frequency")
        .eq("raw_address", rawAddress)
        .limit(1)
        .maybeSingle();

      if (existing) {
        await supabase.from("address_corrections").update({
          [`corrected_${field}`]: newValue,
          [`detected_${field}`]: field === "city" ? selectedCityName : field === "zone" ? selectedZoneName : selectedAreaName,
          frequency: (existing.frequency || 1) + 1,
        }).eq("id", existing.id);
      } else {
        await supabase.from("address_corrections").insert({
          raw_address: rawAddress,
          raw_area_text: deliveryForm.address,
          detected_city: field === "city" ? selectedCityName : undefined,
          corrected_city: field === "city" ? newValue : undefined,
          detected_zone: field === "zone" ? selectedZoneName : undefined,
          corrected_zone: field === "zone" ? newValue : undefined,
          detected_area: field === "area" ? selectedAreaName : undefined,
          corrected_area: field === "area" ? newValue : undefined,
          frequency: 1,
        });
      }
      toast({ title: "✓ Correction saved!", description: `'${rawAddress.slice(0, 30)}…' → ${newValue}` });
    } catch (e) {
      console.error("Failed to save address correction:", e);
    }
  };

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
    onError: (err) => toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" }),
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
    const totalWeight = orderItemsList.reduce((sum: number, i) => sum + ((i.products as any)?.weight_kg || 0) * i.quantity, 0);
    const weight = totalWeight > 0 ? Math.round(totalWeight * 10) / 10 : Number(defaultWeight);
    const isCOD = order.payment_method?.toLowerCase() === "cod" || order.payment_status !== "paid";
    const totalItems = orderItemsList.reduce((sum: number, i) => sum + i.quantity, 0) || 1;
    const desc = orderItemsList.map((i) => (i.products as any)?.name).filter(Boolean).join(", ") || "";
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
      // Use inline-selected Pathao city/zone if available
      if (pathaoCityId && pathaoZoneId) {
        try {
          await sendToPathao(pathaoCityId, selectedCityName, pathaoZoneId, selectedZoneName);
        } catch (pathaoErr) {
          toast({ title: "Order confirmed but Pathao send failed", description: getErrorMessage(pathaoErr), variant: "destructive" });
          await supabase.from("orders").update({ courier_status: "PATHAO_FAILED" }).eq("id", id!);
        }
      } else {
        // Fallback: auto-mapping from address
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
            } catch (pathaoErr) {
              toast({ title: "Order confirmed but Pathao send failed", description: getErrorMessage(pathaoErr), variant: "destructive" });
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
      }
    } catch (err) {
      toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" });
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
    } catch (err) {
      toast({ title: "Pathao send failed", description: getErrorMessage(err), variant: "destructive" });
      await supabase.from("orders").update({ courier_status: "PATHAO_FAILED" }).eq("id", id!);
    } finally {
      setAddressFixSending(false);
      queryClient.invalidateQueries({ queryKey: ["web-order", id] });
      queryClient.invalidateQueries({ queryKey: ["web-order-notes", id] });
    }
  };

  const noteMutation = useMutation({
    mutationFn: async (noteText?: string) => {
      const content = noteText || newNote;
      const { error } = await supabase.from("web_order_notes").insert({
        order_id: id, note_type: "note", content, created_by: "Staff",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewNote("");
      toast({ title: "Note added" });
      queryClient.invalidateQueries({ queryKey: ["web-order-notes", id] });
    },
    onError: (err) => toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" }),
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
    onError: (err) => toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" }),
  });

  /* ── Save mutation ── */
  const saveMutation = useMutation({
    mutationFn: async () => {
      const updates: Record<string, unknown> = {
        delivery_district: deliveryForm.city, delivery_thana: deliveryForm.zone,
        delivery_address: deliveryForm.address, notes: deliveryForm.note,
        updated_at: new Date().toISOString(),
        parsed_address_confidence: addressConfidence,
        needs_address_review: addressConfidence !== null && addressConfidence < 60,
        address_parse_log: {
          detected_district: detectedDistrict,
          detected_thana: detectedThana,
          dictionary_hint: dictionaryZoneHint,
          selected_city: selectedCityName,
          selected_zone: selectedZoneName,
          selected_area: selectedAreaName,
          confidence: addressConfidence,
          manually_changed: manuallyChanged,
        },
      };
      if (deliveryForm.advanceEnabled && deliveryForm.advanceAmount > 0) {
        updates.payment_method = deliveryForm.advanceVia || "cash";
        updates.cod_amount = grandTotal - deliveryForm.advanceAmount;
      }
      const { error } = await supabase.from("orders").update(updates as any).eq("id", id!);
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
    onError: (err) => toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" }),
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
    const p = item.products;
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

  // Product price update helper
  const updatePrice = (itemId: string, price: number) => {
    setOrderItems(orderItems.map(i => {
      if (i.id !== itemId) return i;
      return { ...i, unit_price: price, total_price: (price * i.quantity) - (i.discount || 0) };
    }));
  };

  /* ── Loading ── */
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!order) return <div className="text-center py-12 text-muted-foreground">Order not found</div>;

  const currentStatus = order.web_order_status || "processing";
  const statusCfg = STATUS_LABELS[currentStatus] || { label: currentStatus.toUpperCase(), color: "bg-muted text-muted-foreground" };
  const totalItemCount = orderItems.reduce((s, i) => s + i.quantity, 0);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col h-screen overflow-hidden">

        {/* ═══ STICKY HEADER (44px) ═══ */}
        <div className="h-11 shrink-0 bg-card/80 backdrop-blur-xl border-b border-border flex items-center justify-between px-4 z-30">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/web-orders")} className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Web Orders
            </Button>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold">#{order.order_number}</h1>
              <Badge className={cn("text-[10px] px-2 py-0.5 font-semibold", statusCfg.color)}>{statusCfg.label}</Badge>
            </div>
            <span className="text-[10px] text-muted-foreground">{formatDateTime(order.created_at)}</span>
          </div>
          <div className="flex gap-2 items-center">
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handlePrintInvoice}>
              <Printer className="w-3 h-3" /> Print
            </Button>
            <Button size="sm" className="h-7 text-xs gap-1 bg-primary hover:bg-primary-dark text-primary-foreground"
              onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              <Save className="w-3 h-3" /> Save
            </Button>
            <WebOrderThemeToggle />
          </div>
        </div>

        {/* ═══ MAIN CONTENT (3-column) ═══ */}
        <div className="flex-1 min-h-0 flex">

          {/* LEFT + MIDDLE (70%) */}
          <div className="flex-[7] overflow-y-auto p-3 space-y-3 border-r border-border/50">

            {/* B) TOP INFO GRID */}
            <div className="rounded-lg border border-border bg-card p-3">
              <WebOrderTopGrid
                deliveryForm={deliveryForm}
                onFormChange={setDeliveryForm}
                customerPhone={customerPhone}
                grandTotal={grandTotal}
                channel={order.channel || ""}
                paymentMethod={order.payment_method || "COD"}
              />
            </div>

            {/* C) CITY / ZONE / AREA STRIP */}
            <WebOrderLocationStrip
              pathaoCityId={pathaoCityId}
              pathaoZoneId={pathaoZoneId}
              pathaoAreaId={pathaoAreaId}
              onCityChange={(v) => {
                const newId = Number(v);
                setPathaoCityId(newId);
                setManuallyChanged(p => ({ ...p, city: true }));
                setMappingMode("manual");
                const cityName = pathaoCities?.find(c => c.city_id === newId)?.city_name || "";
                if (selectedCityName && cityName !== selectedCityName) saveCorrection("city", cityName);
              }}
              onZoneChange={(v) => {
                const newId = Number(v);
                setPathaoZoneId(newId);
                setManuallyChanged(p => ({ ...p, zone: true }));
                setMappingMode("manual");
                const zoneName = pathaoZones?.find(z => z.zone_id === newId)?.zone_name || "";
                if (selectedZoneName && zoneName !== selectedZoneName) saveCorrection("zone", zoneName);
              }}
              onAreaChange={(v) => {
                const newId = Number(v);
                setPathaoAreaId(newId);
                setManuallyChanged(p => ({ ...p, area: true }));
                setMappingMode("manual");
                const areaName = pathaoAreas?.find(a => a.area_id === newId)?.area_name || "";
                if (selectedAreaName && areaName !== selectedAreaName) saveCorrection("area", areaName);
              }}
              filteredCities={filteredCities}
              filteredZones={filteredZones}
              pathaoAreas={pathaoAreas || []}
              citySearch={citySearch}
              zoneSearch={zoneSearch}
              onCitySearch={setCitySearch}
              onZoneSearch={setZoneSearch}
              citiesLoading={citiesLoading}
              zonesLoading={zonesLoading}
              isReparsing={isReparsing}
              onReparse={handleReparse}
              confidence={addressConfidence}
            />

            {/* D) MAIN WORK AREA — Two cards side by side */}
            <div className="grid grid-cols-2 gap-3" style={{ minHeight: "320px" }}>
              {/* LEFT: Ordered Products */}
              <OrderedProductsCard
                items={orderItems}
                onUpdateQty={updateQty}
                onUpdateDiscount={updateDiscount}
                onUpdatePrice={updatePrice}
                onRemove={(id) => setOrderItems(orderItems.filter(i => i.id !== id))}
                onEdit={openEditModal}
              />

              {/* MIDDLE: Click To Add Products */}
              <ProductPickerCard
                products={products}
                nameSearch={nameSearch}
                skuSearch={skuSearch}
                onNameSearch={setNameSearch}
                onSkuSearch={setSkuSearch}
                selectedProductIds={selectedProductIds}
                onToggleProduct={toggleProduct}
              />
            </div>

            {/* F) BOTTOM TOTALS STRIP */}
            <div className="rounded-lg border border-border bg-card p-3">
              <WebOrderTotalsStrip
                subtotal={subtotal}
                totalDiscount={totalDiscount}
                deliveryCharge={deliveryCharge}
                advancePaid={advancePaid}
                grandTotal={grandTotal}
                discount={order.discount || 0}
                advance={deliveryForm.advanceAmount}
                onDiscountChange={() => {}}
                onAdvanceChange={(v) => setDeliveryForm(f => ({ ...f, advanceAmount: v, advanceEnabled: v > 0 }))}
                onDeliveryChargeChange={() => {}}
                paymentMethod={order.payment_method || "COD"}
              />
            </div>
          </div>

          {/* E) RIGHT SIDEBAR (30%, sticky) */}
          <div className="flex-[3] overflow-y-auto p-3">
            <WebOrderSidebar
              order={order}
              orderItems={orderItems}
              grandTotal={grandTotal}
              customerPhone={customerPhone}
              currentStatus={currentStatus}
              onStatusChange={(status) => handleStatusAction(status)}
              onSave={() => saveMutation.mutate()}
              onBack={() => navigate("/web-orders")}
              onAddNote={(note) => { noteMutation.mutate(note); }}
              saving={saveMutation.isPending}
              statusOptions={[]}
            />
          </div>
        </div>

        {/* ═══ FLOATING BOTTOM CONFIRM BAR ═══ */}
        <div className="shrink-0 px-4 pb-3 pt-2 z-30">
          <div className="h-14 bg-card/95 backdrop-blur-2xl rounded-xl border border-border flex items-center px-5 shadow-lg animate-fade-in">
            {/* Left: Order info */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-2 h-2 rounded-full bg-primary shrink-0 ring-4 ring-primary/20 animate-pulse-subtle" />
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate">Order #{order.order_number} — {customer?.full_name || "Customer"}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0">{statusCfg.label}</Badge>
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0">{order.channel}</Badge>
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0">📦 {totalItemCount} Item{totalItemCount !== 1 ? "s" : ""}</Badge>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="w-px h-8 bg-border mx-4" />

            {/* Grand Total */}
            <div className="text-right mr-4">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Grand Total</p>
              <p className="text-xl font-black text-primary tabular-nums">৳{grandTotal.toLocaleString()}</p>
            </div>

            {/* Confirm button */}
            <AlertDialogRoot open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
              <Button
                onClick={() => setShowConfirmDialog(true)}
                disabled={confirmSending || currentStatus === "confirm"}
                className="h-10 px-6 rounded-lg bg-success hover:bg-success/90 text-success-foreground font-bold text-sm gap-2 shadow-md transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.97] disabled:opacity-40"
              >
                {confirmSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Confirm Order
              </Button>
              <ADContent className="rounded-xl border border-border bg-card shadow-2xl p-0 overflow-hidden max-w-sm">
                <div className="h-1 bg-gradient-to-r from-primary via-success to-primary" />
                <div className="p-6 text-center">
                  <div className="w-14 h-14 rounded-xl bg-success/15 flex items-center justify-center mx-auto mb-4 ring-4 ring-success/10">
                    <CheckCircle2 className="w-7 h-7 text-success" />
                  </div>
                  <ADHeader className="space-y-2 p-0">
                    <ADTitle className="text-lg font-bold">Confirm this order?</ADTitle>
                    <ADDesc className="text-muted-foreground text-sm">
                      Order <span className="font-semibold text-primary">#{order.order_number}</span> will be confirmed and moved to the Orders list. Stock will be deducted.
                    </ADDesc>
                  </ADHeader>
                </div>
                <ADFooter className="px-6 pb-6 pt-0 flex gap-3">
                  <ADCancel className="flex-1 h-10 rounded-lg">Cancel</ADCancel>
                  <ADAction
                    onClick={handleConfirmWithMapping}
                    disabled={confirmSending}
                    className="flex-1 h-10 rounded-lg bg-success hover:bg-success/90 text-success-foreground font-bold shadow-md"
                  >
                    {confirmSending ? <><Loader2 className="w-4 h-4 animate-spin mr-1.5" /> Confirming...</> : "✅ Yes, Confirm"}
                  </ADAction>
                </ADFooter>
              </ADContent>
            </AlertDialogRoot>

            <div className="flex-1" />
          </div>
        </div>

        {/* ═══ REASON MODAL ═══ */}
        <Dialog open={reasonModal.open} onOpenChange={(open) => setReasonModal((prev) => ({ ...prev, open }))}>
          <DialogContent className="max-w-md rounded-xl">
            <DialogHeader>
              <DialogTitle>{reasonModal.type === "cancel" ? "❌ Cancel Order" : "⏸️ Put On Hold"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Reason <span className="text-destructive">*</span></label>
                <Select value={reasonValue} onValueChange={setReasonValue}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Select a reason..." /></SelectTrigger>
                  <SelectContent className="bg-popover z-50">
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
          <DialogContent className="rounded-xl max-w-md">
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
              <Button onClick={saveEdit} className="bg-primary hover:bg-primary-dark text-primary-foreground">Save</Button>
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