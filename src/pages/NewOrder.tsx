import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Minus, X, Search, Package, Phone, Loader2,
  Star, RefreshCw, Trash2, FileText, Link2, Mail, Tag, Save,
  MessageCircle, TrendingUp, TrendingDown, Truck, RotateCcw, XCircle, Clock,
  ShieldCheck, AlertTriangle, AlertCircle, User,
} from "lucide-react";
import { formatBDT } from "@/lib/format";
import { usePathaoCities, usePathaoZones, usePathaoAreas } from "@/hooks/use-pathao";
import { cn } from "@/lib/utils";
import { parseAddress, getParseConfidenceLevel } from "@/lib/pathao-address-parser";
import type { ParseAddressResult } from "@/lib/pathao-address-parser";

/* ═══ Types ═══ */
interface OrderItem {
  product_id: string;
  product_name: string;
  product_sku: string;
  product_image: string | null;
  stock_quantity: number;
  quantity: number;
  unit_price: number;
  unit_cost: number;
}

/* ═══ Constants ═══ */
const COURIERS = [
  { id: "pathao", name: "Pathao", emoji: "🛵" },
  { id: "redx", name: "RedX", emoji: "🔴" },
  { id: "steadfast", name: "Steadfast", emoji: "⚡" },
  { id: "sundarban", name: "Sundarban", emoji: "📦" },
];

const SOURCES = ["UNKNOWN", "Facebook", "Instagram", "Walk-in", "Referral"];
const QUICK_NOTES = ["Call before delivery", "Fragile", "Gift wrap", "After 5 PM"];
const DEFAULT_SHIPPING_NOTE = "🛡️ মার্চেন্টের অনুমতি ছাড়া প্রোডাক্ট খোলা সম্পূর্ণ নিষিদ্ধ। খোলা পণ্য গ্রহণযোগ্য নয়।";

const TIME_RANGES = [
  { label: "Today", value: "today" },
  { label: "7 Days", value: "7d" },
  { label: "30 Days", value: "30d" },
  { label: "90 Days", value: "90d" },
];

function getTimeRangeDate(range: string): Date {
  const now = new Date();
  switch (range) {
    case "today": return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case "7d": { const d = new Date(); d.setDate(d.getDate() - 7); return d; }
    case "90d": { const d = new Date(); d.setDate(d.getDate() - 90); return d; }
    default: { const d = new Date(); d.setDate(d.getDate() - 30); return d; }
  }
}

/* ═══ Sub Components ═══ */

function KpiMini({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-card border border-border/50 min-w-[140px] flex-1">
      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", color || "bg-primary/10 text-primary")}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-base font-extrabold tabular-nums leading-tight">{value}</p>
        <p className="text-[10px] text-muted-foreground font-medium truncate">{label}</p>
        {sub && <p className="text-[9px] text-muted-foreground/70">{sub}</p>}
      </div>
    </div>
  );
}

function CourierBreakdownRow({ name, emoji, delivered, inTransit, returned, cancelled, successRate }: {
  name: string; emoji: string; delivered: number; inTransit: number; returned: number; cancelled: number; successRate: number;
}) {
  const total = delivered + inTransit + returned + cancelled;
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-muted/20 border border-border/30 hover:border-primary/20 transition-colors">
      <span className="text-lg shrink-0">{emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-bold">{name}</span>
          <span className={cn("text-xs font-extrabold tabular-nums", successRate >= 80 ? "text-emerald-600" : successRate >= 50 ? "text-amber-600" : "text-destructive")}>
            {successRate}%
          </span>
        </div>
        <div className="flex gap-3 text-[10px] text-muted-foreground">
          <span>✅ {delivered}</span>
          <span>🚚 {inTransit}</span>
          <span className="text-amber-600">↩ {returned}</span>
          <span className="text-destructive">✕ {cancelled}</span>
          <span className="ml-auto font-medium">{total} total</span>
        </div>
        <Progress value={successRate} className="h-1 mt-1.5" />
      </div>
    </div>
  );
}

