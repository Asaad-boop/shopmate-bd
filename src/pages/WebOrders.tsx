import { useState, useMemo, useEffect, useCallback, memo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { formatBDT, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { usePageTitle } from "@/hooks/use-page-title";
import {
  Search, Phone, MessageCircle, ExternalLink, ClipboardList, Clock,
  CheckCircle2, PhoneOff, Pause, Wallet, XCircle, Download,
  Filter, X, CalendarDays, ArrowUpDown, Copy, ShoppingBag,
  CheckCheck, Ban, ShieldAlert, AlertTriangle, Plus,
  CreditCard, PhoneMissed, CircleCheck, MoreVertical,
  Globe, TrendingUp, Package, BarChart3, Settings2,
  MapPin, StickyNote, Truck, Tag,
} from "lucide-react";
import { useBDCourierBulk, type BDCourierResult } from "@/hooks/use-bd-courier";
import {
  DropdownMenu as DropdownMenuRoot,
  DropdownMenuContent as DDContent,
  DropdownMenuItem as DDItem,
  DropdownMenuTrigger as DDTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDebounce } from "@/hooks/use-debounce";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */

const WEB_STATUSES = [
  { key: "processing",           label: "Processing",     icon: Clock,        color: "orange",  bg: "bg-orange-500",  bgLight: "bg-orange-50  text-orange-700 border-orange-200" },
  { key: "good_but_no_response", label: "Good / No Resp", icon: PhoneOff,     color: "blue",    bg: "bg-blue-500",    bgLight: "bg-blue-50    text-blue-700   border-blue-200" },
  { key: "no_response",          label: "No Response",    icon: PhoneMissed,  color: "slate",   bg: "bg-slate-500",   bgLight: "bg-slate-50   text-slate-700  border-slate-200" },
  { key: "advance_payment",      label: "Advance",        icon: CreditCard,   color: "green",   bg: "bg-emerald-500", bgLight: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { key: "on_hold",              label: "On Hold",        icon: Pause,        color: "purple",  bg: "bg-purple-500",  bgLight: "bg-purple-50  text-purple-700 border-purple-200" },
  { key: "confirm",              label: "Complete",       icon: CircleCheck,  color: "emerald", bg: "bg-emerald-600", bgLight: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { key: "cancel",               label: "Cancel",         icon: XCircle,      color: "red",     bg: "bg-red-500",     bgLight: "bg-red-50     text-red-700    border-red-200" },
  { key: "all",                  label: "All",            icon: ClipboardList,color: "default", bg: "bg-slate-700",   bgLight: "bg-muted      text-foreground border-border" },
] as const;

const SORT_OPTIONS = [
  { key: "newest", label: "Newest First" },
  { key: "oldest", label: "Oldest First" },
  { key: "amount_high", label: "Amount: High → Low" },
  { key: "amount_low", label: "Amount: Low → High" },
];

const PAGE_SIZES = [20, 50, 100];

// Column visibility config
type ColumnKey = "orderInfo" | "customer" | "items" | "value" | "district" | "risk" | "successRate" | "site" | "actions";

interface ColumnDef {
  key: ColumnKey;
  label: string;
  w: string;
  hideable: boolean;
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: "orderInfo",   label: "Order Info",   w: "min-w-[160px]", hideable: false },
  { key: "customer",    label: "Customer",     w: "min-w-[200px]", hideable: false },
  { key: "items",       label: "Items",        w: "min-w-[160px]", hideable: false },
  { key: "value",       label: "Value",        w: "min-w-[100px]", hideable: true },
  { key: "district",    label: "District",     w: "min-w-[100px]", hideable: true },
  { key: "risk",        label: "Risk",         w: "min-w-[80px]",  hideable: true },
  { key: "successRate", label: "Success Rate", w: "min-w-[120px]", hideable: true },
  { key: "site",        label: "Site",         w: "min-w-[80px]",  hideable: true },
  { key: "actions",     label: "",             w: "w-[100px]",     hideable: false },
];

const DEFAULT_VISIBLE: ColumnKey[] = ALL_COLUMNS.map((c) => c.key);

function loadVisibleColumns(): ColumnKey[] {
  try {
    const saved = localStorage.getItem("weborders_columns");
    if (saved) return JSON.parse(saved);
  } catch {}
  return DEFAULT_VISIBLE;
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export default function WebOrdersPage() {
  usePageTitle("Web Orders");
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const [activeTab, setActiveTab] = useState("processing");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [selected, setSelected] = useState<string[]>([]);
  const [lastSynced, setLastSynced] = useState<Date>(new Date());
  const [sortBy, setSortBy] = useState("newest");
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [siteFilter, setSiteFilter] = useState<string | null>(null);
  const [syncCountdown, setSyncCountdown] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [drawerOrderId, setDrawerOrderId] = useState<string | null>(null);
  const [visibleCols, setVisibleCols] = useState<ColumnKey[]>(loadVisibleColumns);

  // Persist column visibility
  const toggleColumn = useCallback((key: ColumnKey) => {
    setVisibleCols((prev) => {
      const next = prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key];
      localStorage.setItem("weborders_columns", JSON.stringify(next));
      return next;
    });
  }, []);

  const isColVisible = useCallback((key: ColumnKey) => visibleCols.includes(key), [visibleCols]);

  // Auto-refresh countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setSyncCountdown(Math.floor((Date.now() - lastSynced.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [lastSynced]);

  const syncAgoText = useMemo(() => {
    const mins = Math.floor(syncCountdown / 60);
    if (mins < 1) return `${syncCountdown}s ago`;
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  }, [syncCountdown]);

  const { data: shopifyConnected } = useQuery({
    queryKey: ["shopify-connected"],
    queryFn: async () => {
      const { data } = await supabase.from("settings").select("value").eq("key", "shopify_store_url").maybeSingle();
      return !!(data?.value);
    },
  });

  // Realtime listener
  useEffect(() => {
    const channel = supabase
      .channel("web-orders-realtime")
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "orders", filter: "channel=eq.shopify",
      }, (payload) => {
        toast({ title: "🛍️ নতুন Shopify Order এসেছে!", description: `Order: ${(payload.new as any).order_number}` });
        setLastSynced(new Date());
        queryClient.invalidateQueries({ queryKey: ["web-orders"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient, toast]);

  // Fetch orders
  const { data: orders, isLoading } = useQuery({
    queryKey: ["web-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, customers(full_name, phone, address, district, thana, total_orders, total_spent, segment, is_blocked, risk_flags)")
        .not("web_order_status", "is", null)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
    refetchInterval: 300000,
  });

  const phoneCounts = useMemo(() => {
    const counts = new Map<string, number>();
    orders?.forEach((o) => {
      const phone = (o.customers as any)?.phone;
      if (phone) counts.set(phone, (counts.get(phone) || 0) + 1);
    });
    return counts;
  }, [orders]);

  const markSuspicious = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase.from("orders").update({ web_order_status: "on_hold", notes: "⚠️ Marked suspicious" } as any).eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "⚠️ Order marked suspicious" });
      queryClient.invalidateQueries({ queryKey: ["web-orders"] });
    },
  });

  // Normalize phone: strip to 11-digit BD format for consistent cache lookup
  const normalizePhone = useCallback((phone: string | null | undefined): string => {
    if (!phone) return "";
    let digits = phone.replace(/\D/g, "");
    if (digits.startsWith("880")) digits = digits.slice(3);
    if (digits.length === 10 && !digits.startsWith("0")) digits = `0${digits}`;
    if (digits.length > 11) digits = digits.slice(-11);
    return digits.length === 11 ? digits : "";
  }, []);

  // Only fetch courier data for the currently visible page to save API quota
  const customerPhones = useMemo(() => {
    return paginatedOrders
      .map((o) => (o.customers as any)?.phone)
      .filter(Boolean) as string[];
  }, [paginatedOrders]);

  const { data: bdCourierData, isLoading: bdLoading } = useBDCourierBulk(customerPhones, customerPhones.length > 0);

  const riskMap = useMemo(() => {
    if (!bdCourierData) return new Map<string, BDCourierResult>();
    return new Map(
      Object.entries(bdCourierData)
        .filter(([, result]) => result && !result.error)
        .map(([rawPhone, result]) => [normalizePhone(rawPhone), result]),
    );
  }, [bdCourierData, normalizePhone]);

  const orderIds = orders?.map((o) => o.id) || [];

  const { data: allItems } = useQuery({
    queryKey: ["web-order-items", orderIds.length],
    queryFn: async () => {
      if (!orderIds.length) return [];
      const { data, error } = await supabase
        .from("order_items")
        .select("*, products(name, sku, image_url)")
        .in("order_id", orderIds);
      if (error) throw error;
      return data;
    },
    enabled: orderIds.length > 0,
  });

  const { data: latestNotes } = useQuery({
    queryKey: ["web-order-latest-notes", orderIds.length],
    queryFn: async () => {
      if (!orderIds.length) return [];
      const { data, error } = await supabase
        .from("web_order_notes")
        .select("*")
        .in("order_id", orderIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const map = new Map<string, typeof data[0]>();
      data.forEach((n) => {
        if (n.order_id && !map.has(n.order_id)) map.set(n.order_id, n);
      });
      return map;
    },
    enabled: orderIds.length > 0,
  });

  const itemsByOrder = useMemo(() => {
    const map = new Map<string, typeof allItems>();
    allItems?.forEach((item) => {
      if (!item.order_id) return;
      const existing = map.get(item.order_id) || [];
      existing.push(item);
      map.set(item.order_id, existing);
    });
    return map;
  }, [allItems]);

  const kpis = useMemo(() => {
    if (!orders) return { today: 0, processing: 0, monthRevenue: 0 };
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    let today = 0, processing = 0, monthRevenue = 0;
    orders.forEach((o) => {
      if (new Date(o.created_at || "") >= startOfDay) today++;
      if ((o.web_order_status || "processing") === "processing") processing++;
      if (new Date(o.created_at || "") >= startOfMonth) monthRevenue += Number(o.total_amount || 0);
    });
    return { today, processing, monthRevenue };
  }, [orders]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0 };
    const values: Record<string, number> = { all: 0 };
    WEB_STATUSES.forEach((s) => { if (s.key !== "all") { counts[s.key] = 0; values[s.key] = 0; } });
    orders?.forEach((o) => {
      counts.all++;
      values.all += Number(o.total_amount || 0);
      const st = o.web_order_status || "processing";
      if (counts[st] !== undefined) { counts[st]++; values[st] += Number(o.total_amount || 0); }
    });
    return { counts, values };
  }, [orders]);

  const filtered = useMemo(() => {
    let list = orders || [];
    if (activeTab !== "all") list = list.filter((o) => (o.web_order_status || "processing") === activeTab);
    if (debouncedSearch) {
      const s = debouncedSearch.toLowerCase();
      list = list.filter((o) =>
        o.order_number?.toLowerCase().includes(s) ||
        (o.customers as any)?.full_name?.toLowerCase().includes(s) ||
        (o.customers as any)?.phone?.includes(s)
      );
    }
    if (siteFilter) list = list.filter((o) => o.channel === siteFilter);
    if (dateRange.from) list = list.filter((o) => new Date(o.created_at || "") >= dateRange.from!);
    if (dateRange.to) {
      const end = new Date(dateRange.to); end.setHours(23, 59, 59, 999);
      list = list.filter((o) => new Date(o.created_at || "") <= end);
    }
    if (sortBy === "oldest") list = [...list].sort((a, b) => new Date(a.created_at || "").getTime() - new Date(b.created_at || "").getTime());
    else if (sortBy === "amount_high") list = [...list].sort((a, b) => Number(b.total_amount || 0) - Number(a.total_amount || 0));
    else if (sortBy === "amount_low") list = [...list].sort((a, b) => Number(a.total_amount || 0) - Number(b.total_amount || 0));
    return list;
  }, [orders, activeTab, debouncedSearch, siteFilter, dateRange, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedOrders = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  useEffect(() => { setPage(1); }, [activeTab, search, siteFilter, dateRange, sortBy]);

  const bulkMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const { error } = await supabase.from("orders").update({ web_order_status: newStatus }).in("id", selected);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: `${selected.length} orders updated` });
      setSelected([]);
      queryClient.invalidateQueries({ queryKey: ["web-orders"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const toggleSelect = (id: string) => setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const toggleAll = () => {
    if (selected.length === paginatedOrders.length) setSelected([]);
    else setSelected(paginatedOrders.map((o) => o.id));
  };

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: text });
  }, [toast]);

  const isNew = (dateStr: string | null) => {
    if (!dateStr) return false;
    return Date.now() - new Date(dateStr).getTime() < 2 * 60 * 60 * 1000;
  };

  const getSuccessRate = useCallback((customer: any) => {
    if (!customer?.phone) return { percent: 0, delivered: 0, total: 0, rating: 0, loading: false, noData: true, isNew: true };
    const norm = normalizePhone(customer.phone);
    const bdData = riskMap.get(norm);
    if (!bdData) {
      // Still loading or not in cache — show loading if bulk query is running, otherwise "new"
      return { percent: 0, delivered: 0, total: 0, rating: 0, loading: bdLoading, noData: !bdLoading, isNew: !bdLoading };
    }
    const total = bdData.total_orders || 0;
    const success = bdData.successful_orders || bdData.total_success || 0;
    const rate = bdData.success_rate || bdData.overall_success_rate || 0;
    const rating = Math.min(150, Math.round(total * 1.5));
    return {
      percent: rate,
      delivered: success,
      total,
      rating,
      loading: false,
      noData: false,
      isNew: total === 0,
    };
  }, [riskMap, bdLoading, normalizePhone]);

  const handleRowClick = useCallback((e: React.MouseEvent, orderId: string) => {
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("a") || target.closest("input") || target.closest("[role='menuitem']")) return;
    setDrawerOrderId(orderId);
  }, []);

  // Drawer data
  const drawerOrder = useMemo(() => {
    if (!drawerOrderId || !orders) return null;
    return orders.find((o) => o.id === drawerOrderId) || null;
  }, [drawerOrderId, orders]);

  const activeFilters: { label: string; onRemove: () => void }[] = [];
  if (siteFilter) activeFilters.push({ label: `Site: ${siteFilter}`, onRemove: () => setSiteFilter(null) });
  if (dateRange.from) activeFilters.push({ label: `From: ${format(dateRange.from, "dd MMM")}`, onRemove: () => setDateRange((r) => ({ ...r, from: undefined })) });
  if (dateRange.to) activeFilters.push({ label: `To: ${format(dateRange.to, "dd MMM")}`, onRemove: () => setDateRange((r) => ({ ...r, to: undefined })) });
  if (sortBy !== "newest") activeFilters.push({ label: `Sort: ${SORT_OPTIONS.find((s) => s.key === sortBy)?.label}`, onRemove: () => setSortBy("newest") });

  const visibleTableCols = ALL_COLUMNS.filter((c) => isColVisible(c.key));

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-5 animate-fade-in">

        {/* ── PAGE HEADER ── */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Web Orders</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Shopify store orders and fulfillment</p>
          </div>
          <div className="flex items-center gap-2">
            {shopifyConnected && (
              <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 rounded-xl px-3 py-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Live</span>
                <span className="text-[10px] text-emerald-600/70 dark:text-emerald-500/70">{syncAgoText}</span>
              </div>
            )}
            <Button variant="outline" size="sm" className="gap-1.5 h-9 rounded-lg text-xs">
              <Download className="w-3.5 h-3.5" /> Export
            </Button>
            <Button size="sm" className="gap-1.5 h-9 rounded-lg text-xs" onClick={() => navigate("/orders/new")}>
              <Plus className="w-3.5 h-3.5" /> New Order
            </Button>
          </div>
        </div>

        {/* ── KPI CARDS ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard icon={ShoppingBag} label="Today's Orders" value={isLoading ? null : kpis.today} color="blue" />
          <KpiCard icon={Clock} label="Processing" value={isLoading ? null : kpis.processing} color="orange" />
          <KpiCard icon={TrendingUp} label="Revenue (Month)" value={isLoading ? null : formatBDT(kpis.monthRevenue)} color="emerald" />
          <KpiCard icon={BarChart3} label="Total Orders" value={isLoading ? null : statusCounts.counts.all} color="purple" />
        </div>

        {/* ── STATUS TABS ── */}
        <div className="overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
          <div className="inline-flex items-center gap-1 p-1 bg-muted/40 rounded-xl border border-border/30">
            {WEB_STATUSES.map((s) => {
              const Icon = s.icon;
              const isActive = activeTab === s.key;
              const count = statusCounts.counts[s.key] || 0;
              return (
                <button
                  key={s.key}
                  onClick={() => { setActiveTab(s.key); setSelected([]); }}
                  className={cn(
                    "relative flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200",
                    isActive ? "bg-card text-foreground shadow-sm border border-border/60" : "text-muted-foreground hover:text-foreground hover:bg-card/40"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" strokeWidth={isActive ? 2.2 : 1.8} />
                  <span>{s.label}</span>
                  {count > 0 && (
                    <span className={cn(
                      "text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full inline-flex items-center justify-center",
                      isActive ? cn(s.bg, "text-white") : "bg-muted text-muted-foreground"
                    )}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── SEARCH & FILTER BAR ── */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search phone, name, order ID, SKU..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 rounded-lg text-sm" />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("gap-1.5 text-xs h-9 rounded-lg", dateRange.from && "border-primary text-primary")}>
                <CalendarDays className="w-3.5 h-3.5" />
                {dateRange.from ? `${format(dateRange.from, "dd MMM")}${dateRange.to ? ` – ${format(dateRange.to, "dd MMM")}` : ""}` : "Date Range"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="range" selected={dateRange.from ? { from: dateRange.from, to: dateRange.to } : undefined} onSelect={(range) => setDateRange({ from: range?.from, to: range?.to })} className="p-3 pointer-events-auto" numberOfMonths={1} />
            </PopoverContent>
          </Popover>

          <DropdownMenuRoot>
            <DDTrigger asChild>
              <Button variant="outline" size="sm" className={cn("gap-1.5 text-xs h-9 rounded-lg", siteFilter && "border-primary text-primary")}>
                <Globe className="w-3.5 h-3.5" /> {siteFilter || "Site"}
              </Button>
            </DDTrigger>
            <DDContent align="start">
              <DDItem onClick={() => setSiteFilter(null)}>All Sites</DDItem>
              <DDItem onClick={() => setSiteFilter("shopify")}>🛍️ Shopify</DDItem>
              <DDItem onClick={() => setSiteFilter("manual")}>✍️ Manual</DDItem>
            </DDContent>
          </DropdownMenuRoot>

          <DropdownMenuRoot>
            <DDTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9 rounded-lg">
                <ArrowUpDown className="w-3.5 h-3.5" /> Sort
              </Button>
            </DDTrigger>
            <DDContent align="start">
              {SORT_OPTIONS.map((opt) => (
                <DDItem key={opt.key} onClick={() => setSortBy(opt.key)} className={cn(sortBy === opt.key && "font-semibold")}>{opt.label}</DDItem>
              ))}
            </DDContent>
          </DropdownMenuRoot>

          {/* Column visibility toggle */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9 rounded-lg">
                <Settings2 className="w-3.5 h-3.5" /> Columns
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-52 p-3">
              <p className="text-xs font-semibold text-foreground mb-2">Toggle Columns</p>
              <div className="space-y-2">
                {ALL_COLUMNS.filter((c) => c.label).map((col) => (
                  <div key={col.key} className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground cursor-pointer" htmlFor={`col-${col.key}`}>{col.label}</Label>
                    <Switch
                      id={`col-${col.key}`}
                      checked={isColVisible(col.key)}
                      onCheckedChange={() => toggleColumn(col.key)}
                      disabled={!col.hideable}
                      className="scale-75"
                    />
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {selected.length > 0 && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9 rounded-lg ml-auto" onClick={() => setSelected([])}>
              {selected.length} selected <X className="w-3 h-3" />
            </Button>
          )}
        </div>

        {/* Active filter chips */}
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {activeFilters.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary/5 border border-primary/20 text-xs font-medium text-primary">
                {f.label}
                <button onClick={f.onRemove} className="hover:text-primary/70"><X className="w-3 h-3" /></button>
              </span>
            ))}
            <button onClick={() => { setSiteFilter(null); setDateRange({}); setSortBy("newest"); }} className="text-xs text-muted-foreground hover:text-foreground underline">Clear all</button>
          </div>
        )}

        {/* ── TABLE ── */}
        <div className="bg-card rounded-xl border border-border/40 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-[68px] w-full rounded-lg" />
              ))}
            </div>
          ) : isMobile ? (
            <MobileCardList
              orders={paginatedOrders} itemsByOrder={itemsByOrder} selected={selected}
              toggleSelect={toggleSelect} navigate={navigate} getSuccessRate={getSuccessRate}
              isNew={isNew} copyToClipboard={copyToClipboard} activeTab={activeTab}
              onRowClick={(id: string) => setDrawerOrderId(id)}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-muted/60 backdrop-blur-sm z-10">
                  <tr className="border-b border-border/60">
                    <th className="px-3 py-3 text-left w-10">
                      <Checkbox checked={paginatedOrders.length > 0 && selected.length === paginatedOrders.length} onCheckedChange={toggleAll} />
                    </th>
                    {visibleTableCols.map((h) => (
                      <th key={h.key} className={cn("px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground", h.w)}>
                        {h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedOrders.map((order, idx) => {
                    const customer = order.customers as any;
                    const items = itemsByOrder.get(order.id) || [];
                    const sr = getSuccessRate(customer);
                    const isSelected = selected.includes(order.id);
                    const isBlocked = customer?.is_blocked;
                    const isDuplicate = customer?.phone && (phoneCounts.get(customer.phone) || 0) > 1;
                    const riskFlags = customer?.risk_flags || [];
                    const riskScore = (isBlocked ? 40 : 0) + (riskFlags.includes("high_return") ? 30 : 0) + (riskFlags.includes("frequent_cancel") ? 20 : 0) + (isDuplicate ? 10 : 0) + (sr.percent < 50 && !sr.noData ? 20 : 0);

                    return (
                      <tr
                        key={order.id}
                        onClick={(e) => handleRowClick(e, order.id)}
                        className={cn(
                          "group border-b border-border/20 transition-all duration-150 cursor-pointer",
                          isSelected ? "bg-primary/5" : isBlocked ? "bg-destructive/5" : idx % 2 === 1 ? "bg-muted/15" : "",
                          "hover:bg-accent/40",
                          drawerOrderId === order.id && "ring-1 ring-primary/30 bg-primary/5"
                        )}
                        style={{ height: "68px" }}
                      >
                        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(order.id)} />
                        </td>

                        {/* Order Info — always visible */}
                        {isColVisible("orderInfo") && (
                          <td className="px-3 py-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <button onClick={(e) => { e.stopPropagation(); navigate(`/web-orders/${order.id}`); }} className="text-[13px] font-bold text-primary hover:underline">#{order.order_number}</button>
                                {isNew(order.created_at) && <span className="text-[8px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full animate-pulse">NEW</span>}
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                {new Date(order.created_at || "").toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}{" "}
                                <span className="text-muted-foreground/60">{new Date(order.created_at || "").toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                              </p>
                            </div>
                          </td>
                        )}

                        {/* Customer — always visible */}
                        {isColVisible("customer") && (
                          <td className="px-3 py-3">
                            <div className="space-y-0.5 min-w-[170px]">
                              <div className="flex items-center gap-1.5">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button onClick={(e) => { e.stopPropagation(); customer?.phone && copyToClipboard(customer.phone); }} className="text-[13px] font-bold text-foreground hover:text-primary transition-colors">{customer?.phone || "—"}</button>
                                  </TooltipTrigger>
                                  <TooltipContent>Click to copy</TooltipContent>
                                </Tooltip>
                                {customer?.phone && (
                                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <a href={`tel:${customer.phone}`} onClick={(e) => e.stopPropagation()} className="p-1 rounded text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30"><Phone className="w-3 h-3" /></a>
                                    <a href={`https://wa.me/${customer.phone?.replace(/[^0-9]/g, "")}`} onClick={(e) => e.stopPropagation()} target="_blank" rel="noopener noreferrer" className="p-1 rounded text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"><MessageCircle className="w-3 h-3" /></a>
                                  </div>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                                {customer?.full_name || "—"}
                                {isBlocked && <span className="ml-1 text-[8px] font-bold text-destructive">🚫 BLOCKED</span>}
                              </p>
                            </div>
                          </td>
                        )}

                        {/* Items — always visible */}
                        {isColVisible("items") && (
                          <td className="px-3 py-3">
                            <div className="space-y-1 min-w-[130px]">
                              {items.slice(0, 2).map((item) => {
                                const product = item.products as any;
                                return (
                                  <div key={item.id} className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-md bg-muted/60 flex items-center justify-center overflow-hidden flex-shrink-0 border border-border/30">
                                      {product?.image_url ? <img src={product.image_url} alt="" className="w-full h-full object-cover" loading="lazy" /> : <ShoppingBag className="w-3 h-3 text-muted-foreground" />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-[11px] font-semibold text-foreground truncate max-w-[80px]">{product?.sku || "-"}</p>
                                      <span className="text-[10px] text-muted-foreground">{formatBDT(item.unit_price)} ×{item.quantity}</span>
                                    </div>
                                  </div>
                                );
                              })}
                              {items.length > 2 && <span className="text-[10px] text-primary font-medium">+{items.length - 2} more</span>}
                              {items.length === 0 && <span className="text-[10px] text-muted-foreground italic">No items</span>}
                            </div>
                          </td>
                        )}

                        {/* Value */}
                        {isColVisible("value") && (
                          <td className="px-3 py-3">
                            <span className="text-[13px] font-bold text-emerald-600 dark:text-emerald-400">{formatBDT(order.total_amount || 0)}</span>
                          </td>
                        )}

                        {/* District */}
                        {isColVisible("district") && (
                          <td className="px-3 py-3">
                            <div>
                              <span className="text-[12px] text-foreground">{customer?.district || "—"}</span>
                              {customer?.thana && <p className="text-[10px] text-muted-foreground">{customer.thana}</p>}
                            </div>
                          </td>
                        )}

                        {/* Risk */}
                        {isColVisible("risk") && (
                          <td className="px-3 py-3">
                            {riskScore > 0 ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className={cn(
                                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold",
                                    riskScore >= 60 ? "bg-destructive/10 text-destructive border border-destructive/20" :
                                    riskScore >= 30 ? "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800" :
                                    "bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800"
                                  )}>
                                    <AlertTriangle className="w-3 h-3" />
                                    {riskScore >= 60 ? "HIGH" : riskScore >= 30 ? "MED" : "LOW"}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="text-xs space-y-0.5">
                                  <p className="font-semibold">Risk: {riskScore}</p>
                                  {isBlocked && <p>🚫 Blocked</p>}
                                  {isDuplicate && <p>📋 Duplicate phone</p>}
                                  {riskFlags.includes("high_return") && <p>↩️ High returns</p>}
                                  {riskFlags.includes("frequent_cancel") && <p>❌ Cancels</p>}
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">✅ OK</span>
                            )}
                          </td>
                        )}

                        {/* Success Rate */}
                        {isColVisible("successRate") && (
                          <td className="px-3 py-3">
                            {sr.loading ? (
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full border-2 border-muted animate-pulse" />
                                <div className="space-y-1">
                                  <Skeleton className="h-3 w-20" />
                                  <Skeleton className="h-3 w-16" />
                                </div>
                              </div>
                            ) : sr.isNew ? (
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full border-2 border-blue-300 dark:border-blue-700 flex items-center justify-center">
                                  <span className="text-[7px] font-bold text-blue-400">NEW</span>
                                </div>
                                <div className="text-[10px] text-muted-foreground leading-relaxed">
                                  <div>New Customer</div>
                                  <div>No history</div>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <SuccessRing percent={sr.percent} size={36} />
                                <div className="text-[10px] leading-relaxed">
                                  <div>
                                    Success:{" "}
                                    <span className="font-semibold" style={{ color: sr.percent >= 80 ? "#22c55e" : sr.percent >= 60 ? "#f97316" : "#ef4444" }}>
                                      {sr.percent}%
                                    </span>
                                  </div>
                                  <div className="text-muted-foreground">
                                    Order: <span className="text-foreground">{sr.delivered}/{sr.total}</span>
                                  </div>
                                  <div className="text-muted-foreground">
                                    Rating: <span className="text-foreground">{sr.rating}</span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </td>
                        )}

                        {/* Site */}
                        {isColVisible("site") && (
                          <td className="px-3 py-3">
                            {order.channel === "shopify" ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full">🛍️</span>
                            ) : (
                              <span className="inline-flex items-center text-[10px] font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded-full capitalize">{order.channel}</span>
                            )}
                          </td>
                        )}

                        {/* Actions — always visible */}
                        {isColVisible("actions") && (
                          <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              <Button size="sm" variant="ghost" className="h-7 px-2.5 text-[11px] font-semibold text-primary gap-1" onClick={() => navigate(`/web-orders/${order.id}`)}>
                                Open <ExternalLink className="w-3 h-3" />
                              </Button>
                              <DropdownMenuRoot>
                                <DDTrigger asChild>
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <MoreVertical className="w-3.5 h-3.5" />
                                  </Button>
                                </DDTrigger>
                                <DDContent align="end">
                                  <DDItem onClick={() => navigate(`/web-orders/${order.id}`)}><ExternalLink className="w-3.5 h-3.5 mr-2" /> View Detail</DDItem>
                                  {customer?.phone && <DDItem onClick={() => copyToClipboard(customer.phone)}><Copy className="w-3.5 h-3.5 mr-2" /> Copy Phone</DDItem>}
                                  <DropdownMenuSeparator />
                                  <DDItem onClick={() => { setSelected([order.id]); bulkMutation.mutate("confirm"); }} className="text-emerald-600"><CheckCheck className="w-3.5 h-3.5 mr-2" /> Confirm</DDItem>
                                  <DDItem onClick={() => { setSelected([order.id]); bulkMutation.mutate("cancel"); }} className="text-destructive"><Ban className="w-3.5 h-3.5 mr-2" /> Cancel</DDItem>
                                  <DDItem onClick={() => markSuspicious.mutate(order.id)} className="text-amber-600"><ShieldAlert className="w-3.5 h-3.5 mr-2" /> Suspicious</DDItem>
                                </DDContent>
                              </DropdownMenuRoot>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {paginatedOrders.length === 0 && (
                    <tr><td colSpan={visibleTableCols.length + 1}><EmptyState tab={activeTab} /></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!isLoading && filtered.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/40 bg-muted/20">
              <p className="text-xs text-muted-foreground">
                Showing {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}
              </p>
              <div className="flex items-center gap-2">
                <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                  <SelectTrigger className="h-8 w-[70px] text-xs rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>{PAGE_SIZES.map((s) => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}</SelectContent>
                </Select>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0 text-xs rounded-lg" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</Button>
                  <span className="text-xs text-muted-foreground px-2">{page}/{totalPages}</span>
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0 text-xs rounded-lg" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>›</Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── FLOATING BULK ACTION BAR (Dark slate) ── */}
        {selected.length > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-800 dark:bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-700/50 px-5 py-3 flex items-center gap-3 flex-wrap max-w-[95vw] animate-slide-up">
            <div className="flex items-center gap-2 pr-3 border-r border-slate-600">
              <span className="text-sm font-bold">{selected.length}</span>
              <span className="text-xs text-slate-300">selected</span>
              <button onClick={() => setSelected([])} className="w-5 h-5 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center">
                <X className="w-3 h-3 text-slate-300" />
              </button>
            </div>
            <Button size="sm" className="gap-1.5 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white border-0" onClick={() => bulkMutation.mutate("confirm")} disabled={bulkMutation.isPending}>
              <CheckCheck className="w-3.5 h-3.5" /> Confirm
            </Button>
            <Button size="sm" className="gap-1.5 text-xs rounded-lg bg-red-600 hover:bg-red-500 text-white border-0" onClick={() => bulkMutation.mutate("cancel")} disabled={bulkMutation.isPending}>
              <Ban className="w-3.5 h-3.5" /> Cancel
            </Button>
            <DropdownMenuRoot>
              <DDTrigger asChild>
                <Button size="sm" className="gap-1.5 text-xs rounded-lg bg-slate-700 hover:bg-slate-600 text-white border-0">Move to...</Button>
              </DDTrigger>
              <DDContent side="top" className="mb-2">
                {WEB_STATUSES.filter((s) => s.key !== "all").map((s) => {
                  const Icon = s.icon;
                  return <DDItem key={s.key} onClick={() => bulkMutation.mutate(s.key)}><Icon className="w-3.5 h-3.5 mr-1.5" /> {s.label}</DDItem>;
                })}
              </DDContent>
            </DropdownMenuRoot>
            <Button size="sm" className="gap-1.5 text-xs rounded-lg bg-slate-700 hover:bg-slate-600 text-white border-0">
              <Download className="w-3.5 h-3.5" /> Export
            </Button>
          </div>
        )}

        {/* ── QUICK DETAIL DRAWER ── */}
        <Sheet open={!!drawerOrderId} onOpenChange={(open) => !open && setDrawerOrderId(null)}>
          <SheetContent side="right" className={cn("p-0 border-l border-border/60", isMobile ? "w-full" : "w-[480px] sm:max-w-[480px]")}>
            {drawerOrder && (
              <OrderQuickDrawer
                order={drawerOrder}
                items={itemsByOrder.get(drawerOrder.id) || []}
                getSuccessRate={getSuccessRate}
                latestNote={latestNotes instanceof Map ? latestNotes.get(drawerOrder.id) : undefined}
                onClose={() => setDrawerOrderId(null)}
                onOpenFull={() => { setDrawerOrderId(null); navigate(`/web-orders/${drawerOrder.id}`); }}
                onConfirm={() => { setSelected([drawerOrder.id]); bulkMutation.mutate("confirm"); setDrawerOrderId(null); }}
                onCancel={() => { setSelected([drawerOrder.id]); bulkMutation.mutate("cancel"); setDrawerOrderId(null); }}
                copyToClipboard={copyToClipboard}
              />
            )}
          </SheetContent>
        </Sheet>
      </div>
    </TooltipProvider>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ORDER QUICK DETAIL DRAWER
   ═══════════════════════════════════════════════════════════════ */

function OrderQuickDrawer({ order, items, getSuccessRate, latestNote, onClose, onOpenFull, onConfirm, onCancel, copyToClipboard }: {
  order: any; items: any[]; getSuccessRate: (c: any) => any; latestNote: any;
  onClose: () => void; onOpenFull: () => void; onConfirm: () => void; onCancel: () => void;
  copyToClipboard: (t: string) => void;
}) {
  const customer = order.customers as any;
  const sr = getSuccessRate(customer);
  const statusLabel = WEB_STATUSES.find((s) => s.key === (order.web_order_status || "processing"));

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border/40 bg-muted/30">
        <SheetHeader className="mb-0">
          <SheetTitle className="flex items-center gap-2 text-lg">
            #{order.order_number}
            {statusLabel && (
              <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full text-white", statusLabel.bg)}>
                {statusLabel.label}
              </span>
            )}
          </SheetTitle>
        </SheetHeader>
        <p className="text-xs text-muted-foreground mt-1">{formatDateTime(order.created_at)}</p>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-5 py-4 space-y-5">

          {/* Customer Info */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Customer</h3>
            <div className="bg-muted/30 rounded-lg p-3 space-y-2">
              {customer?.phone && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-sm font-semibold">{customer.phone}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => copyToClipboard(customer.phone)} className="p-1 rounded hover:bg-muted"><Copy className="w-3 h-3 text-muted-foreground" /></button>
                    <a href={`tel:${customer.phone}`} className="p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-950/30"><Phone className="w-3 h-3 text-blue-500" /></a>
                    <a href={`https://wa.me/${customer.phone?.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-emerald-50 dark:hover:bg-emerald-950/30"><MessageCircle className="w-3 h-3 text-emerald-500" /></a>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-sm text-foreground">{customer?.full_name || "—"}</span>
              </div>
              {customer?.address && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground mt-0.5" />
                  <p className="text-xs text-muted-foreground leading-relaxed">{customer.address}</p>
                </div>
              )}
              {customer?.district && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{customer.district}</span>
                  {customer.thana && <><span>•</span><span>{customer.thana}</span></>}
                </div>
              )}
            </div>
          </div>

          {/* Success Rate */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Success Rate</h3>
            <div className="flex items-center gap-3 bg-muted/30 rounded-lg p-3">
              {sr.isNew ? (
                <>
                  <div className="w-12 h-12 rounded-full border-2 border-blue-300 dark:border-blue-700 flex items-center justify-center">
                    <span className="text-[9px] font-bold text-blue-400">NEW</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-blue-500">New Customer</p>
                    <p className="text-xs text-muted-foreground">No delivery history</p>
                  </div>
                </>
              ) : (
                <>
                  <SuccessRing percent={sr.percent} size={48} />
                  <div>
                    <p className="text-lg font-bold" style={{ color: sr.percent >= 80 ? "#22c55e" : sr.percent >= 60 ? "#f97316" : "#ef4444" }}>{sr.percent}%</p>
                    <p className="text-xs text-muted-foreground">{sr.delivered}/{sr.total} delivered</p>
                    <p className="text-xs text-muted-foreground">Rating: {sr.rating}</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Order Items */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Items ({items.length})</h3>
            <div className="space-y-2">
              {items.map((item) => {
                const product = item.products as any;
                return (
                  <div key={item.id} className="flex items-center gap-3 bg-muted/30 rounded-lg p-2.5">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0 border border-border/30">
                      {product?.image_url ? <img src={product.image_url} alt="" className="w-full h-full object-cover" loading="lazy" /> : <ShoppingBag className="w-4 h-4 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{product?.name || product?.sku || "Item"}</p>
                      <p className="text-[11px] text-muted-foreground">{product?.sku}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold">{formatBDT(item.unit_price)}</p>
                      <p className="text-[10px] text-muted-foreground">×{item.quantity}</p>
                    </div>
                  </div>
                );
              })}
              {items.length === 0 && <p className="text-xs text-muted-foreground italic py-2">No items</p>}
            </div>
            <Separator />
            <div className="flex items-center justify-between pt-1">
              <span className="text-sm font-semibold">Total</span>
              <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{formatBDT(order.total_amount || 0)}</span>
            </div>
          </div>

          {/* Notes */}
          {latestNote && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Latest Note</h3>
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-sm">{latestNote.content || latestNote.note || "—"}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{formatDateTime(latestNote.created_at)}</p>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer Actions */}
      <div className="px-5 py-3 border-t border-border/40 bg-muted/20 flex items-center gap-2">
        <Button size="sm" className="gap-1.5 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex-1" onClick={onConfirm}>
          <CheckCheck className="w-3.5 h-3.5" /> Confirm
        </Button>
        <Button size="sm" variant="destructive" className="gap-1.5 text-xs rounded-lg flex-1" onClick={onCancel}>
          <Ban className="w-3.5 h-3.5" /> Cancel
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs rounded-lg" onClick={onOpenFull}>
          <ExternalLink className="w-3.5 h-3.5" /> Full Detail
        </Button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SHARED SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

function KpiCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number | null; color: string }) {
  const colorMap: Record<string, string> = { blue: "text-blue-500", orange: "text-orange-500", emerald: "text-emerald-500", purple: "text-purple-500" };
  const bgMap: Record<string, string> = { blue: "bg-blue-50 dark:bg-blue-950/20", orange: "bg-orange-50 dark:bg-orange-950/20", emerald: "bg-emerald-50 dark:bg-emerald-950/20", purple: "bg-purple-50 dark:bg-purple-950/20" };
  return (
    <Card className="p-3.5 border-border/40 hover:shadow-sm transition-shadow">
      <div className="flex items-center gap-3">
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", bgMap[color])}><Icon className={cn("w-4 h-4", colorMap[color])} /></div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-muted-foreground font-medium">{label}</p>
          {value === null ? <Skeleton className="h-5 w-16 mt-0.5 rounded" /> : <p className="text-lg font-bold text-foreground tracking-tight">{value}</p>}
        </div>
      </div>
    </Card>
  );
}

function SuccessRing({ percent, size = 36 }: { percent: number; size?: number }) {
  const r = (size - 4) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  const strokeColor = percent >= 80 ? "#22c55e" : percent >= 60 ? "#f97316" : "#ef4444";
  return (
    <svg width={size} height={size} className="flex-shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="3" className="stroke-muted" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="3" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" stroke={strokeColor} className="transition-all duration-500" style={{ transform: "rotate(-90deg)", transformOrigin: "center" }} />
    </svg>
  );
}

function MobileCardList({ orders, itemsByOrder, selected, toggleSelect, navigate, getSuccessRate, isNew, copyToClipboard, activeTab, onRowClick }: any) {
  if (orders.length === 0) return <EmptyState tab={activeTab} />;
  return (
    <div className="divide-y divide-border/30">
      {orders.map((order: any) => {
        const customer = order.customers as any;
        const items = itemsByOrder.get(order.id) || [];
        const isSelected = selected.includes(order.id);
        const firstItem = items[0];
        const product = firstItem?.products as any;
        return (
          <div key={order.id} onClick={() => onRowClick(order.id)} className={cn("p-4 space-y-2.5 transition-colors cursor-pointer", isSelected ? "bg-primary/5" : "hover:bg-muted/30 active:bg-muted/50")}>
            <div className="flex items-start gap-3">
              <div onClick={(e) => e.stopPropagation()}><Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(order.id)} className="mt-1" /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-primary">#{order.order_number}</span>
                    {isNew(order.created_at) && <span className="text-[8px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">NEW</span>}
                  </div>
                  <span className="text-sm font-bold text-emerald-600">{formatBDT(order.total_amount || 0)}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">{formatDateTime(order.created_at)}</p>
              </div>
            </div>
            <div className="ml-7 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{customer?.full_name || "—"}</span>
                <span className="text-xs text-muted-foreground">{customer?.phone}</span>
              </div>
              {firstItem && (
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center overflow-hidden border border-border/40">
                    {product?.image_url ? <img src={product.image_url} alt="" className="w-full h-full object-cover" /> : <ShoppingBag className="w-3 h-3 text-muted-foreground" />}
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold">{product?.sku || "-"}</p>
                    <p className="text-[10px] text-muted-foreground">{formatBDT(firstItem.unit_price)} ×{firstItem.quantity}</p>
                  </div>
                  {items.length > 1 && <span className="text-[10px] text-muted-foreground">+{items.length - 1} more</span>}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EmptyState({ tab }: { tab: string }) {
  const messages: Record<string, { icon: string; title: string; desc: string }> = {
    processing: { icon: "⏳", title: "No orders to process", desc: "New Shopify orders will appear here automatically" },
    good_but_no_response: { icon: "📞", title: "No pending good orders", desc: "Orders marked as good but awaiting response" },
    no_response: { icon: "📵", title: "No unresponsive orders", desc: "No customers unresponsive at the moment" },
    on_hold: { icon: "⏸️", title: "Nothing on hold", desc: "No orders are currently paused" },
    advance_payment: { icon: "💰", title: "No advance payments", desc: "Orders awaiting advance payment" },
    cancel: { icon: "🚫", title: "No cancellations", desc: "Great! No cancelled web orders" },
    confirm: { icon: "✅", title: "No confirmed orders", desc: "Confirmed orders move to the main pipeline" },
    all: { icon: "📋", title: "No web orders yet", desc: "Connect Shopify or create manual web orders" },
  };
  const msg = messages[tab] || messages.all;
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span className="text-4xl mb-3">{msg.icon}</span>
      <p className="text-sm font-semibold text-foreground">{msg.title}</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">{msg.desc}</p>
    </div>
  );
}
