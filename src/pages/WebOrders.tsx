import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { formatBDT, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Search, Phone, MessageCircle, ExternalLink, Radio, ClipboardList, Clock,
  CheckCircle2, PhoneOff, Pause, Wallet, XCircle, CircleCheck, Download,
  Filter, X, CalendarDays, ArrowUpDown, MapPin, Copy, StickyNote, ShoppingBag,
  CheckCheck, Ban,
} from "lucide-react";
import { useBDCourierBulk, getSuccessColor } from "@/hooks/use-bd-courier";
import {
  DropdownMenu as DropdownMenuRoot,
  DropdownMenuContent as DDContent,
  DropdownMenuItem as DDItem,
  DropdownMenuTrigger as DDTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";

const WEB_STATUSES = [
  { key: "processing", label: "Processing", icon: Clock, badgeColor: "bg-orange-500", dotColor: "bg-orange-400" },
  { key: "good_but_no_response", label: "Good", icon: CheckCircle2, badgeColor: "bg-emerald-500", dotColor: "bg-emerald-400" },
  { key: "no_response", label: "No Response", icon: PhoneOff, badgeColor: "bg-slate-500", dotColor: "bg-slate-400" },
  { key: "on_hold", label: "On Hold", icon: Pause, badgeColor: "bg-amber-500", dotColor: "bg-amber-400" },
  { key: "advance_payment", label: "Advance", icon: Wallet, badgeColor: "bg-blue-500", dotColor: "bg-blue-400" },
  { key: "cancel", label: "Cancel", icon: XCircle, badgeColor: "bg-red-500", dotColor: "bg-red-400" },
  { key: "confirm", label: "Confirm", icon: CircleCheck, badgeColor: "bg-emerald-600", dotColor: "bg-emerald-500" },
  { key: "all", label: "All", icon: ClipboardList, badgeColor: "bg-slate-700", dotColor: "bg-slate-500" },
] as const;

const SORT_OPTIONS = [
  { key: "newest", label: "Newest First" },
  { key: "oldest", label: "Oldest First" },
  { key: "success_rate", label: "Success Rate" },
];

export default function WebOrdersPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState("processing");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [lastSynced, setLastSynced] = useState<Date>(new Date());
  const [sortBy, setSortBy] = useState("newest");
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [siteFilter, setSiteFilter] = useState<string | null>(null);
  const [syncCountdown, setSyncCountdown] = useState(0);

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

  useEffect(() => {
    const channel = supabase
      .channel("web-orders-realtime")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "orders",
        filter: "channel=eq.shopify",
      }, (payload) => {
        toast({ title: "🛍️ নতুন Shopify Order এসেছে!", description: `Order: ${(payload.new as any).order_number}` });
        setLastSynced(new Date());
        queryClient.invalidateQueries({ queryKey: ["web-orders"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient, toast]);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["web-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, customers(full_name, phone, address, district, thana, total_orders, total_spent, segment)")
        .not("web_order_status", "is", null)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  const customerPhones = useMemo(() => {
    if (!orders) return [];
    return orders.map((o) => (o.customers as any)?.phone).filter(Boolean) as string[];
  }, [orders]);

  const { data: bdCourierData, isLoading: bdLoading } = useBDCourierBulk(customerPhones, customerPhones.length > 0);

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

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0 };
    const values: Record<string, number> = { all: 0 };
    WEB_STATUSES.forEach((s) => { if (s.key !== "all") { counts[s.key] = 0; values[s.key] = 0; } });
    orders?.forEach((o) => {
      counts.all++;
      values.all += Number(o.total_amount || 0);
      const st = o.web_order_status || "processing";
      if (counts[st] !== undefined) {
        counts[st]++;
        values[st] += Number(o.total_amount || 0);
      }
    });
    return { counts, values };
  }, [orders]);

  const filtered = useMemo(() => {
    let list = orders || [];
    if (activeTab !== "all") {
      list = list.filter((o) => (o.web_order_status || "processing") === activeTab);
    }
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((o) =>
        o.order_number?.toLowerCase().includes(s) ||
        (o.customers as any)?.full_name?.toLowerCase().includes(s) ||
        (o.customers as any)?.phone?.includes(s)
      );
    }
    if (siteFilter) {
      list = list.filter((o) => o.channel === siteFilter);
    }
    if (dateRange.from) {
      list = list.filter((o) => new Date(o.created_at || "") >= dateRange.from!);
    }
    if (dateRange.to) {
      const endOfDay = new Date(dateRange.to);
      endOfDay.setHours(23, 59, 59, 999);
      list = list.filter((o) => new Date(o.created_at || "") <= endOfDay);
    }
    // Sort
    if (sortBy === "oldest") {
      list = [...list].sort((a, b) => new Date(a.created_at || "").getTime() - new Date(b.created_at || "").getTime());
    }
    return list;
  }, [orders, activeTab, search, siteFilter, dateRange, sortBy]);

  const bulkMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const { error } = await supabase
        .from("orders")
        .update({ web_order_status: newStatus })
        .in("id", selected);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: `${selected.length} orders updated` });
      setSelected([]);
      queryClient.invalidateQueries({ queryKey: ["web-orders"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };
  const toggleAll = () => {
    if (selected.length === filtered.length) setSelected([]);
    else setSelected(filtered.map((o) => o.id));
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const isNew = (dateStr: string | null) => {
    if (!dateStr) return false;
    return Date.now() - new Date(dateStr).getTime() < 2 * 60 * 60 * 1000;
  };

  const getSuccessRate = (customer: any) => {
    if (!customer?.phone) return { percent: 0, delivered: 0, total: 0, rating: 0, loading: false, noData: true };
    const bdData = bdCourierData?.[customer.phone];
    if (!bdData || bdData.error) {
      return { percent: 0, delivered: 0, total: 0, rating: 0, loading: bdLoading, noData: !bdData };
    }
    const percent = bdData.success_rate || 0;
    const total = bdData.total_orders || 0;
    const delivered = bdData.successful_orders || 0;
    const rating = percent >= 90 ? 5 : percent >= 70 ? 4 : percent >= 50 ? 3 : percent >= 30 ? 2 : 1;
    return { percent, delivered, total, rating, loading: false, noData: false };
  };

  const activeFilters: { label: string; onRemove: () => void }[] = [];
  if (siteFilter) activeFilters.push({ label: `Site: ${siteFilter}`, onRemove: () => setSiteFilter(null) });
  if (dateRange.from) activeFilters.push({ label: `From: ${format(dateRange.from, "dd MMM")}`, onRemove: () => setDateRange((r) => ({ ...r, from: undefined })) });
  if (dateRange.to) activeFilters.push({ label: `To: ${format(dateRange.to, "dd MMM")}`, onRemove: () => setDateRange((r) => ({ ...r, to: undefined })) });
  if (sortBy !== "newest") activeFilters.push({ label: `Sort: ${SORT_OPTIONS.find((s) => s.key === sortBy)?.label}`, onRemove: () => setSortBy("newest") });

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4 animate-fade-in">
        {/* ═══ Sticky Header ═══ */}
        <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl -mx-6 px-6 py-4 border-b border-border/50">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Web Orders</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Website & Shopify orders — verify via phone call</p>
            </div>
            <div className="flex items-center gap-2">
              {/* Export */}
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9 rounded-xl">
                <Download className="w-3.5 h-3.5" /> Export
              </Button>
              {/* Live Sync */}
              {shopifyConnected && (
                <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200/60 rounded-xl px-3.5 py-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                  <span className="text-xs font-semibold text-emerald-700">Live Sync</span>
                  <span className="text-[10px] text-emerald-600/70 font-medium">{syncAgoText}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ═══ Status Tab Bar ═══ */}
        <div className="overflow-x-auto pb-1 -mx-1 px-1">
          <div className="inline-flex items-center gap-1 p-1 bg-muted/50 rounded-2xl border border-border/40">
            {WEB_STATUSES.map((s) => {
              const Icon = s.icon;
              const isActive = activeTab === s.key;
              const count = statusCounts.counts[s.key] || 0;
              return (
                <Tooltip key={s.key}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => { setActiveTab(s.key); setSelected([]); }}
                      className={cn(
                        "relative flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap",
                        "transition-all duration-300 ease-out",
                        isActive
                          ? "bg-card text-foreground shadow-sm border border-border/60"
                          : "text-muted-foreground hover:text-foreground hover:bg-card/50"
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" strokeWidth={isActive ? 2.2 : 1.8} />
                      <span>{s.label}</span>
                      {count > 0 && (
                        <span className={cn(
                          "ml-0.5 text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full inline-flex items-center justify-center transition-all duration-300",
                          isActive
                            ? cn(s.badgeColor, "text-white shadow-sm")
                            : "bg-muted text-muted-foreground"
                        )}>
                          {count}
                        </span>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    <p>{s.label}: {count} orders</p>
                    <p className="text-muted-foreground">{formatBDT(statusCounts.values[s.key] || 0)}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>

        {/* ═══ Search & Filters ═══ */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by phone, name, order ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-10 rounded-xl"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Date Range */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("gap-1.5 text-xs h-10 rounded-xl", dateRange.from && "border-primary text-primary")}>
                <CalendarDays className="w-3.5 h-3.5" />
                {dateRange.from ? `${format(dateRange.from, "dd MMM")}${dateRange.to ? ` - ${format(dateRange.to, "dd MMM")}` : ""}` : "Date Range"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={dateRange.from ? { from: dateRange.from, to: dateRange.to } : undefined}
                onSelect={(range) => setDateRange({ from: range?.from, to: range?.to })}
                className="p-3 pointer-events-auto"
                numberOfMonths={1}
              />
            </PopoverContent>
          </Popover>

          {/* Site filter */}
          <DropdownMenuRoot>
            <DDTrigger asChild>
              <Button variant="outline" size="sm" className={cn("gap-1.5 text-xs h-10 rounded-xl", siteFilter && "border-primary text-primary")}>
                <Filter className="w-3.5 h-3.5" /> {siteFilter ? siteFilter : "Site"}
              </Button>
            </DDTrigger>
            <DDContent align="start">
              <DDItem onClick={() => setSiteFilter(null)}>All Sites</DDItem>
              <DDItem onClick={() => setSiteFilter("shopify")}>🛍️ Shopify</DDItem>
              <DDItem onClick={() => setSiteFilter("manual")}>✍️ Manual</DDItem>
            </DDContent>
          </DropdownMenuRoot>

          {/* Sort */}
          <DropdownMenuRoot>
            <DDTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-10 rounded-xl">
                <ArrowUpDown className="w-3.5 h-3.5" /> Sort
              </Button>
            </DDTrigger>
            <DDContent align="start">
              {SORT_OPTIONS.map((opt) => (
                <DDItem key={opt.key} onClick={() => setSortBy(opt.key)} className={cn(sortBy === opt.key && "font-semibold")}>
                  {opt.label}
                </DDItem>
              ))}
            </DDContent>
          </DropdownMenuRoot>

          {/* Bulk actions inline when selected */}
          {selected.length > 0 && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-10 rounded-xl ml-auto" onClick={() => setSelected([])}>
              {selected.length} selected <X className="w-3 h-3" />
            </Button>
          )}
        </div>

        {/* Active Filters Chips */}
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {activeFilters.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/5 border border-primary/20 text-xs font-medium text-primary">
                {f.label}
                <button onClick={f.onRemove} className="hover:text-primary/70"><X className="w-3 h-3" /></button>
              </span>
            ))}
            <button
              onClick={() => { setSiteFilter(null); setDateRange({}); setSortBy("newest"); }}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Clear all
            </button>
          </div>
        )}

        {/* ═══ Table / Cards ═══ */}
        <div className="bg-card rounded-2xl border border-border/40 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-[72px] w-full rounded-xl" />
              ))}
            </div>
          ) : isMobile ? (
            /* ─── Mobile Card View ─── */
            <div className="divide-y divide-border/40">
              {filtered.map((order) => {
                const customer = order.customers as any;
                const items = itemsByOrder.get(order.id) || [];
                const sr = getSuccessRate(customer);
                const isSelected = selected.includes(order.id);
                const firstItem = items[0];
                const product = firstItem?.products as any;

                return (
                  <div
                    key={order.id}
                    className={cn(
                      "p-4 space-y-3 transition-colors",
                      isSelected ? "bg-primary/5" : "hover:bg-muted/30"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(order.id)} className="mt-1" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-foreground">#{order.order_number}</span>
                          <div className="flex items-center gap-1.5">
                            {isNew(order.created_at) && (
                              <span className="text-[9px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">NEW</span>
                            )}
                            {order.channel === "shopify" && (
                              <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">🛍️ Shopify</span>
                            )}
                            {(order as any).needs_address_review && (
                              <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">⚠️ Address</span>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{formatDateTime(order.created_at)}</p>
                      </div>
                    </div>

                    <div className="ml-7 space-y-2">
                      {/* Customer */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{customer?.full_name || "—"}</span>
                        <span className="text-xs text-muted-foreground">{customer?.phone}</span>
                      </div>

                      {/* Product */}
                      {firstItem && (
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center overflow-hidden border border-border/60">
                            {product?.image_url ? (
                              <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <ShoppingBag className="w-3.5 h-3.5 text-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-primary">{product?.sku || "-"}</p>
                            <p className="text-[11px] text-muted-foreground">{formatBDT(firstItem.unit_price)} × {firstItem.quantity}</p>
                          </div>
                          {items.length > 1 && <span className="text-[10px] text-muted-foreground">+{items.length - 1} more</span>}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-1">
                        {customer?.phone && (
                          <>
                            <a href={`tel:${customer.phone}`} className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium"><Phone className="w-3 h-3" /> Call</a>
                            <a href={`https://wa.me/${customer.phone?.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium"><MessageCircle className="w-3 h-3" /> WhatsApp</a>
                          </>
                        )}
                        <button onClick={() => navigate(`/web-orders/${order.id}`)} className="inline-flex items-center gap-1 text-xs text-primary font-semibold ml-auto">
                          Open <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <EmptyState tab={activeTab} />
              )}
            </div>
          ) : (
            /* ─── Desktop Table ─── */
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="px-4 py-3 text-left w-12">
                      <Checkbox
                        checked={filtered.length > 0 && selected.length === filtered.length}
                        onCheckedChange={toggleAll}
                      />
                    </th>
                    {["Created At", "Customer", "Note", "Order Items", "Success Rate", "Tags", "Site", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((order, idx) => {
                    const customer = order.customers as any;
                    const items = itemsByOrder.get(order.id) || [];
                    const note = latestNotes instanceof Map ? latestNotes.get(order.id) : null;
                    const sr = getSuccessRate(customer);
                    const tags = (order as any).tags || [];
                    const isSelected = selected.includes(order.id);
                    const isRepeat = (customer?.total_orders || 0) > 1;

                    return (
                      <tr
                        key={order.id}
                        className={cn(
                          "group border-b border-border/30 transition-all duration-200",
                          isSelected
                            ? "bg-primary/5"
                            : idx % 2 === 1 ? "bg-muted/20" : "",
                          "hover:bg-muted/40 hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)]"
                        )}
                        style={{ height: '72px' }}
                      >
                        <td className="px-4 py-3">
                          <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(order.id)} />
                        </td>

                        {/* ── Created At ── */}
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <p className="text-[13px] font-semibold text-foreground whitespace-nowrap">
                                {new Date(order.created_at || "").toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                              </p>
                              <span className="text-[11px] text-muted-foreground">
                                {new Date(order.created_at || "").toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                              {isNew(order.created_at) && (
                                <span className="text-[8px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full animate-pulse-subtle">NEW</span>
                              )}
                              {(order as any).needs_address_review && (
                                <span className="text-[8px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">⚠️</span>
                              )}
                            </div>
                            <button
                              onClick={() => navigate(`/web-orders/${order.id}`)}
                              className="text-[11px] text-primary font-mono hover:underline"
                            >
                              #{order.order_number}
                            </button>
                          </div>
                        </td>

                        {/* ── Customer ── */}
                        <td className="px-4 py-3">
                          <div className="space-y-1 min-w-[180px]">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[13px] font-bold text-foreground tracking-tight">{customer?.phone || "—"}</span>
                              {customer?.phone && (
                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <a href={`tel:${customer.phone}`} className="p-1 rounded-md text-blue-500 hover:bg-blue-50 transition-colors">
                                    <Phone className="w-3 h-3" />
                                  </a>
                                  <a href={`https://wa.me/${customer.phone?.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer" className="p-1 rounded-md text-emerald-500 hover:bg-emerald-50 transition-colors">
                                    <MessageCircle className="w-3 h-3" />
                                  </a>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[12px] text-foreground/80">{customer?.full_name || "—"}</span>
                              {customer?.full_name && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(customer.full_name); toast({ title: "Copied!" }); }}
                                  className="text-muted-foreground/40 hover:text-muted-foreground transition-colors p-0.5 opacity-0 group-hover:opacity-100"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              )}
                              {isRepeat && (
                                <span className="text-[9px] font-semibold bg-info/10 text-info px-1.5 py-0.5 rounded-full">🔄 Repeat</span>
                              )}
                            </div>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1 text-[11px] text-muted-foreground cursor-default">
                                  <MapPin className="w-3 h-3 flex-shrink-0" />
                                  <span className="truncate max-w-[150px]">{customer?.address || customer?.district || "—"}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-[300px] text-xs">
                                {customer?.address || "No address"}
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </td>

                        {/* ── Note ── */}
                        <td className="px-4 py-3 min-w-[130px]">
                          {note ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="cursor-default">
                                  <p className="text-[12px] text-foreground/80 truncate max-w-[140px] leading-relaxed">{note.content}</p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">{timeAgo(note.created_at)}</p>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-[300px] text-xs">
                                {note.content}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <button
                              onClick={() => navigate(`/web-orders/${order.id}`)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 px-2 py-1 rounded-md border border-dashed border-border hover:border-foreground/30"
                            >
                              <StickyNote className="w-3 h-3" /> Add note
                            </button>
                          )}
                        </td>

                        {/* ── Order Items ── */}
                        <td className="px-4 py-3">
                          <div className="space-y-1.5 min-w-[160px]">
                            {items.slice(0, 2).map((item) => {
                              const product = item.products as any;
                              const pName = product?.name || (item as any).product_name_fallback || "Product";
                              return (
                                <div key={item.id} className="flex items-center gap-2.5">
                                  <div className="w-9 h-9 rounded-lg bg-muted/60 flex items-center justify-center overflow-hidden flex-shrink-0 border border-border/40">
                                    {product?.image_url ? (
                                      <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                      <ShoppingBag className="w-3.5 h-3.5 text-muted-foreground" />
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[12px] font-bold text-primary truncate max-w-[100px]">{product?.sku || "-"}</p>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-md font-medium text-muted-foreground">{formatBDT(item.unit_price)}</span>
                                      <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-md font-bold">{item.quantity}×</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                            {items.length > 2 && (
                              <span className="inline-flex items-center text-[10px] text-primary font-semibold bg-primary/5 px-2 py-0.5 rounded-full">
                                +{items.length - 2} more
                              </span>
                            )}
                            {items.length === 0 && <span className="text-[11px] text-muted-foreground italic">No items</span>}
                          </div>
                        </td>

                        {/* ── Success Rate ── */}
                        <td className="px-4 py-3">
                          {sr.loading ? (
                            <Skeleton className="h-11 w-24 rounded-lg" />
                          ) : sr.noData ? (
                            <span className="text-sm font-bold text-muted-foreground/30">—</span>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-2.5 cursor-default">
                                  <div className="relative w-11 h-11 flex-shrink-0">
                                    <svg className="w-11 h-11 -rotate-90" viewBox="0 0 36 36">
                                      <circle cx="18" cy="18" r="14" fill="none" stroke="hsl(var(--muted))" strokeWidth="2.5" strokeOpacity="0.3" />
                                      <circle
                                        cx="18" cy="18" r="14" fill="none"
                                        stroke={getSuccessColor(sr.percent)}
                                        strokeWidth="2.5"
                                        strokeDasharray={`${sr.percent * 0.88} 88`}
                                        strokeLinecap="round"
                                        className="transition-all duration-700 ease-out"
                                      />
                                    </svg>
                                    <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold" style={{ color: getSuccessColor(sr.percent) }}>
                                      {sr.percent}%
                                    </span>
                                  </div>
                                  <div className="text-[11px] leading-relaxed">
                                    <p className="font-bold" style={{ color: getSuccessColor(sr.percent) }}>{sr.delivered}/{sr.total}</p>
                                    <p className="text-muted-foreground">Rating: {sr.rating}★</p>
                                  </div>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="text-xs space-y-1">
                                <p>Success Rate: <strong>{sr.percent}%</strong></p>
                                <p>Delivered: {sr.delivered} / Total: {sr.total}</p>
                                <p>Rating: {"★".repeat(sr.rating)}{"☆".repeat(5 - sr.rating)}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </td>

                        {/* ── Tags ── */}
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1 items-center">
                            {tags.map((t: string, i: number) => (
                              <span key={i} className="text-[10px] h-5 px-2 rounded-full border border-border bg-muted/50 text-muted-foreground font-medium inline-flex items-center">{t}</span>
                            ))}
                            <button className="text-[10px] h-5 px-2 rounded-full border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors opacity-0 group-hover:opacity-100">
                              + Tag
                            </button>
                          </div>
                        </td>

                        {/* ── Site ── */}
                        <td className="px-4 py-3">
                          {order.channel === "shopify" ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full">
                              🛍️ Shopify
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-muted text-muted-foreground px-2.5 py-1 rounded-full capitalize">
                              {order.channel}
                            </span>
                          )}
                        </td>

                        {/* ── Actions ── */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => navigate(`/web-orders/${order.id}`)}
                              className="text-[12px] font-semibold text-primary hover:text-primary-dark inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-primary/20 hover:bg-primary/5 transition-all"
                            >
                              Open <ExternalLink className="w-3 h-3" />
                            </button>
                            {/* Quick actions on hover */}
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); bulkMutation.mutate("confirm"); setSelected([order.id]); }}
                                    className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-50 transition-colors"
                                  >
                                    <CheckCheck className="w-3.5 h-3.5" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>Confirm</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); bulkMutation.mutate("cancel"); setSelected([order.id]); }}
                                    className="p-1.5 rounded-md text-red-500 hover:bg-red-50 transition-colors"
                                  >
                                    <Ban className="w-3.5 h-3.5" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>Cancel</TooltipContent>
                              </Tooltip>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={9}>
                        <EmptyState tab={activeTab} />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ═══ Floating Bulk Action Bar ═══ */}
        {selected.length > 0 && (
          <div
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-card rounded-2xl shadow-[0_8px_40px_-8px_rgba(0,0,0,0.2),0_0_0_1px_rgba(0,0,0,0.05)] border border-border/40 px-5 py-3 flex items-center gap-3 flex-wrap max-w-[95vw]"
            style={{ animation: "slide-up 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards" }}
          >
            <div className="flex items-center gap-2 pr-3 border-r border-border">
              <span className="text-sm font-semibold text-foreground">{selected.length} selected</span>
              <button onClick={() => setSelected([])} className="w-6 h-6 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors">
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>

            <Button
              size="sm"
              className="gap-1.5 text-xs rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => bulkMutation.mutate("confirm")}
              disabled={bulkMutation.isPending}
            >
              <CheckCheck className="w-3.5 h-3.5" /> Confirm All
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="gap-1.5 text-xs rounded-xl"
              onClick={() => bulkMutation.mutate("cancel")}
              disabled={bulkMutation.isPending}
            >
              <Ban className="w-3.5 h-3.5" /> Cancel All
            </Button>

            <DropdownMenuRoot>
              <DDTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs rounded-xl">
                  Move to...
                </Button>
              </DDTrigger>
              <DDContent side="top" className="mb-2">
                {WEB_STATUSES.filter((s) => s.key !== "all").map((s) => {
                  const Icon = s.icon;
                  return (
                    <DDItem key={s.key} onClick={() => bulkMutation.mutate(s.key)}>
                      <Icon className="w-3.5 h-3.5 mr-1.5" /> {s.label}
                    </DDItem>
                  );
                })}
              </DDContent>
            </DropdownMenuRoot>

            <Button variant="outline" size="sm" className="gap-1.5 text-xs rounded-xl">
              <Download className="w-3.5 h-3.5" /> Export
            </Button>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

/* ─── Empty State Component ─── */
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
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <span className="text-4xl mb-3">{msg.icon}</span>
      <p className="text-sm font-semibold text-foreground">{msg.title}</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">{msg.desc}</p>
    </div>
  );
}