function DeliveryPerformanceSection({ timeRange, setTimeRange }: { timeRange: string; setTimeRange: (v: string) => void }) {
  const fromDate = getTimeRangeDate(timeRange);

  const { data: kpis, isLoading } = useQuery({
    queryKey: ["delivery-kpis", timeRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("status, created_at, order_date")
        .gte("order_date", fromDate.toISOString());
      if (error) throw error;
      const total = data.length;
      const delivered = data.filter((o) => o.status === "delivered").length;
      const shipped = data.filter((o) => ["shipped", "in_transit"].includes(o.status || "")).length;
      const returned = data.filter((o) => o.status === "returned").length;
      const cancelled = data.filter((o) => o.status === "cancelled").length;
      const inTransit = shipped;
      const dispatchedTotal = delivered + returned + cancelled + inTransit;
      const deliveredPct = dispatchedTotal > 0 ? Math.round((delivered / dispatchedTotal) * 100) : 0;
      const rtoPct = (delivered + returned) > 0 ? Math.round((returned / (delivered + returned)) * 100) : 0;
      const cancelPct = total > 0 ? Math.round((cancelled / total) * 100) : 0;
      return { total, delivered, shipped: inTransit, returned, cancelled, deliveredPct, rtoPct, cancelPct, inTransit };
    },
    staleTime: 2 * 60 * 1000,
  });

  const { data: courierData, isLoading: courierLoading } = useQuery({
    queryKey: ["courier-breakdown", timeRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courier_history")
        .select("courier_name, status")
        .gte("created_at", fromDate.toISOString());
      if (error) throw error;
      const grouped: Record<string, { delivered: number; inTransit: number; returned: number; cancelled: number }> = {};
      for (const row of data) {
        const name = row.courier_name?.toLowerCase() || "unknown";
        if (!grouped[name]) grouped[name] = { delivered: 0, inTransit: 0, returned: 0, cancelled: 0 };
        const s = row.status?.toLowerCase() || "";
        if (s === "delivered") grouped[name].delivered++;
        else if (s === "in_transit" || s === "shipped" || s === "pending") grouped[name].inTransit++;
        else if (s === "returned") grouped[name].returned++;
        else if (s === "cancelled") grouped[name].cancelled++;
      }
      return grouped;
    },
    staleTime: 2 * 60 * 1000,
  });

  const [courierTab, setCourierTab] = useState("all");

  const getCourierStats = (name: string) => {
    const d = courierData?.[name.toLowerCase()] || { delivered: 0, inTransit: 0, returned: 0, cancelled: 0 };
    const total = d.delivered + d.inTransit + d.returned + d.cancelled;
    const successRate = total > 0 ? Math.round((d.delivered / total) * 100) : 0;
    return { ...d, total, successRate };
  };

  const allCourierStats = COURIERS.map((c) => ({ ...c, ...getCourierStats(c.name) }));
  const allTotal = allCourierStats.reduce((s, c) => ({
    delivered: s.delivered + c.delivered, inTransit: s.inTransit + c.inTransit,
    returned: s.returned + c.returned, cancelled: s.cancelled + c.cancelled,
  }), { delivered: 0, inTransit: 0, returned: 0, cancelled: 0 });
  const allTotalCount = allTotal.delivered + allTotal.inTransit + allTotal.returned + allTotal.cancelled;
  const allSuccessRate = allTotalCount > 0 ? Math.round((allTotal.delivered / allTotalCount) * 100) : 0;

  const isEmpty = !isLoading && (kpis?.total ?? 0) === 0;

  return (
    <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            📊 Delivery Performance
          </h2>
          <div className="flex items-center gap-1">
            {TIME_RANGES.map((tr) => (
              <button key={tr.value}
                onClick={() => setTimeRange(tr.value)}
                className={cn(
                  "px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors",
                  timeRange === tr.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                )}>
                {tr.label}
              </button>
            ))}
          </div>
        </div>

        {/* KPI Row */}
        {isLoading ? (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-[68px] min-w-[140px] flex-1 rounded-xl" />
            ))}
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/50">
            <Truck className="w-10 h-10 mb-2" />
            <p className="text-xs font-medium">No orders found in this time range</p>
          </div>
        ) : (
          <>
            <div className="flex gap-2 overflow-x-auto pb-3">
              <KpiMini icon={<TrendingUp className="w-4 h-4" />} label="Delivered %" value={`${kpis?.deliveredPct ?? 0}%`}
                sub={`${kpis?.delivered ?? 0} orders`} color="bg-emerald-500/10 text-emerald-600" />
              <KpiMini icon={<RotateCcw className="w-4 h-4" />} label="RTO/Return %" value={`${kpis?.rtoPct ?? 0}%`}
                sub={`${kpis?.returned ?? 0} returned`} color="bg-amber-500/10 text-amber-600" />
              <KpiMini icon={<XCircle className="w-4 h-4" />} label="Cancel %" value={`${kpis?.cancelPct ?? 0}%`}
                sub={`${kpis?.cancelled ?? 0} cancelled`} color="bg-destructive/10 text-destructive" />
              <KpiMini icon={<Truck className="w-4 h-4" />} label="In Transit" value={`${kpis?.inTransit ?? 0}`}
                sub="active shipments" color="bg-blue-500/10 text-blue-600" />
              <KpiMini icon={<Package className="w-4 h-4" />} label="Total Orders" value={`${kpis?.total ?? 0}`}
                color="bg-primary/10 text-primary" />
            </div>

            {/* Courier Breakdown Tabs */}
            <Tabs value={courierTab} onValueChange={setCourierTab} className="mt-1">
              <TabsList className="w-full justify-start gap-0 bg-transparent border-b border-border/40 h-8">
                <TabsTrigger value="all" className="text-[10px] px-3 py-1 h-7 data-[state=active]:border-primary">All</TabsTrigger>
                {COURIERS.map((c) => (
                  <TabsTrigger key={c.id} value={c.id} className="text-[10px] px-3 py-1 h-7 data-[state=active]:border-primary">
                    {c.emoji} {c.name}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="all" className="mt-2 space-y-1.5">
                {courierLoading ? (
                  <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
                ) : (
                  <>
                    {/* All summary */}
                    <CourierBreakdownRow name="All Couriers" emoji="📊"
                      delivered={allTotal.delivered} inTransit={allTotal.inTransit}
                      returned={allTotal.returned} cancelled={allTotal.cancelled}
                      successRate={allSuccessRate} />
                    {allCourierStats.filter((c) => c.total > 0).map((c) => (
                      <CourierBreakdownRow key={c.id} name={c.name} emoji={c.emoji}
                        delivered={c.delivered} inTransit={c.inTransit}
                        returned={c.returned} cancelled={c.cancelled}
                        successRate={c.successRate} />
                    ))}
                    {allTotalCount === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">No courier data available</p>
                    )}
                  </>
                )}
              </TabsContent>

              {COURIERS.map((c) => {
                const stats = getCourierStats(c.name);
                return (
                  <TabsContent key={c.id} value={c.id} className="mt-2">
                    {courierLoading ? (
                      <Skeleton className="h-14 rounded-xl" />
                    ) : stats.total === 0 ? (
                      <div className="flex flex-col items-center py-6 text-muted-foreground/50">
                        <span className="text-2xl mb-1">{c.emoji}</span>
                        <p className="text-xs">No {c.name} orders in this period</p>
                      </div>
                    ) : (
                      <CourierBreakdownRow name={c.name} emoji={c.emoji}
                        delivered={stats.delivered} inTransit={stats.inTransit}
                        returned={stats.returned} cancelled={stats.cancelled}
                        successRate={stats.successRate} />
                    )}
                  </TabsContent>
                );
              })}
            </Tabs>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* Order Health Card (replaces Delivery Method) */
function OrderHealthCard({ phone, parseResult, grandTotal, advance }: {
  phone: string; parseResult: ParseAddressResult | null; grandTotal: number; advance: number;
}) {
  const confLevel = parseResult ? getParseConfidenceLevel(parseResult.confidence) : null;
  const codPending = grandTotal - advance;

  const { data: customerHistory, isLoading } = useQuery({
    queryKey: ["customer-history", phone],
    queryFn: async () => {
      if (!phone || phone.length < 11) return null;
      // Find customer by phone
      const { data: customer } = await supabase
        .from("customers").select("id, total_orders, total_spent").eq("phone", phone).maybeSingle();
      if (!customer) return null;
      // Get order stats
      const { data: orders } = await supabase
        .from("orders").select("status").eq("customer_id", customer.id);
      if (!orders) return { total: customer.total_orders || 0, delivered: 0, returned: 0, cancelled: 0 };
      return {
        total: orders.length,
        delivered: orders.filter((o) => o.status === "delivered").length,
        returned: orders.filter((o) => o.status === "returned").length,
        cancelled: orders.filter((o) => o.status === "cancelled").length,
      };
    },
    enabled: phone.length >= 11,
    staleTime: 5 * 60 * 1000,
  });

  const hasHistory = customerHistory && customerHistory.total > 0;
  const custSuccessRate = hasHistory ? Math.round((customerHistory.delivered / customerHistory.total) * 100) : 0;

  return (
    <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
      <CardContent className="p-5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-4">
          🩺 Order Health
        </h2>

        {/* Customer History */}
        <div className="rounded-xl bg-muted/20 border border-border/30 p-3 mb-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
            <User className="w-3 h-3" /> Customer History
          </p>
          {phone.length < 11 ? (
            <p className="text-xs text-muted-foreground/60 italic">Enter phone to see history</p>
          ) : isLoading ? (
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-3/4 rounded" />
            </div>
          ) : !hasHistory ? (
            <div className="flex items-center gap-2">
              <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] rounded-full">🆕 New Customer</Badge>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Total Orders</span>
                <span className="text-xs font-bold">{customerHistory.total}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Delivered</span>
                <span className="text-xs font-bold text-emerald-600">{customerHistory.delivered}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Returned</span>
                <span className="text-xs font-bold text-amber-600">{customerHistory.returned}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Cancelled</span>
                <span className="text-xs font-bold text-destructive">{customerHistory.cancelled}</span>
              </div>
              <Progress value={custSuccessRate} className="h-1.5 mt-1" />
              <p className="text-[10px] text-muted-foreground">Success Rate: <span className={cn("font-bold", custSuccessRate >= 80 ? "text-emerald-600" : custSuccessRate >= 50 ? "text-amber-600" : "text-destructive")}>{custSuccessRate}%</span></p>
            </div>
          )}
        </div>

        {/* Address Confidence */}
        <div className="rounded-xl bg-muted/20 border border-border/30 p-3 mb-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">📍 Address Mapping</p>
          {confLevel ? (
            <div className="flex items-center gap-2">
              {confLevel.level === "high" ? (
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
              ) : confLevel.level === "medium" ? (
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              ) : (
                <AlertCircle className="w-4 h-4 text-destructive" />
              )}
              <Badge variant="outline" className={cn("text-[10px] rounded-full px-2", confLevel.color)}>
                {confLevel.icon} {confLevel.label}
              </Badge>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground/60 italic">Enter address to detect</p>
          )}
        </div>

        {/* COD Pending */}
        <div className="rounded-xl bg-muted/20 border border-border/30 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">💰 COD Status</p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">COD Pending</span>
            <span className={cn("text-sm font-extrabold tabular-nums", codPending > 0 ? "text-amber-600" : "text-emerald-600")}>
              ৳{codPending.toLocaleString()}
            </span>
          </div>
          {advance > 0 && (
            <p className="text-[10px] text-emerald-600 mt-1">✓ Advance ৳{advance.toLocaleString()} received</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StockBadge({ stock }: { stock: number }) {
  if (stock <= 0) return <span className="text-[10px] font-bold text-destructive">Out of stock</span>;
  if (stock < 10) return <span className="text-[10px] font-semibold text-orange-600">{stock} left</span>;
  return <span className="text-[10px] text-muted-foreground">{stock} in stock</span>;
}

/* ═══ Main Component ═══ */
export default function NewOrder() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const codeSearchRef = useRef<HTMLInputElement>(null);
  const nameSearchRef = useRef<HTMLInputElement>(null);

  /* ── Form State ── */
  const [form, setForm] = useState({
    customer_phone: "",
    customer_name: "",
    delivery_address: "",
    delivery_method: "pathao",
    shipping_note: DEFAULT_SHIPPING_NOTE,
    discount: 0,
    advance: 0,
    delivery_charge: 80,
    notes: "",
    source: "UNKNOWN",
    is_preorder: false,
    is_cross_sale: false,
  });

  const [items, setItems] = useState<OrderItem[]>([]);
  const [codeSearch, setCodeSearch] = useState("");
  const [nameSearch, setNameSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCityId, setSelectedCityId] = useState<number | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
  const [selectedAreaId, setSelectedAreaId] = useState<number | null>(null);
  const [cityName, setCityName] = useState("");
  const [zoneName, setZoneName] = useState("");
  const [areaName, setAreaName] = useState("");
  const [parseResult, setParseResult] = useState<ParseAddressResult | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [isReturningCustomer, setIsReturningCustomer] = useState(false);
  const [deliveryTimeRange, setDeliveryTimeRange] = useState("30d");

  const updateForm = useCallback((updates: Partial<typeof form>) => {
    setForm((f) => ({ ...f, ...updates }));
  }, []);

  /* ── Queries ── */
  const { data: products } = useQuery({
    queryKey: ["products-for-order"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku, selling_price, landed_cost_bdt, stock_quantity, image_url")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: customers } = useQuery({
    queryKey: ["customers-search", form.customer_phone],
    queryFn: async () => {
      if (form.customer_phone.length < 3) return [];
      const { data, error } = await supabase
        .from("customers")
        .select("id, full_name, phone, address, district, thana")
        .or(`phone.ilike.%${form.customer_phone}%,full_name.ilike.%${form.customer_phone}%`)
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: form.customer_phone.length >= 3,
  });

  const { data: cities } = usePathaoCities();
  const { data: zones } = usePathaoZones(selectedCityId);
  const { data: areas } = usePathaoAreas(selectedZoneId);

  /* ── Derived ── */
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const total = subtotal - form.discount + form.delivery_charge;
  const grandTotal = total;
  const showDeliveryPerformance = form.customer_phone.length >= 11;

  /* ── Address Parsing ── */
  const autoMapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ensureCitySelected = useCallback(() => {
    if (!selectedCityId && cities) {
      const dhaka = cities.find((c) => c.city_name.toLowerCase() === "dhaka");
      if (dhaka) {
        setSelectedCityId(dhaka.city_id);
        setCityName(dhaka.city_name);
      }
    }
  }, [selectedCityId, cities]);

  const runAutoMap = useCallback((address: string) => {
    if (!address || address.length < 5) {
      setParseResult(null);
      return;
    }
    ensureCitySelected();
    const currentCity = cities?.find((c) => c.city_id === selectedCityId)?.city_name || "Dhaka";
    const parsed = parseAddress(address, currentCity);
    setParseResult(parsed);
    const conf = getParseConfidenceLevel(parsed.confidence);
    if ((conf.level === "high" || conf.level === "medium") && zones) {
      const zoneMatch = zones.find((z) => z.zone_name.toLowerCase() === parsed.zone.toLowerCase());
      if (zoneMatch) {
        setSelectedZoneId(zoneMatch.zone_id);
        setZoneName(zoneMatch.zone_name);
      }
    }
  }, [cities, selectedCityId, zones, ensureCitySelected]);

  useEffect(() => {
    if (zones && zones.length > 0 && form.delivery_address && parseResult && !selectedZoneId) {
      runAutoMap(form.delivery_address);
    }
  }, [zones]);

  useEffect(() => {
    if (parseResult?.area && areas) {
      const areaMatch = areas.find((a) => a.area_name.toLowerCase() === parseResult.area.toLowerCase());
      if (areaMatch) {
        setSelectedAreaId(areaMatch.area_id);
        setAreaName(areaMatch.area_name);
      }
    }
  }, [areas, parseResult]);

  const handleAddressChange = useCallback((address: string) => {
    updateForm({ delivery_address: address });
    ensureCitySelected();
    if (autoMapTimerRef.current) clearTimeout(autoMapTimerRef.current);
    autoMapTimerRef.current = setTimeout(() => runAutoMap(address), 400);
  }, [updateForm, runAutoMap, ensureCitySelected]);

  const handleClearAddress = () => {
    updateForm({ delivery_address: "" });
    setParseResult(null);
    setSelectedZoneId(null);
    setSelectedAreaId(null);
    setZoneName("");
    setAreaName("");
  };

  /* ── Customer Handlers ── */
  const selectCustomer = (c: any) => {
    setForm((f) => ({
      ...f,
      customer_phone: c.phone,
      customer_name: c.full_name,
      delivery_address: c.address || "",
    }));
    setShowCustomerDropdown(false);
    setIsReturningCustomer(true);
    if (c.district && cities) {
      const match = cities.find((ct) => ct.city_name.toLowerCase() === c.district?.toLowerCase());
      if (match) {
        setSelectedCityId(match.city_id);
        setCityName(match.city_name);
      }
    }
    if (c.address) {
      setTimeout(() => runAutoMap(c.address), 100);
    }
  };

  const handlePhoneBlur = useCallback(async () => {
    if (form.customer_phone.length < 11) return;
    const { data } = await supabase
      .from("customers")
      .select("id, full_name, phone, address, district, thana")
      .eq("phone", form.customer_phone)
      .maybeSingle();
    if (data) {
      setIsReturningCustomer(true);
      if (!form.customer_name) updateForm({ customer_name: data.full_name });
      if (!form.delivery_address && data.address) {
        updateForm({ delivery_address: data.address });
        setTimeout(() => runAutoMap(data.address!), 100);
      }
    }
  }, [form.customer_phone, form.customer_name, form.delivery_address, updateForm, runAutoMap]);

  /* ── Product Handlers ── */
  const addProduct = (p: any) => {
    const stock = p.stock_quantity || 0;
    if (stock <= 0) {
      toast({ title: "⚠️ Stock নেই", description: `${p.name} এর stock শূন্য`, variant: "destructive" });
      return;
    }
    if (items.find((i) => i.product_id === p.id)) {
      setItems((prev) => prev.map((i) => (i.product_id === p.id ? { ...i, quantity: i.quantity + 1 } : i)));
    } else {
      setItems((prev) => [
        ...prev,
        {
          product_id: p.id, product_name: p.name, product_sku: p.sku,
          product_image: p.image_url, stock_quantity: stock,
          quantity: 1, unit_price: p.selling_price || 0, unit_cost: p.landed_cost_bdt || 0,
        },
      ]);
    }
  };

  const removeItem = (pid: string) => setItems((prev) => prev.filter((i) => i.product_id !== pid));
  const updateItem = (pid: string, field: string, val: number) =>
    setItems((prev) => prev.map((i) => (i.product_id === pid ? { ...i, [field]: Math.max(field === "quantity" ? 1 : 0, val) } : i)));

  const toggleFavorite = (pid: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid); else next.add(pid);
      return next;
    });
  };

  /* ── City/Zone/Area handlers ── */
  const handleCitySelect = (cId: string) => {
    const city = cities?.find((c) => c.city_id === Number(cId));
    if (city) {
      setSelectedCityId(city.city_id);
      setCityName(city.city_name);
      setSelectedZoneId(null);
      setSelectedAreaId(null);
      setZoneName("");
      setAreaName("");
    }
  };

  const handleZoneSelect = (zId: string) => {
    const zone = zones?.find((z) => z.zone_id === Number(zId));
    if (zone) {
      setSelectedZoneId(zone.zone_id);
      setZoneName(zone.zone_name);
      setSelectedAreaId(null);
      setAreaName("");
    }
  };

  const handleAreaSelect = (aId: string) => {
    const area = areas?.find((a) => a.area_id === Number(aId));
    if (area) {
      setSelectedAreaId(area.area_id);
      setAreaName(area.area_name);
    }
  };

  /* ── Create Order Mutation ── */
  const mutation = useMutation({
    mutationFn: async () => {
      let customer_id: string | null = null;
      if (form.customer_phone) {
        const { data: existing } = await supabase
          .from("customers").select("id").eq("phone", form.customer_phone).maybeSingle();
        if (existing) {
          customer_id = existing.id;
          await supabase.from("customers").update({
            full_name: form.customer_name, address: form.delivery_address,
            district: cityName, thana: zoneName,
          }).eq("id", existing.id);
        } else if (form.customer_name) {
          const { data: newC, error } = await supabase
            .from("customers")
            .insert({
              phone: form.customer_phone,
              full_name: form.customer_name, address: form.delivery_address,
              district: cityName, thana: zoneName,
            })
            .select("id").single();
          if (error) throw error;
          customer_id = newC.id;
        }
      }

      const orderNum = `ORD-${Date.now().toString(36).toUpperCase()}`;
      const costOfGoods = items.reduce((s, i) => s + i.quantity * i.unit_cost, 0);
      const notesArr = [form.notes, form.shipping_note].filter(Boolean);
      if (form.is_preorder) notesArr.push("[Preorder]");
      if (form.is_cross_sale) notesArr.push("[Cross Sale]");

      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          order_number: orderNum, channel: form.source.toLowerCase(),
          customer_id,
          delivery_address: form.delivery_address,
          delivery_district: cityName,
          delivery_thana: zoneName,
          payment_method: "cod",
          payment_status: "pending",
          subtotal, discount: form.discount,
          delivery_charge: form.delivery_charge, total_amount: grandTotal,
          cost_of_goods: costOfGoods, gross_profit: grandTotal - costOfGoods - form.delivery_charge,
          cod_amount: grandTotal - form.advance,
          notes: notesArr.join("\n"), status: "pending",
          tags: [form.is_preorder && "preorder", form.is_cross_sale && "cross_sale"].filter(Boolean) as string[],
        })
        .select("id").single();
      if (orderErr) throw orderErr;

      const orderItems = items.map((i) => ({
        order_id: order.id, product_id: i.product_id, quantity: i.quantity,
        unit_price: i.unit_price, unit_cost: i.unit_cost,
        total_price: i.quantity * i.unit_price, profit: i.quantity * (i.unit_price - i.unit_cost),
      }));
      const { error: itemsErr } = await supabase.from("order_items").insert(orderItems);
      if (itemsErr) throw itemsErr;

      for (const item of items) {
        const product = products?.find((p) => p.id === item.product_id);
        if (!product) continue;
        await supabase.from("products").update({
          stock_quantity: (product.stock_quantity || 0) - item.quantity,
          updated_at: new Date().toISOString(),
        }).eq("id", item.product_id);
        await supabase.from("inventory_movements").insert({
          product_id: item.product_id, movement_type: "order_pending",
          quantity: -item.quantity, reference_type: "order", reference_id: order.id,
          notes: `Order created via ${form.delivery_method}`,
        });
      }
      return order;
    },
    onSuccess: (order) => {
      toast({ title: "✅ Order created successfully!" });
      queryClient.invalidateQueries({ queryKey: ["orders-full"] });
      queryClient.invalidateQueries({ queryKey: ["order-status-counts"] });
      navigate(`/orders/${order.id}`);
    },
    onError: (err: any) => {
      toast({ title: "Error creating order", description: err.message, variant: "destructive" });
    },
  });

  /* ── Keyboard shortcut ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (canCreate && !mutation.isPending) mutation.mutate();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [form, items]);

  /* ── Filtered products ── */
  const filteredProducts = useMemo(() => {
    let filtered = products || [];
    const code = codeSearch.toLowerCase();
    const name = nameSearch.toLowerCase();
    if (code) filtered = filtered.filter((p) => p.sku.toLowerCase().includes(code));
    if (name) filtered = filtered.filter((p) => p.name.toLowerCase().includes(name));
    return [...filtered].sort((a, b) => {
      const aFav = favorites.has(a.id) ? 0 : 1;
      const bFav = favorites.has(b.id) ? 0 : 1;
      return aFav - bFav;
    });
  }, [products, codeSearch, nameSearch, favorites]);

  const canCreate = form.customer_phone.length >= 11 && items.length > 0;
  const confLevel = parseResult ? getParseConfidenceLevel(parseResult.confidence) : null;

  /* ═══ RENDER ═══ */
  return (
    <div className="animate-fade-in pb-24">
      {/* ── STICKY HEADER ── */}
      <div className="sticky top-0 z-30 -mx-4 px-4 sm:-mx-6 sm:px-6 py-3 bg-background/80 backdrop-blur-md border-b border-border/40 mb-6 flex items-center justify-between"
        style={{ height: 52 }}>
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold tracking-tight">✨ New Order</h1>
          <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-semibold rounded-full px-2.5">
            Manual
          </Badge>
        </div>
        <Button variant="outline" size="sm"
          className="text-xs text-primary border-primary/30 hover:bg-primary/5 rounded-lg gap-1.5">
          📖 How to Take New Order?
        </Button>
      </div>

      {/* ═══ 2-Column Layout ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">

        {/* ══ LEFT COLUMN ══ */}
        <div className="space-y-6">

          {/* ── Card 1: Delivery Performance (always visible, real data) ── */}
          <DeliveryPerformanceSection timeRange={deliveryTimeRange} setTimeRange={setDeliveryTimeRange} />

          {/* ── Card 2: Customer Information ── */}
          <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
            <CardContent className="p-5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-4">
                👤 Customer Information
              </h2>

              {/* Row 1: Mobile, Name, Delivery Method */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div className="relative">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                    Mobile Number *
                  </Label>
                  <div className="relative">
                    <Input
                      value={form.customer_phone}
                      onChange={(e) => { updateForm({ customer_phone: e.target.value }); setShowCustomerDropdown(true); setIsReturningCustomer(false); }}
                      onFocus={() => setShowCustomerDropdown(true)}
                      onBlur={() => { setTimeout(() => setShowCustomerDropdown(false), 200); handlePhoneBlur(); }}
                      placeholder="01XXXXXXXXX"
                      className="h-10 rounded-xl bg-muted/30 border-border/60 pr-20 focus:bg-card transition-colors"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      <button className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 transition-colors"
                        onClick={() => form.customer_phone && window.open(`tel:${form.customer_phone}`)}>
                        <Phone className="w-3.5 h-3.5" />
                      </button>
                      <button className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center hover:bg-emerald-500/20 transition-colors"
                        onClick={() => form.customer_phone && window.open(`https://wa.me/88${form.customer_phone}`)}>
                        <MessageCircle className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {isReturningCustomer && (
                    <Badge className="mt-1 bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] rounded-full">
                      ✓ Returning Customer
                    </Badge>
                  )}
                  {showCustomerDropdown && customers && customers.length > 0 && (
                    <div className="absolute z-40 w-full bg-card border border-border/60 rounded-xl mt-1 shadow-lg overflow-hidden">
                      {customers.map((c) => (
                        <button key={c.id}
                          className="w-full text-left px-3 py-2 hover:bg-muted/60 text-sm flex items-center gap-2 transition-colors"
                          onMouseDown={() => selectCustomer(c)}>
                          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                            {c.full_name?.[0]?.toUpperCase() || "?"}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-xs truncate">{c.full_name}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{c.phone}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                    Customer Name *
                  </Label>
                  <Input
                    value={form.customer_name}
                    onChange={(e) => updateForm({ customer_name: e.target.value })}
                    placeholder="Customer name"
                    className="h-10 rounded-xl bg-muted/30 border-border/60 focus:bg-card transition-colors"
                  />
                </div>

                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                    Delivery Method *
                  </Label>
                  <Select value={form.delivery_method} onValueChange={(v) => updateForm({ delivery_method: v })}>
                    <SelectTrigger className="h-10 rounded-xl bg-muted/30 border-border/60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card">
                      {COURIERS.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.emoji} {c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 2: Address + Shipping Note */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                    Address
                  </Label>
                  <Input
                    value={form.delivery_address}
                    onChange={(e) => handleAddressChange(e.target.value)}
                    placeholder="Full delivery address..."
                    className="h-10 rounded-xl bg-muted/30 border-border/60 focus:bg-card transition-colors"
                  />
                </div>
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                    Shipping Note
                  </Label>
                  <Textarea
                    value={form.shipping_note}
                    onChange={(e) => updateForm({ shipping_note: e.target.value })}
                    rows={2}
                    className="resize-none text-xs rounded-xl bg-muted/30 border-border/60 focus:bg-card transition-colors"
                  />
                </div>
              </div>

              {/* Address Auto-detect Banner */}
              <div className="flex items-center justify-between gap-3 mb-4 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/15">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs">🔮</span>
                  <span className="text-[11px] text-primary font-medium truncate">
                    Address এ লিখলে এই field গুলো অটোমেটিক fill হবে
                  </span>
                  {confLevel && (
                    <Badge variant="outline" className={cn("text-[9px] shrink-0 rounded-full px-2 py-0", confLevel.color)}>
                      {confLevel.icon} {confLevel.label}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => runAutoMap(form.delivery_address)}
                    className="w-7 h-7 rounded-lg border border-primary/20 flex items-center justify-center text-primary hover:bg-primary/10 transition-colors">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={handleClearAddress}
                    className="w-7 h-7 rounded-lg border border-primary/20 flex items-center justify-center text-primary hover:bg-primary/10 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* City / Zone / Area */}
              <div className="grid grid-cols-3 gap-4 mb-5">
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">City</Label>
                  <Select value={selectedCityId?.toString() || ""} onValueChange={handleCitySelect}>
                    <SelectTrigger className="h-10 rounded-xl bg-muted/30 border-border/60">
                      <SelectValue placeholder="Select city" />
                    </SelectTrigger>
                    <SelectContent className="bg-card max-h-64">
                      {cities?.map((c) => (<SelectItem key={c.city_id} value={c.city_id.toString()}>{c.city_name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Zone</Label>
                  <Select value={selectedZoneId?.toString() || ""} onValueChange={handleZoneSelect}>
                    <SelectTrigger className="h-10 rounded-xl bg-muted/30 border-border/60">
                      <SelectValue placeholder="Select zone" />
                    </SelectTrigger>
                    <SelectContent className="bg-card max-h-64">
                      {zones?.map((z) => (<SelectItem key={z.zone_id} value={z.zone_id.toString()}>{z.zone_name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Area</Label>
                  <Select value={selectedAreaId?.toString() || ""} onValueChange={handleAreaSelect}>
                    <SelectTrigger className="h-10 rounded-xl bg-muted/30 border-border/60">
                      <SelectValue placeholder="Select an area" />
                    </SelectTrigger>
                    <SelectContent className="bg-card max-h-64">
                      {areas?.map((a) => (<SelectItem key={a.area_id} value={a.area_id.toString()}>{a.area_name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator className="mb-4" />

              {/* Extra Options */}
              <div className="flex items-center flex-wrap gap-3">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Extra Options</Label>
                <div className="flex items-center gap-1.5">
                  {[FileText, Link2, Mail, Tag, Save].map((Icon, idx) => (
                    <button key={idx} className="w-8 h-8 rounded-lg border border-border/60 flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors">
                      <Icon className="w-3.5 h-3.5" />
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.is_preorder} onCheckedChange={(v) => updateForm({ is_preorder: v })} />
                  <span className="text-xs font-medium">Preorder</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.is_cross_sale} onCheckedChange={(v) => updateForm({ is_cross_sale: v })} />
                  <span className="text-xs font-medium">Cross Sale</span>
                </div>
                <Select value={form.source} onValueChange={(v) => updateForm({ source: v })}>
                  <SelectTrigger className="h-8 w-[130px] text-xs rounded-lg border-border/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card">
                    {SOURCES.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* ── Card 3: Order Items ── */}
          <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  🛒 Order Items
                </h2>
                {items.length > 0 && (
                  <Badge variant="secondary" className="rounded-full text-[10px] font-semibold">
                    {items.length} item{items.length > 1 ? "s" : ""} added
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* LEFT: Ordered Products */}
                <div>
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
                    Ordered Products
                  </h3>
                  {items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground/40">
                      <Package className="w-12 h-12 mb-2" />
                      <p className="text-xs">No products added yet</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {items.map((item) => (
                        <div key={item.product_id} className="relative flex items-start gap-3 p-3 bg-muted/30 rounded-xl border border-border/40 animate-fade-in">
                          <button
                            className="absolute top-1.5 right-1.5 w-5 h-5 rounded-md flex items-center justify-center text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
                            onClick={() => removeItem(item.product_id)}>
                            <X className="w-3 h-3" />
                          </button>
                          {item.product_image ? (
                            <img src={item.product_image} alt="" className="w-10 h-10 rounded-lg object-cover border border-border/30 shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                              <Package className="w-5 h-5 text-muted-foreground/40" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-mono text-muted-foreground">{item.product_sku}</p>
                            <p className="text-xs font-semibold text-primary truncate">{item.product_name}</p>
                            <p className="text-[10px] text-muted-foreground">৳{item.unit_price} · Stock: {item.stock_quantity}</p>
                            <div className="flex items-center gap-3 mt-2">
                              <div className="flex items-center gap-0.5 bg-card border border-border/60 rounded-full px-1 py-0.5">
                                <button className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
                                  onClick={() => updateItem(item.product_id, "quantity", item.quantity - 1)}>
                                  <Minus className="w-2.5 h-2.5" />
                                </button>
                                <Input type="number" value={item.quantity}
                                  onChange={(e) => updateItem(item.product_id, "quantity", parseInt(e.target.value) || 1)}
                                  className="w-8 h-5 text-center text-[11px] font-bold px-0 border-0 bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                <button className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
                                  onClick={() => updateItem(item.product_id, "quantity", item.quantity + 1)}>
                                  <Plus className="w-2.5 h-2.5" />
                                </button>
                              </div>
                              <div className="flex items-center gap-0.5 bg-card border border-border/60 rounded-full px-1 py-0.5">
                                <button className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
                                  onClick={() => updateItem(item.product_id, "unit_price", item.unit_price - 10)}>
                                  <Minus className="w-2.5 h-2.5" />
                                </button>
                                <Input type="number" value={item.unit_price}
                                  onChange={(e) => updateItem(item.product_id, "unit_price", parseFloat(e.target.value) || 0)}
                                  className="w-14 h-5 text-center text-[11px] font-mono px-0 border-0 bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                <button className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
                                  onClick={() => updateItem(item.product_id, "unit_price", item.unit_price + 10)}>
                                  <Plus className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* RIGHT: Click To Add Products */}
                <div>
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
                    Click To Add Products
                  </h3>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" />
                      <Input ref={codeSearchRef} value={codeSearch}
                        onChange={(e) => setCodeSearch(e.target.value)}
                        placeholder="Code/SKU..."
                        className="pl-8 h-9 text-xs rounded-xl bg-muted/30 border-border/60" />
                    </div>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" />
                      <Input ref={nameSearchRef} value={nameSearch}
                        onChange={(e) => setNameSearch(e.target.value)}
                        placeholder="Product name..."
                        className="pl-8 h-9 text-xs rounded-xl bg-muted/30 border-border/60" />
                    </div>
                  </div>

                  <div className="max-h-[320px] overflow-y-auto space-y-1 pr-0.5">
                    {(filteredProducts || []).slice(0, 30).map((p) => {
                      const stock = p.stock_quantity || 0;
                      const outOfStock = stock <= 0;
                      const inCart = items.find((i) => i.product_id === p.id);
                      const isFav = favorites.has(p.id);
                      return (
                        <div key={p.id}
                          className={cn(
                            "flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer transition-all",
                            outOfStock ? "opacity-40 cursor-not-allowed" :
                            inCart ? "border-primary/40 bg-primary/[0.03]" :
                            "border-border/30 hover:border-border hover:bg-muted/30"
                          )}
                          onClick={() => !outOfStock && addProduct(p)}>
                          {p.image_url ? (
                            <img src={p.image_url} alt="" className="w-9 h-9 rounded-lg object-cover border border-border/30 shrink-0" />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
                              <Package className="w-4 h-4 text-muted-foreground/40" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{p.name}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{p.sku} · {formatBDT(p.selling_price)}</p>
                          </div>
                          <StockBadge stock={stock} />
                          {inCart && <span className="text-emerald-500 text-xs">✓</span>}
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleFavorite(p.id); }}
                            className={cn("w-6 h-6 flex items-center justify-center rounded-md transition-colors",
                              isFav ? "text-amber-400" : "text-muted-foreground/30 hover:text-amber-400"
                            )}>
                            <Star className={cn("w-3.5 h-3.5", isFav && "fill-current")} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ══ RIGHT COLUMN ══ */}
        <div className="space-y-5 lg:sticky lg:top-16 lg:self-start">

          {/* ── Order Health (replaces Delivery Method) ── */}
          <OrderHealthCard
            phone={form.customer_phone}
            parseResult={parseResult}
            grandTotal={grandTotal}
            advance={form.advance}
          />

          {/* ── Order Summary ── */}
          <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
            <CardContent className="p-5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-4">
                🔥 Order Summary
              </h2>
              <div className="rounded-xl bg-gradient-to-br from-primary/5 to-primary/[0.02] border border-primary/10 p-4 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1">
                  📊 Pricing
                </p>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-semibold tabular-nums">৳{subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm items-center">
                  <span className="text-muted-foreground">Discount</span>
                  <Input type="number" value={form.discount || ""}
                    onChange={(e) => updateForm({ discount: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                    className="w-20 text-right h-7 text-sm font-mono rounded-lg border-border/60 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                </div>
                <div className="flex justify-between text-sm items-center">
                  <span className="text-muted-foreground">Advance</span>
                  <Input type="number" value={form.advance || ""}
                    onChange={(e) => updateForm({ advance: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                    className="w-20 text-right h-7 text-sm font-mono rounded-lg border-border/60 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                </div>
                <div className="flex justify-between text-sm items-center">
                  <span className="text-muted-foreground">Delivery Charge</span>
                  <Input type="number" value={form.delivery_charge}
                    onChange={(e) => updateForm({ delivery_charge: parseFloat(e.target.value) || 0 })}
                    className="w-20 text-right h-7 text-sm font-mono rounded-lg border-border/60 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                </div>
                <Separator />
                <div className="flex justify-between items-baseline pt-1">
                  <span className="text-base font-bold text-primary">Grand Total</span>
                  <span className="text-xl font-extrabold text-primary tabular-nums">৳{grandTotal.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Note ── */}
          <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
            <CardContent className="p-5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-3">
                ✏️ Note
              </h2>
              <Textarea
                value={form.notes}
                onChange={(e) => updateForm({ notes: e.target.value })}
                placeholder="Add order note..."
                rows={3}
                className="resize-none text-sm rounded-xl bg-muted/30 border-border/60 focus:bg-card transition-colors mb-3"
              />
              <div className="flex flex-wrap gap-1.5">
                {QUICK_NOTES.map((note) => (
                  <button key={note}
                    onClick={() => updateForm({ notes: form.notes ? `${form.notes}\n${note}` : note })}
                    className="px-2.5 py-1 rounded-lg border border-border/60 text-[10px] font-medium text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors">
                    {note}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ═══ BOTTOM STICKY BAR ═══ */}
      <div className="fixed bottom-0 left-0 right-0 z-50 h-[62px] flex items-center px-4 sm:px-6"
        style={{
          background: "linear-gradient(135deg, #0d0f1a 0%, #161830 100%)",
          animation: "slideUp 0.4s ease-out",
        }}>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 opacity-[0.03]"
            style={{
              background: "linear-gradient(90deg, transparent 0%, white 50%, transparent 100%)",
              animation: "shimmer 3s infinite linear",
              backgroundSize: "200% 100%",
            }} />
        </div>

        <div className="flex-1 flex items-center gap-3 min-w-0">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" style={{ animation: "pulse-subtle 2s infinite" }} />
          <div className="min-w-0">
            <p className="text-white font-bold text-sm truncate">
              {form.customer_name || "Customer"} — {form.customer_phone || "No phone"}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {items.length > 0 && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/70 font-medium">
                  {items.length} item{items.length > 1 ? "s" : ""}
                </span>
              )}
              {form.delivery_method && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/70 font-medium">
                  🛵 {COURIERS.find((c) => c.id === form.delivery_method)?.name}
                </span>
              )}
              {cityName && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/70 font-medium">
                  {cityName}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end px-4 py-1.5 rounded-xl bg-white/5 border border-white/10">
            <span className="text-[9px] uppercase tracking-wider text-white/50 font-medium">Grand Total</span>
            <span className="text-xl font-extrabold text-white tabular-nums">৳{grandTotal.toLocaleString()}</span>
          </div>
          <Button
            className={cn(
              "h-10 px-6 text-sm font-bold rounded-xl transition-all",
              "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500",
              "text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)]",
              "hover:-translate-y-0.5 active:scale-95",
            )}
            onClick={() => mutation.mutate()}
            disabled={!canCreate || mutation.isPending}>
            {mutation.isPending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />Creating...
              </span>
            ) : (
              <>✅ Create Order</>
            )}
          </Button>
        </div>

        <div className="flex-1 flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm"
            className="text-white/60 hover:text-white hover:bg-white/10 text-xs gap-1.5 rounded-lg">
            💾 Draft
          </Button>
          <Button variant="ghost" size="sm"
            className="text-white/60 hover:text-white hover:bg-white/10 text-xs gap-1.5 rounded-lg"
            onClick={() => {
              setForm({
                customer_phone: "", customer_name: "", delivery_address: "",
                delivery_method: "pathao", shipping_note: DEFAULT_SHIPPING_NOTE,
                discount: 0, advance: 0, delivery_charge: 80, notes: "",
                source: "UNKNOWN", is_preorder: false, is_cross_sale: false,
              });
              setItems([]);
              setParseResult(null);
              setSelectedCityId(null);
              setSelectedZoneId(null);
              setSelectedAreaId(null);
              setCityName("");
              setZoneName("");
              setAreaName("");
              setIsReturningCustomer(false);
            }}>
            🗑️ Clear
          </Button>
        </div>
      </div>
    </div>
  );
}
