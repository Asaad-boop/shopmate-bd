import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Minus, X, Search, Package, Phone, Loader2,
  Star, RefreshCw, Trash2, MessageCircle, ShieldCheck,
  AlertTriangle, AlertCircle, User, ChevronRight, Zap, TrendingUp,
  ArrowLeft, FileText, Truck, Bike, Zap as ZapIcon, Circle, Send, Bug,
} from "lucide-react";
import { formatBDT, formatDate } from "@/lib/format";
import { usePathaoCities, usePathaoZones, usePathaoAreas } from "@/hooks/use-pathao";
import { useBDCourierSingle, getRiskLevel } from "@/hooks/use-bd-courier";
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

interface CourierKpiData {
  total: number;
  delivered: number;
  shipped: number;
  returned: number;
  cancelled: number;
  successRate: number;
}

/* ═══ Constants ═══ */
const COURIERS: { id: string; name: string; icon: React.ReactNode; color: string }[] = [
  { id: "pathao", name: "Pathao", icon: <Bike className="w-4 h-4" />, color: "text-emerald-600 bg-emerald-100" },
  { id: "steadfast", name: "Steadfast", icon: <Zap className="w-4 h-4" />, color: "text-orange-600 bg-orange-100" },
  { id: "redx", name: "RedX", icon: <Truck className="w-4 h-4" />, color: "text-red-600 bg-red-100" },
  { id: "paperfly", name: "Paperfly", icon: <Send className="w-4 h-4" />, color: "text-blue-600 bg-blue-100" },
  { id: "carrbee", name: "Carrbee", icon: <Package className="w-4 h-4" />, color: "text-amber-600 bg-amber-100" },
  { id: "parceldex", name: "ParcelDex", icon: <Bug className="w-4 h-4" />, color: "text-violet-600 bg-violet-100" },
];

const SOURCES = ["UNKNOWN", "Facebook", "Instagram", "Walk-in", "Referral"];
const QUICK_NOTES = ["Call before delivery", "Fragile", "Gift wrap", "After 5 PM"];
const DEFAULT_SHIPPING_NOTE = "🛡️ মার্চেন্টের অনুমতি ছাড়া প্রোডাক্ট খোলা সম্পূর্ণ নিষিদ্ধ। খোলা পণ্য গ্রহণযোগ্য নয়।";

/* ═══ Micro Components ═══ */

function SectionLabel({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      {icon && <span className="text-muted-foreground">{icon}</span>}
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{children}</h2>
    </div>
  );
}

function KpiPill({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className={cn("text-[11px] font-semibold tabular-nums", color)}>{value}</span>
    </div>
  );
}

function DeliveryKpiCard({
  name, data, isLoading, selected, onClick, accent,
}: {
  name: string; data: CourierKpiData | null; isLoading: boolean;
  selected?: boolean; onClick?: () => void; accent?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-border/40 bg-card p-3.5 flex-1 min-w-[140px]">
        <Skeleton className="h-3 w-16 mb-2" />
        <Skeleton className="h-7 w-12 mb-3" />
        <div className="space-y-1.5">
          <Skeleton className="h-2.5 w-full" />
          <Skeleton className="h-2.5 w-3/4" />
        </div>
      </div>
    );
  }

  const d = data || { total: 0, delivered: 0, shipped: 0, returned: 0, cancelled: 0, successRate: 0 };
  const rateColor = d.total === 0 ? "text-muted-foreground" :
    d.successRate >= 80 ? "text-emerald-600" :
    d.successRate >= 50 ? "text-amber-600" : "text-red-500";

  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-xl border p-3.5 flex-1 min-w-[140px] text-left transition-all duration-200",
        selected
          ? "border-primary/50 bg-primary/[0.04] shadow-[0_0_0_1px_hsl(var(--primary)/0.15)]"
          : "border-border/40 bg-card hover:border-border/80 hover:shadow-sm",
        accent && !selected && "border-primary/20 bg-primary/[0.02]"
      )}>
      <p className={cn(
        "text-[11px] font-medium mb-1.5 transition-colors",
        selected ? "text-primary" : "text-muted-foreground"
      )}>{name}</p>
      <p className={cn("text-2xl font-bold tabular-nums leading-none mb-3", rateColor)}
        style={{ fontFamily: "'Syne', sans-serif" }}>
        {d.total > 0 ? `${d.successRate}%` : "—"}
      </p>
      <div className="space-y-1">
        <KpiPill label="Total" value={d.total} />
        <KpiPill label="Success" value={d.delivered} color="text-emerald-600" />
        <KpiPill label="Cancel" value={d.cancelled} color="text-red-500" />
      </div>
      {/* Minimal progress line */}
      <div className="mt-3 h-[3px] rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500",
            d.successRate >= 80 ? "bg-emerald-500" : d.successRate >= 50 ? "bg-amber-500" : "bg-red-500"
          )}
          style={{ width: `${d.total > 0 ? d.successRate : 0}%` }}
        />
      </div>
    </button>
  );
}

function DeliveryPerformanceSection() {
  const { data: cacheRows, isLoading } = useQuery({
    queryKey: ["delivery-perf-bdcourier-alltime"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_qc_cache")
        .select("raw_data");
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { summary, courierMap } = useMemo(() => {
    const cMap: Record<string, { total: number; delivered: number; cancelled: number; logo: string }> = {};
    COURIERS.forEach((c) => { cMap[c.id] = { total: 0, delivered: 0, cancelled: 0, logo: "" }; });
    let sTotal = 0, sDelivered = 0, sCancelled = 0;

    if (cacheRows) {
      for (const row of cacheRows) {
        const cd = (row.raw_data as any)?.courierData;
        if (!cd) continue;
        for (const c of COURIERS) {
          const d = cd[c.id];
          if (d) {
            cMap[c.id].total += d.total_parcel || 0;
            cMap[c.id].delivered += d.success_parcel || 0;
            cMap[c.id].cancelled += d.cancelled_parcel || 0;
            if (d.logo && !cMap[c.id].logo) cMap[c.id].logo = d.logo;
          }
        }
        const s = cd.summary;
        if (s) {
          sTotal += s.total_parcel || 0;
          sDelivered += s.success_parcel || 0;
          sCancelled += s.cancelled_parcel || 0;
        }
      }
    }

    const sRate = sTotal > 0 ? Math.round((sDelivered / sTotal) * 100) : 0;
    return {
      summary: { total: sTotal, delivered: sDelivered, cancelled: sCancelled, successRate: sRate },
      courierMap: cMap,
    };
  }, [cacheRows]);

  const rateColor = summary.total === 0 ? "text-muted-foreground" :
    summary.successRate >= 80 ? "text-emerald-600" :
    summary.successRate >= 50 ? "text-amber-600" : "text-red-500";

  return (
    <div className="space-y-4">
      <SectionLabel icon={<TrendingUp className="w-3.5 h-3.5" />}>Delivery Performance</SectionLabel>

      {isLoading ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[72px] rounded-xl" />)}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[150px] rounded-xl" />)}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="rounded-xl border border-border/40 bg-card p-3.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Total Orders</p>
              <p className="text-xl font-bold tabular-nums mt-1">{summary.total.toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-border/40 bg-card p-3.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Delivered</p>
              <p className="text-xl font-bold tabular-nums mt-1 text-emerald-600">{summary.delivered.toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-border/40 bg-card p-3.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Cancelled</p>
              <p className="text-xl font-bold tabular-nums mt-1 text-red-500">{summary.cancelled.toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-border/40 bg-card p-3.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Success Rate</p>
              <p className={cn("text-xl font-bold tabular-nums mt-1", rateColor)}>
                {summary.total > 0 ? `${summary.successRate}%` : "—"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {COURIERS.map((c) => {
              const s = courierMap[c.id] || { total: 0, delivered: 0, cancelled: 0, logo: "" };
              const rate = s.total > 0 ? Math.round((s.delivered / s.total) * 100) : 0;
              const rc = s.total === 0 ? "text-muted-foreground" :
                rate >= 80 ? "text-emerald-600" : rate >= 50 ? "text-amber-600" : "text-red-500";
              return (
                <div key={c.id} className="rounded-xl border border-border/40 bg-card p-3.5 flex flex-col hover:border-border/80 hover:shadow-sm transition-all">
                  <div className="flex items-center gap-2 mb-3">
                    {s.logo ? (
                      <img src={s.logo} alt={c.name} className="w-8 h-8 rounded-lg object-contain" />
                    ) : (
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", c.color)}>
                        {c.icon}
                      </div>
                    )}
                    <p className="text-xs font-semibold">{c.name}</p>
                  </div>
                  <p className={cn("text-2xl font-bold tabular-nums leading-none mb-3", rc)}>
                    {s.total > 0 ? `${rate}%` : "—"}
                  </p>
                  <div className="space-y-1.5 mt-auto">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground">Total</span>
                      <span className="font-semibold tabular-nums">{s.total.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground">Delivered</span>
                      <span className="font-semibold tabular-nums text-emerald-600">{s.delivered.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground">Cancelled</span>
                      <span className="font-semibold tabular-nums text-red-500">{s.cancelled.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="mt-3 h-[3px] rounded-full bg-muted overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all duration-500",
                      rate >= 80 ? "bg-emerald-500" : rate >= 50 ? "bg-amber-500" : "bg-red-500"
                    )} style={{ width: `${s.total > 0 ? rate : 0}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Order Health Sidebar ─── */
function OrderHealthCard({ phone, parseResult, grandTotal, advance }: {
  phone: string; parseResult: ParseAddressResult | null; grandTotal: number; advance: number;
}) {
  const confLevel = parseResult ? getParseConfidenceLevel(parseResult.confidence) : null;
  const codPending = grandTotal - advance;

  // BD Courier check
  const { data: bdCourier, isLoading: bdLoading } = useBDCourierSingle(phone, phone.length >= 11);
  const riskInfo = bdCourier ? getRiskLevel(bdCourier.success_rate) : null;

  // Customer history from our DB
  const { data: customerHistory, isLoading } = useQuery({
    queryKey: ["customer-history", phone],
    queryFn: async () => {
      if (!phone || phone.length < 11) return null;
      const { data: customer } = await supabase
        .from("customers").select("id, total_orders, total_spent").eq("phone", phone).maybeSingle();
      if (!customer) return null;
      const { data: orders } = await supabase
        .from("orders").select("id, order_number, status, total_amount, created_at")
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (!orders) return { total: customer.total_orders || 0, delivered: 0, returned: 0, cancelled: 0, totalSpent: customer.total_spent || 0, recentOrders: [] };
      return {
        total: orders.length,
        delivered: orders.filter((o) => o.status === "delivered").length,
        returned: orders.filter((o) => o.status === "returned").length,
        cancelled: orders.filter((o) => o.status === "cancelled").length,
        totalSpent: customer.total_spent || 0,
        recentOrders: orders,
      };
    },
    enabled: phone.length >= 11,
    staleTime: 5 * 60 * 1000,
  });

  // Courier history
  const { data: courierHistory, isLoading: courierHistLoading } = useQuery({
    queryKey: ["courier-history-phone", phone],
    queryFn: async () => {
      if (!phone || phone.length < 11) return [];
      const { data, error } = await supabase.from("courier_history").select("*").eq("phone", phone).order("created_at", { ascending: false }).limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: phone.length >= 11,
    staleTime: 5 * 60 * 1000,
  });

  const hasHistory = customerHistory && customerHistory.total > 0;
  const custSuccessRate = hasHistory ? Math.round((customerHistory.delivered / customerHistory.total) * 100) : 0;

  const statusColor = (s: string | null) => {
    if (s === "delivered") return "text-emerald-600 bg-emerald-50";
    if (s === "cancelled") return "text-red-600 bg-red-50";
    if (s === "returned") return "text-amber-600 bg-amber-50";
    if (s === "shipped") return "text-blue-600 bg-blue-50";
    return "text-muted-foreground bg-muted";
  };

  // Parse BD Courier raw_data for per-courier breakdown
  const courierBreakdown = useMemo(() => {
    if (!bdCourier?.raw_data) return null;
    const raw = bdCourier.raw_data as any;
    if (raw?.delivery_data && Array.isArray(raw.delivery_data)) {
      return raw.delivery_data as Array<{ courier: string; total: number; success: number; cancel: number }>;
    }
    if (raw?.courier_wise) {
      return Object.entries(raw.courier_wise).map(([name, data]: [string, any]) => ({
        courier: name, total: data.total || 0, success: data.success || data.delivered || 0, cancel: data.cancel || data.cancelled || 0,
      }));
    }
    return null;
  }, [bdCourier]);

  return (
    <div className="rounded-xl border border-border/40 bg-card p-5 space-y-5">
      <SectionLabel icon={<Zap className="w-3.5 h-3.5" />}>Order Health</SectionLabel>

      {/* BD Courier Check */}
      <div className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground flex items-center gap-1.5">
          <ShieldCheck className="w-3 h-3" /> BD Courier Check
        </p>
        {phone.length < 11 ? (
          <p className="text-xs text-muted-foreground/50">Enter phone to check</p>
        ) : bdLoading ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2"><Skeleton className="h-14 rounded-lg" /><Skeleton className="h-14 rounded-lg" /><Skeleton className="h-14 rounded-lg" /><Skeleton className="h-14 rounded-lg" /></div>
            <Skeleton className="h-24 rounded-lg" />
          </div>
        ) : bdCourier && bdCourier.total_orders > 0 ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-lg border border-border/30 bg-muted/20 text-center">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Total Orders</p>
                <p className="text-lg font-bold tabular-nums" style={{ fontFamily: "'Syne', sans-serif" }}>{bdCourier.total_orders}</p>
                <p className="text-[8px] text-muted-foreground">All time</p>
              </div>
              <div className="p-2.5 rounded-lg border border-emerald-200/50 bg-emerald-50/30 text-center">
                <p className="text-[9px] text-emerald-700 uppercase tracking-wider">Successful</p>
                <p className="text-lg font-bold tabular-nums text-emerald-600" style={{ fontFamily: "'Syne', sans-serif" }}>{bdCourier.successful_orders}</p>
                <p className="text-[8px] text-emerald-600/60">Delivered</p>
              </div>
              <div className="p-2.5 rounded-lg border border-red-200/50 bg-red-50/30 text-center">
                <p className="text-[9px] text-red-700 uppercase tracking-wider">Cancelled</p>
                <p className="text-lg font-bold tabular-nums text-red-500" style={{ fontFamily: "'Syne', sans-serif" }}>{bdCourier.cancelled_orders + bdCourier.returned_orders}</p>
                <p className="text-[8px] text-red-500/60">Failed</p>
              </div>
              <div className="p-2.5 rounded-lg border border-primary/20 bg-primary/5 text-center">
                <p className="text-[9px] text-primary uppercase tracking-wider">Success Rate</p>
                <p className="text-lg font-bold tabular-nums text-primary" style={{ fontFamily: "'Syne', sans-serif" }}>{bdCourier.success_rate}%</p>
                <div className="mt-1 h-[3px] rounded-full bg-primary/10 overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${bdCourier.success_rate}%` }} />
                </div>
              </div>
            </div>
            {courierBreakdown && courierBreakdown.length > 0 && (
              <div className="rounded-lg border border-border/30 overflow-hidden">
                <div className="grid grid-cols-4 gap-0 bg-primary text-primary-foreground px-3 py-1.5">
                  <span className="text-[9px] font-semibold uppercase tracking-wider">Courier</span>
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-center">Total</span>
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-center">Success</span>
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-center">Cancel</span>
                </div>
                {courierBreakdown.map((row, i) => (
                  <div key={i} className={cn("grid grid-cols-4 gap-0 px-3 py-2 border-t border-border/20", i % 2 === 0 ? "bg-background" : "bg-muted/20")}>
                    <span className="text-[11px] font-medium capitalize">{row.courier}</span>
                    <span className="text-[11px] tabular-nums text-center font-medium">{row.total}</span>
                    <span className="text-[11px] tabular-nums text-center font-semibold text-emerald-600">{row.success}</span>
                    <span className="text-[11px] tabular-nums text-center font-semibold text-red-500">{row.cancel}</span>
                  </div>
                ))}
                <div className="grid grid-cols-4 gap-0 px-3 py-2 border-t-2 border-border/40 bg-muted/30">
                  <span className="text-[11px] font-bold">Total</span>
                  <span className="text-[11px] tabular-nums text-center font-bold">{bdCourier.total_orders}</span>
                  <span className="text-[11px] tabular-nums text-center font-bold text-emerald-600">{bdCourier.successful_orders}</span>
                  <span className="text-[11px] tabular-nums text-center font-bold text-red-500">{bdCourier.cancelled_orders + bdCourier.returned_orders}</span>
                </div>
              </div>
            )}
            <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg border",
              riskInfo?.risk === "low" ? "border-emerald-200/50 bg-emerald-50/30" :
              riskInfo?.risk === "medium" ? "border-amber-200/50 bg-amber-50/30" :
              riskInfo?.risk === "high" ? "border-red-200/50 bg-red-50/30" : "border-border/30 bg-muted/20"
            )}>
              {riskInfo?.risk === "low" ? <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" /> :
               riskInfo?.risk === "medium" ? <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" /> :
               riskInfo?.risk === "high" ? <AlertCircle className="w-4 h-4 text-red-600 shrink-0" /> :
               <ShieldCheck className="w-4 h-4 text-muted-foreground shrink-0" />}
              <div>
                <p className="text-[11px] font-semibold">{riskInfo?.label || "Unknown"}</p>
                <p className="text-[9px] text-muted-foreground">
                  {bdCourier.success_rate >= 80 ? "This customer appears safe based on previous records." :
                   bdCourier.success_rate >= 50 ? "Customer has a moderate return/cancel history." :
                   "High risk — frequent cancellations or returns."}
                </p>
              </div>
            </div>
            {bdCourier.cached && bdCourier.last_fetched_at && (
              <p className="text-[8px] text-muted-foreground/40 text-right">Cached · {formatDate(bdCourier.last_fetched_at)}</p>
            )}
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted text-muted-foreground text-[11px] font-medium">
            🆕 No courier record found
          </div>
        )}
      </div>

      <Separator className="bg-border/30" />

      {/* Courier History */}
      {phone.length >= 11 && (
        <>
          <div className="space-y-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground flex items-center gap-1.5">🚚 Courier History</p>
            {courierHistLoading ? (
              <div className="space-y-1.5"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
            ) : courierHistory && courierHistory.length > 0 ? (
              <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                {courierHistory.map((h) => (
                  <div key={h.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/20">
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium capitalize">{h.courier_name}</p>
                      {h.tracking_id && <p className="text-[9px] text-muted-foreground font-mono truncate">{h.tracking_id}</p>}
                    </div>
                    <span className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0",
                      h.status === "delivered" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                    )}>{h.status === "delivered" ? "✓" : "↩"} {h.status}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground/50">No courier history</p>
            )}
          </div>
          <Separator className="bg-border/30" />
        </>
      )}

      {/* Our Record */}
      <div className="space-y-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground flex items-center gap-1.5"><User className="w-3 h-3" /> Our Record</p>
        {phone.length < 11 ? (
          <p className="text-xs text-muted-foreground/50">Enter phone to see history</p>
        ) : isLoading ? (
          <div className="space-y-1.5"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /></div>
        ) : !hasHistory ? (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/5 text-primary text-[11px] font-medium"><span>✦</span> New Customer</div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-lg bg-muted/30 text-center">
                <p className="text-lg font-bold tabular-nums" style={{ fontFamily: "'Syne', sans-serif" }}>{customerHistory.total}</p>
                <p className="text-[9px] text-muted-foreground">Total Orders</p>
              </div>
              <div className="p-2 rounded-lg bg-muted/30 text-center">
                <p className={cn("text-lg font-bold tabular-nums", custSuccessRate >= 80 ? "text-emerald-600" : custSuccessRate >= 50 ? "text-amber-600" : "text-red-500")}
                  style={{ fontFamily: "'Syne', sans-serif" }}>{custSuccessRate}%</p>
                <p className="text-[9px] text-muted-foreground">Success Rate</p>
              </div>
            </div>
            <KpiPill label="Delivered" value={customerHistory.delivered} color="text-emerald-600" />
            <KpiPill label="Returned" value={customerHistory.returned} color="text-amber-600" />
            <KpiPill label="Cancelled" value={customerHistory.cancelled} color="text-red-500" />
            {customerHistory.recentOrders && customerHistory.recentOrders.length > 0 && (
              <div className="pt-2 space-y-1.5">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60">Recent Orders</p>
                <div className="max-h-[160px] overflow-y-auto space-y-1">
                  {customerHistory.recentOrders.map((o: any) => (
                    <div key={o.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/20 border border-border/20">
                      <div className="min-w-0">
                        <p className="text-[10px] font-mono font-medium">{o.order_number}</p>
                        <p className="text-[9px] text-muted-foreground">{formatDate(o.created_at)}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="text-[10px] font-semibold tabular-nums">৳{(o.total_amount || 0).toLocaleString()}</span>
                        <span className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded capitalize", statusColor(o.status))}>{o.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Separator className="bg-border/30" />

      {/* Address Mapping */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Address Mapping</p>
        {confLevel ? (
          <div className="flex items-center gap-2">
            {confLevel.level === "high" ? <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> :
             confLevel.level === "medium" ? <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> :
             <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
            <span className={cn("text-[11px] font-medium", confLevel.color)}>{confLevel.icon} {confLevel.label}</span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground/50">Enter address to detect</p>
        )}
      </div>

      <Separator className="bg-border/30" />

      {/* COD Status */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">COD Status</p>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">COD Pending</span>
          <span className={cn("text-sm font-bold tabular-nums", codPending > 0 ? "text-amber-600" : "text-emerald-600")}
            style={{ fontFamily: "'Syne', sans-serif" }}>৳{codPending.toLocaleString()}</span>
        </div>
        {advance > 0 && <p className="text-[10px] text-emerald-600 font-medium">✓ Advance ৳{advance.toLocaleString()} received</p>}
      </div>
    </div>
  );
}

function StockBadge({ stock }: { stock: number }) {
  if (stock <= 0) return <span className="text-[10px] font-semibold text-red-500">Out</span>;
  if (stock < 10) return <span className="text-[10px] font-medium text-amber-600">{stock}</span>;
  return <span className="text-[10px] text-muted-foreground">{stock}</span>;
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
    if (!address || address.length < 5) { setParseResult(null); return; }
    ensureCitySelected();
    const currentCity = cities?.find((c) => c.city_id === selectedCityId)?.city_name || "Dhaka";
    const parsed = parseAddress(address, currentCity);
    setParseResult(parsed);
    const conf = getParseConfidenceLevel(parsed.confidence);
    if ((conf.level === "high" || conf.level === "medium") && zones) {
      const zoneMatch = zones.find((z) => z.zone_name.toLowerCase() === parsed.zone.toLowerCase());
      if (zoneMatch) { setSelectedZoneId(zoneMatch.zone_id); setZoneName(zoneMatch.zone_name); }
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
      if (areaMatch) { setSelectedAreaId(areaMatch.area_id); setAreaName(areaMatch.area_name); }
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
    setSelectedZoneId(null); setSelectedAreaId(null);
    setZoneName(""); setAreaName("");
  };

  /* ── Customer Handlers ── */
  const selectCustomer = (c: any) => {
    setForm((f) => ({ ...f, customer_phone: c.phone, customer_name: c.full_name, delivery_address: c.address || "" }));
    setShowCustomerDropdown(false);
    setIsReturningCustomer(true);
    if (c.district && cities) {
      const match = cities.find((ct) => ct.city_name.toLowerCase() === c.district?.toLowerCase());
      if (match) { setSelectedCityId(match.city_id); setCityName(match.city_name); }
    }
    if (c.address) setTimeout(() => runAutoMap(c.address), 100);
  };

  const handlePhoneBlur = useCallback(async () => {
    if (form.customer_phone.length < 11) return;
    const { data } = await supabase.from("customers").select("id, full_name, phone, address, district, thana").eq("phone", form.customer_phone).maybeSingle();
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
      setItems((prev) => [...prev, {
        product_id: p.id, product_name: p.name, product_sku: p.sku,
        product_image: p.image_url, stock_quantity: stock,
        quantity: 1, unit_price: p.selling_price || 0, unit_cost: p.landed_cost_bdt || 0,
      }]);
    }
  };

  const removeItem = (pid: string) => setItems((prev) => prev.filter((i) => i.product_id !== pid));
  const updateItem = (pid: string, field: string, val: number) =>
    setItems((prev) => prev.map((i) => (i.product_id === pid ? { ...i, [field]: Math.max(field === "quantity" ? 1 : 0, val) } : i)));

  const toggleFavorite = (pid: string) => {
    setFavorites((prev) => { const next = new Set(prev); if (next.has(pid)) next.delete(pid); else next.add(pid); return next; });
  };

  /* ── City/Zone/Area handlers ── */
  const handleCitySelect = (cId: string) => {
    const city = cities?.find((c) => c.city_id === Number(cId));
    if (city) { setSelectedCityId(city.city_id); setCityName(city.city_name); setSelectedZoneId(null); setSelectedAreaId(null); setZoneName(""); setAreaName(""); }
  };
  const handleZoneSelect = (zId: string) => {
    const zone = zones?.find((z) => z.zone_id === Number(zId));
    if (zone) { setSelectedZoneId(zone.zone_id); setZoneName(zone.zone_name); setSelectedAreaId(null); setAreaName(""); }
  };
  const handleAreaSelect = (aId: string) => {
    const area = areas?.find((a) => a.area_id === Number(aId));
    if (area) { setSelectedAreaId(area.area_id); setAreaName(area.area_name); }
  };

  /* ── Create Order Mutation ── */
  const mutation = useMutation({
    mutationFn: async () => {
      let customer_id: string | null = null;
      if (form.customer_phone) {
        const { data: existing } = await supabase.from("customers").select("id").eq("phone", form.customer_phone).maybeSingle();
        if (existing) {
          customer_id = existing.id;
          await supabase.from("customers").update({ full_name: form.customer_name, address: form.delivery_address, district: cityName, thana: zoneName }).eq("id", existing.id);
        } else if (form.customer_name) {
          const { data: newC, error } = await supabase.from("customers").insert({ phone: form.customer_phone, full_name: form.customer_name, address: form.delivery_address, district: cityName, thana: zoneName }).select("id").single();
          if (error) throw error;
          customer_id = newC.id;
        }
      }
      const orderNum = `ORD-${Date.now().toString(36).toUpperCase()}`;
      const costOfGoods = items.reduce((s, i) => s + i.quantity * i.unit_cost, 0);
      const notesArr = [form.notes, form.shipping_note].filter(Boolean);
      if (form.is_preorder) notesArr.push("[Preorder]");
      if (form.is_cross_sale) notesArr.push("[Cross Sale]");
      const { data: order, error: orderErr } = await supabase.from("orders").insert({
        order_number: orderNum, channel: form.source.toLowerCase(), customer_id,
        delivery_address: form.delivery_address, delivery_district: cityName, delivery_thana: zoneName,
        payment_method: "cod", payment_status: "pending",
        subtotal, discount: form.discount, delivery_charge: form.delivery_charge, total_amount: grandTotal,
        cost_of_goods: costOfGoods, gross_profit: grandTotal - costOfGoods - form.delivery_charge,
        cod_amount: grandTotal - form.advance,
        notes: notesArr.join("\n"), status: "pending",
        tags: [form.is_preorder && "preorder", form.is_cross_sale && "cross_sale"].filter(Boolean) as string[],
      }).select("id").single();
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
        await supabase.from("products").update({ stock_quantity: (product.stock_quantity || 0) - item.quantity, updated_at: new Date().toISOString() }).eq("id", item.product_id);
        await supabase.from("inventory_movements").insert({ product_id: item.product_id, movement_type: "order_pending", quantity: -item.quantity, reference_type: "order", reference_id: order.id, notes: `Order created via ${form.delivery_method}` });
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
    <div className="animate-fade-in pb-24 max-w-[1440px] mx-auto">

      {/* ═══ PAGE HEADER ═══ */}
      <header className="flex items-center justify-between py-5 mb-6 border-b border-border/30">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-bold tracking-tight text-foreground" style={{ fontFamily: "'Syne', sans-serif" }}>
                New Order
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 text-[10px] font-semibold tracking-wide uppercase">
                Draft
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Create a new customer order</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground/50 hidden sm:block">⌘+Enter to submit</span>
        </div>
      </header>

      {/* ═══ DELIVERY INSIGHTS ═══ */}
      <div className="mb-8">
        <DeliveryPerformanceSection />
      </div>

      {/* ═══ 2-COLUMN LAYOUT ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">

        {/* ══ LEFT COLUMN ══ */}
        <div className="space-y-8">

          {/* ── CUSTOMER BLOCK ── */}
          <section className="rounded-xl border border-border/40 bg-card p-6">
            <SectionLabel icon={<User className="w-3.5 h-3.5" />}>Customer</SectionLabel>

            {/* Row 1 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
              <div className="relative">
                <Label className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground mb-1.5 block">Mobile *</Label>
                <div className="relative">
                  <Input
                    value={form.customer_phone}
                    onChange={(e) => { updateForm({ customer_phone: e.target.value }); setShowCustomerDropdown(true); setIsReturningCustomer(false); }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    onBlur={() => { setTimeout(() => setShowCustomerDropdown(false), 200); handlePhoneBlur(); }}
                    placeholder="01XXXXXXXXX"
                    className="h-9 rounded-lg bg-background border-border/60 pr-20 text-sm transition-all focus:border-primary/50 focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.06)]"
                  />
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
                      onClick={() => form.customer_phone && window.open(`tel:${form.customer_phone}`)}>
                      <Phone className="w-3 h-3" />
                    </button>
                    <button className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                      onClick={() => form.customer_phone && window.open(`https://wa.me/88${form.customer_phone}`)}>
                      <MessageCircle className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                {isReturningCustomer && (
                  <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-medium text-emerald-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Returning
                  </span>
                )}
                {showCustomerDropdown && customers && customers.length > 0 && (
                  <div className="absolute z-40 w-full bg-card border border-border/60 rounded-lg mt-1 shadow-lg overflow-hidden">
                    {customers.map((c) => (
                      <button key={c.id}
                        className="w-full text-left px-3 py-2.5 hover:bg-muted/40 text-sm flex items-center gap-2.5 transition-colors"
                        onMouseDown={() => selectCustomer(c)}>
                        <div className="w-6 h-6 rounded-md bg-primary/5 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                          {c.full_name?.[0]?.toUpperCase() || "?"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-xs truncate">{c.full_name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{c.phone}</p>
                        </div>
                        <ChevronRight className="w-3 h-3 text-muted-foreground/30" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <Label className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground mb-1.5 block">Name *</Label>
                <Input value={form.customer_name} onChange={(e) => updateForm({ customer_name: e.target.value })}
                  placeholder="Customer name"
                  className="h-9 rounded-lg bg-background border-border/60 text-sm transition-all focus:border-primary/50 focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.06)]" />
              </div>

              <div>
                <Label className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground mb-1.5 block">Courier *</Label>
                <Select value={form.delivery_method} onValueChange={(v) => updateForm({ delivery_method: v })}>
                  <SelectTrigger className="h-9 rounded-lg bg-background border-border/60 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card">
                    {COURIERS.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 2: Address */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div>
                <Label className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground mb-1.5 block">Address</Label>
                <Input value={form.delivery_address} onChange={(e) => handleAddressChange(e.target.value)}
                  placeholder="Full delivery address"
                  className="h-9 rounded-lg bg-background border-border/60 text-sm transition-all focus:border-primary/50 focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.06)]" />
              </div>
              <div>
                <Label className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground mb-1.5 block">Shipping Note</Label>
                <Textarea value={form.shipping_note} onChange={(e) => updateForm({ shipping_note: e.target.value })}
                  rows={1} className="resize-none text-xs rounded-lg bg-background border-border/60 min-h-[36px] transition-all focus:border-primary/50 focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.06)]" />
              </div>
            </div>

            {/* Address auto-detect hint */}
            {form.delivery_address && (
              <div className="flex items-center gap-2 mb-5 px-3 py-2 rounded-lg bg-primary/[0.03] border border-primary/10">
                <span className="text-[11px] text-primary/70">Auto-mapping address fields</span>
                {confLevel && (
                  <span className={cn("text-[10px] font-medium", confLevel.color)}>{confLevel.icon} {confLevel.label}</span>
                )}
                <div className="ml-auto flex items-center gap-1">
                  <button onClick={() => runAutoMap(form.delivery_address)}
                    className="w-6 h-6 rounded-md flex items-center justify-center text-primary/60 hover:text-primary hover:bg-primary/5 transition-colors">
                    <RefreshCw className="w-3 h-3" />
                  </button>
                  <button onClick={handleClearAddress}
                    className="w-6 h-6 rounded-md flex items-center justify-center text-primary/60 hover:text-primary hover:bg-primary/5 transition-colors">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}

            {/* City / Zone / Area */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div>
                <Label className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground mb-1.5 block">City</Label>
                <Select value={selectedCityId?.toString() || ""} onValueChange={handleCitySelect}>
                  <SelectTrigger className="h-9 rounded-lg bg-background border-border/60 text-sm"><SelectValue placeholder="City" /></SelectTrigger>
                  <SelectContent className="bg-card max-h-64">{cities?.map((c) => (<SelectItem key={c.city_id} value={c.city_id.toString()}>{c.city_name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground mb-1.5 block">Zone</Label>
                <Select value={selectedZoneId?.toString() || ""} onValueChange={handleZoneSelect}>
                  <SelectTrigger className="h-9 rounded-lg bg-background border-border/60 text-sm"><SelectValue placeholder="Zone" /></SelectTrigger>
                  <SelectContent className="bg-card max-h-64">{zones?.map((z) => (<SelectItem key={z.zone_id} value={z.zone_id.toString()}>{z.zone_name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground mb-1.5 block">Area</Label>
                <Select value={selectedAreaId?.toString() || ""} onValueChange={handleAreaSelect}>
                  <SelectTrigger className="h-9 rounded-lg bg-background border-border/60 text-sm"><SelectValue placeholder="Area" /></SelectTrigger>
                  <SelectContent className="bg-card max-h-64">{areas?.map((a) => (<SelectItem key={a.area_id} value={a.area_id.toString()}>{a.area_name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
            </div>

            <Separator className="bg-border/20 mb-4" />

            {/* Order Configuration */}
            <div className="flex items-center flex-wrap gap-x-5 gap-y-2">
              <div className="flex items-center gap-2">
                <Switch checked={form.is_preorder} onCheckedChange={(v) => updateForm({ is_preorder: v })} className="scale-90" />
                <span className="text-xs text-muted-foreground">Preorder</span>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_cross_sale} onCheckedChange={(v) => updateForm({ is_cross_sale: v })} className="scale-90" />
                <span className="text-xs text-muted-foreground">Cross Sale</span>
              </div>
              <Select value={form.source} onValueChange={(v) => updateForm({ source: v })}>
                <SelectTrigger className="h-7 w-[110px] text-[11px] rounded-md border-border/50 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card">{SOURCES.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}</SelectContent>
              </Select>
            </div>
          </section>

          {/* ── ORDER ITEMS ── */}
          <section className="rounded-xl border border-border/40 bg-card p-6">
            <div className="flex items-center justify-between mb-5">
              <SectionLabel icon={<Package className="w-3.5 h-3.5" />}>Order Items</SectionLabel>
              {items.length > 0 && (
                <span className="text-[10px] font-semibold text-primary bg-primary/5 px-2 py-0.5 rounded-md">
                  {items.length} item{items.length > 1 ? "s" : ""}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* LEFT: Cart */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground mb-3">Cart</p>
                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-14 rounded-lg border border-dashed border-border/40">
                    <Package className="w-8 h-8 text-muted-foreground/20 mb-2" />
                    <p className="text-xs text-muted-foreground/40">No products added</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {items.map((item) => (
                      <div key={item.product_id} className="group relative flex items-start gap-3 p-3 rounded-lg border border-border/30 bg-background hover:border-border/60 transition-all">
                        <button className="absolute top-2 right-2 w-5 h-5 rounded flex items-center justify-center text-muted-foreground/30 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                          onClick={() => removeItem(item.product_id)}>
                          <X className="w-3 h-3" />
                        </button>
                        {item.product_image ? (
                          <img src={item.product_image} alt="" className="w-9 h-9 rounded-md object-cover border border-border/20 shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-md bg-muted/40 flex items-center justify-center shrink-0">
                            <Package className="w-4 h-4 text-muted-foreground/30" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-mono text-muted-foreground/60">{item.product_sku}</p>
                          <p className="text-xs font-medium text-foreground truncate">{item.product_name}</p>
                          <div className="flex items-center gap-3 mt-2">
                            {/* Qty control */}
                            <div className="flex items-center gap-0 bg-muted/30 border border-border/40 rounded-md">
                              <button className="w-6 h-6 flex items-center justify-center hover:bg-muted transition-colors rounded-l-md"
                                onClick={() => updateItem(item.product_id, "quantity", item.quantity - 1)}>
                                <Minus className="w-2.5 h-2.5" />
                              </button>
                              <Input type="number" value={item.quantity}
                                onChange={(e) => updateItem(item.product_id, "quantity", parseInt(e.target.value) || 1)}
                                className="w-7 h-6 text-center text-[11px] font-semibold px-0 border-0 bg-transparent rounded-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                              <button className="w-6 h-6 flex items-center justify-center hover:bg-muted transition-colors rounded-r-md"
                                onClick={() => updateItem(item.product_id, "quantity", item.quantity + 1)}>
                                <Plus className="w-2.5 h-2.5" />
                              </button>
                            </div>
                            {/* Price */}
                            <div className="flex items-center text-[11px] text-muted-foreground">
                              <span>৳</span>
                              <Input type="number" value={item.unit_price}
                                onChange={(e) => updateItem(item.product_id, "unit_price", parseFloat(e.target.value) || 0)}
                                className="w-14 h-6 text-[11px] font-mono px-1 border-0 bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                            </div>
                            {/* Line total */}
                            <span className="text-[11px] font-semibold tabular-nums ml-auto">
                              ৳{(item.quantity * item.unit_price).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* RIGHT: Product catalog */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground mb-3">Products</p>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/40" />
                    <Input ref={codeSearchRef} value={codeSearch} onChange={(e) => setCodeSearch(e.target.value)}
                      placeholder="SKU" className="pl-7 h-8 text-xs rounded-md bg-background border-border/50" />
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/40" />
                    <Input ref={nameSearchRef} value={nameSearch} onChange={(e) => setNameSearch(e.target.value)}
                      placeholder="Name" className="pl-7 h-8 text-xs rounded-md bg-background border-border/50" />
                  </div>
                </div>
                <div className="max-h-[360px] overflow-y-auto space-y-0.5 pr-0.5">
                  {(filteredProducts || []).slice(0, 30).map((p) => {
                    const stock = p.stock_quantity || 0;
                    const outOfStock = stock <= 0;
                    const inCart = items.find((i) => i.product_id === p.id);
                    const isFav = favorites.has(p.id);
                    return (
                      <div key={p.id}
                        className={cn(
                          "flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-all",
                          outOfStock ? "opacity-30 cursor-not-allowed" :
                          inCart ? "bg-primary/[0.04]" :
                          "hover:bg-muted/30"
                        )}
                        onClick={() => !outOfStock && addProduct(p)}>
                        {p.image_url ? (
                          <img src={p.image_url} alt="" className="w-8 h-8 rounded-md object-cover border border-border/20 shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-md bg-muted/30 flex items-center justify-center shrink-0">
                            <Package className="w-3.5 h-3.5 text-muted-foreground/30" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{p.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{p.sku} · {formatBDT(p.selling_price)}</p>
                        </div>
                        <StockBadge stock={stock} />
                        {inCart && <span className="text-emerald-500 text-[10px] font-semibold">✓</span>}
                        <button onClick={(e) => { e.stopPropagation(); toggleFavorite(p.id); }}
                          className={cn("w-5 h-5 flex items-center justify-center rounded transition-colors",
                            isFav ? "text-amber-400" : "text-muted-foreground/20 hover:text-amber-400")}>
                          <Star className={cn("w-3 h-3", isFav && "fill-current")} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* ══ RIGHT COLUMN ══ */}
        <div className="space-y-5 lg:sticky lg:top-4 lg:self-start">

          {/* Order Health */}
          <OrderHealthCard phone={form.customer_phone} parseResult={parseResult} grandTotal={grandTotal} advance={form.advance} />

          {/* Order Summary */}
          <div className="rounded-xl border border-border/40 bg-card p-5">
            <SectionLabel icon={<FileText className="w-3.5 h-3.5" />}>Summary</SectionLabel>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium tabular-nums">৳{subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm items-center">
                <span className="text-muted-foreground">Discount</span>
                <Input type="number" value={form.discount || ""} onChange={(e) => updateForm({ discount: parseFloat(e.target.value) || 0 })}
                  placeholder="0" className="w-20 text-right h-7 text-sm font-mono rounded-md border-border/40 bg-background [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
              </div>
              <div className="flex justify-between text-sm items-center">
                <span className="text-muted-foreground">Advance</span>
                <Input type="number" value={form.advance || ""} onChange={(e) => updateForm({ advance: parseFloat(e.target.value) || 0 })}
                  placeholder="0" className="w-20 text-right h-7 text-sm font-mono rounded-md border-border/40 bg-background [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
              </div>
              <div className="flex justify-between text-sm items-center">
                <span className="text-muted-foreground">Delivery</span>
                <Input type="number" value={form.delivery_charge} onChange={(e) => updateForm({ delivery_charge: parseFloat(e.target.value) || 0 })}
                  className="w-20 text-right h-7 text-sm font-mono rounded-md border-border/40 bg-background [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
              </div>
              <Separator className="bg-border/20" />
              <div className="flex justify-between items-baseline pt-1">
                <span className="text-sm font-semibold text-foreground">Total</span>
                <span className="text-xl font-bold text-primary tabular-nums" style={{ fontFamily: "'Syne', sans-serif" }}>
                  ৳{grandTotal.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="rounded-xl border border-border/40 bg-card p-5">
            <SectionLabel>Note</SectionLabel>
            <Textarea value={form.notes} onChange={(e) => updateForm({ notes: e.target.value })}
              placeholder="Add order note..." rows={2}
              className="resize-none text-sm rounded-lg bg-background border-border/40 mb-3 transition-all focus:border-primary/50 focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.06)]" />
            <div className="flex flex-wrap gap-1.5">
              {QUICK_NOTES.map((note) => (
                <button key={note}
                  onClick={() => updateForm({ notes: form.notes ? `${form.notes}\n${note}` : note })}
                  className="px-2 py-1 rounded-md text-[10px] font-medium text-muted-foreground bg-muted/30 hover:bg-primary/5 hover:text-primary border border-transparent hover:border-primary/10 transition-all">
                  {note}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ BOTTOM ACTION BAR ═══ */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/10 bg-foreground/[0.97] backdrop-blur-xl"
        style={{ height: 60 }}>
        <div className="h-full max-w-[1440px] mx-auto px-4 sm:px-6 flex items-center justify-between">
          {/* Left: Context */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
            <div className="min-w-0">
              <p className="text-white text-sm font-medium truncate">
                {form.customer_name || "Untitled"} <span className="text-white/40 font-normal">· {form.customer_phone || "—"}</span>
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                {items.length > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/50">{items.length} items</span>}
                {form.delivery_method && <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/50">{COURIERS.find((c) => c.id === form.delivery_method)?.name}</span>}
              </div>
            </div>
          </div>

          {/* Center: Total */}
          <div className="hidden sm:flex flex-col items-center px-6">
            <span className="text-[9px] uppercase tracking-wider text-white/30 font-medium">Total</span>
            <span className="text-xl font-bold text-white tabular-nums" style={{ fontFamily: "'Syne', sans-serif" }}>
              ৳{grandTotal.toLocaleString()}
            </span>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 flex-1 justify-end">
            <Button variant="ghost" size="sm"
              className="text-white/40 hover:text-white hover:bg-white/5 text-xs rounded-lg"
              onClick={() => {
                setForm({ customer_phone: "", customer_name: "", delivery_address: "", delivery_method: "pathao", shipping_note: DEFAULT_SHIPPING_NOTE, discount: 0, advance: 0, delivery_charge: 80, notes: "", source: "UNKNOWN", is_preorder: false, is_cross_sale: false });
                setItems([]); setParseResult(null); setSelectedCityId(null); setSelectedZoneId(null); setSelectedAreaId(null); setCityName(""); setZoneName(""); setAreaName(""); setIsReturningCustomer(false);
              }}>
              Clear
            </Button>
            <Button variant="ghost" size="sm" className="text-white/50 hover:text-white hover:bg-white/5 text-xs rounded-lg">
              Draft
            </Button>
            <Button
              className="h-9 px-5 text-sm font-semibold rounded-lg bg-white text-foreground hover:bg-white/90 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)]"
              onClick={() => mutation.mutate()}
              disabled={!canCreate || mutation.isPending}>
              {mutation.isPending ? (
                <span className="flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" />Creating...</span>
              ) : (
                "Create Order"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
