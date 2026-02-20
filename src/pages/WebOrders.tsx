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
import { Search, Phone, MessageCircle, ExternalLink, Radio, ClipboardList, Clock, CheckCircle2, PhoneOff, Pause, Wallet, XCircle, CircleCheck } from "lucide-react";
import { useBDCourierBulk, getSuccessColor } from "@/hooks/use-bd-courier";
import {
  DropdownMenu as DropdownMenuRoot,
  DropdownMenuContent as DDContent,
  DropdownMenuItem as DDItem,
  DropdownMenuTrigger as DDTrigger,
} from "@/components/ui/dropdown-menu";

const WEB_STATUSES = [
  { key: "processing", label: "Processing", icon: Clock, color: "bg-yellow-100 text-yellow-800" },
  { key: "good_but_no_response", label: "Good", icon: CheckCircle2, color: "bg-emerald-100 text-emerald-800" },
  { key: "no_response", label: "No Response", icon: PhoneOff, color: "bg-red-100 text-red-800" },
  { key: "on_hold", label: "On Hold", icon: Pause, color: "bg-blue-100 text-blue-800" },
  { key: "advance_payment", label: "Advance", icon: Wallet, color: "bg-amber-100 text-amber-800" },
  { key: "cancel", label: "Cancel", icon: XCircle, color: "bg-red-100 text-red-800" },
  { key: "confirm", label: "Confirm", icon: CircleCheck, color: "bg-green-100 text-green-800" },
  { key: "all", label: "All", icon: ClipboardList, color: "bg-muted text-foreground" },
] as const;

export default function WebOrdersPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("processing");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [lastSynced, setLastSynced] = useState<Date>(new Date());

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
    WEB_STATUSES.forEach((s) => { if (s.key !== "all") counts[s.key] = 0; });
    orders?.forEach((o) => {
      counts.all++;
      const st = o.web_order_status || "processing";
      if (counts[st] !== undefined) counts[st]++;
    });
    return counts;
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
    return list;
  }, [orders, activeTab, search]);

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

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Web Orders</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Website & Shopify orders — confirm via phone call</p>
        </div>
        {shopifyConnected && (
          <div className="flex items-center gap-3">
            <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5 rounded-full px-3 py-1 text-xs font-medium shadow-sm">
              <Radio className="w-3 h-3 animate-pulse" /> Live Sync
            </Badge>
            <span className="text-xs text-muted-foreground">
              Last synced: {Math.floor((Date.now() - lastSynced.getTime()) / 60000)}m ago
            </span>
          </div>
        )}
      </div>

      {/* Status Tabs - Liquid glass white */}
      <div className="flex items-center justify-center py-1">
        <div className="inline-flex items-center gap-1 p-1.5 rounded-[28px] bg-white/80 backdrop-blur-2xl shadow-[0_2px_24px_-4px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)] border border-white/60">
          {WEB_STATUSES.map((s) => {
            const Icon = s.icon;
            const isActive = activeTab === s.key;
            return (
              <button
                key={s.key}
                onClick={() => { setActiveTab(s.key); setSelected([]); }}
                className={cn(
                  "relative flex items-center gap-2 px-5 py-2.5 rounded-[20px] text-[12px] font-medium whitespace-nowrap",
                  "transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                  isActive
                    ? "bg-slate-800/90 text-white scale-[1.08] -translate-y-1 shadow-[0_8px_24px_-6px_rgba(0,0,0,0.25)] backdrop-blur-xl"
                    : "text-slate-400 hover:text-slate-600 hover:bg-slate-100/60"
                )}
              >
                <Icon className={cn(
                  "w-[18px] h-[18px] transition-all duration-500",
                  isActive ? "text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.4)]" : "text-slate-400"
                )} strokeWidth={isActive ? 2.2 : 1.8} />
                <span>{s.label}</span>
                {(statusCounts[s.key] || 0) > 0 && (
                  <span className={cn(
                    "absolute -top-1.5 -right-1.5 text-[9px] font-bold min-w-[18px] h-[18px] px-1 rounded-full inline-flex items-center justify-center",
                    "transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                    isActive
                      ? "bg-primary text-white scale-110 shadow-md shadow-primary/30"
                      : "bg-slate-200 text-slate-500 scale-100"
                  )}>
                    {statusCounts[s.key]}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search + Bulk Actions */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by phone, name, order ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-10 rounded-xl bg-slate-50 border-slate-200 focus:bg-white transition-colors"
          />
        </div>
        {selected.length > 0 && (
          <DropdownMenuRoot>
            <DDTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-lg">
                Bulk Actions ({selected.length})
              </Button>
            </DDTrigger>
            <DDContent>
              {WEB_STATUSES.filter((s) => s.key !== "all").map((s) => {
                const Icon = s.icon;
                return (
                  <DDItem key={s.key} onClick={() => bulkMutation.mutate(s.key)}>
                    <Icon className="w-3.5 h-3.5 mr-1.5" /> Move to {s.label}
                  </DDItem>
                );
              })}
            </DDContent>
          </DropdownMenuRoot>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-[68px] w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/80">
                  <th className="px-5 py-3.5 text-left w-12">
                    <Checkbox
                      checked={filtered.length > 0 && selected.length === filtered.length}
                      onCheckedChange={toggleAll}
                      className="rounded-[4px] border-slate-300"
                    />
                  </th>
                  {["Created At", "Customer", "Note", "Order Items", "Success Rate", "Tags", "Site", "Actions"].map((h) => (
                    <th key={h} className="px-5 py-3.5 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => {
                  const customer = order.customers as any;
                  const items = itemsByOrder.get(order.id) || [];
                  const note = latestNotes instanceof Map ? latestNotes.get(order.id) : null;
                  const sr = getSuccessRate(customer);
                  const tags = (order as any).tags || [];
                  const isSelected = selected.includes(order.id);

                  return (
                    <tr
                      key={order.id}
                      className={cn(
                        "border-b border-slate-100/80 transition-colors duration-200",
                        isSelected
                          ? "bg-blue-50/40"
                          : "hover:bg-slate-50/50"
                      )}
                      style={{ height: '68px' }}
                    >
                      <td className="px-5 py-4">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(order.id)}
                          className="rounded-[4px] border-slate-300"
                        />
                      </td>

                      {/* Created At */}
                      <td className="px-5 py-4">
                        <p className="text-[13px] font-semibold text-foreground whitespace-nowrap">{formatDateTime(order.created_at)}</p>
                        <p className="text-[11px] text-muted-foreground mt-1 font-mono">ID: {order.order_number}</p>
                      </td>

                      {/* Customer */}
                      <td className="px-5 py-4">
                        <div className="space-y-1.5 min-w-[170px]">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-bold text-foreground tracking-tight">{customer?.phone || "—"}</span>
                            {customer?.phone && (
                              <div className="flex items-center gap-1">
                                <a href={`tel:${customer.phone}`} className="text-blue-500 hover:text-blue-600 transition-colors p-0.5 rounded hover:bg-blue-50">
                                  <Phone className="w-3.5 h-3.5" />
                                </a>
                                <a
                                  href={`https://wa.me/${customer.phone?.replace(/[^0-9]/g, "")}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-emerald-500 hover:text-emerald-600 transition-colors p-0.5 rounded hover:bg-emerald-50"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[12.5px] text-foreground/80">{customer?.full_name || "—"}</span>
                            {customer?.full_name && (
                              <button
                                onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(customer.full_name); toast({ title: "Copied!" }); }}
                                className="text-slate-300 hover:text-slate-500 transition-colors p-0.5"
                              >
                                <ClipboardList className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <span className="truncate max-w-[140px]">📍 {customer?.address || customer?.district || "—"}</span>
                          </div>
                        </div>
                      </td>

                      {/* Note */}
                      <td className="px-5 py-4 min-w-[130px]">
                        {note ? (
                          <div>
                            <p className="text-[12px] text-foreground/80 truncate max-w-[140px] leading-relaxed">{note.content}</p>
                            <p className="text-[10.5px] text-muted-foreground mt-1 italic">Updated {timeAgo(note.created_at)}</p>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-300 italic">No notes</span>
                        )}
                      </td>

                      {/* Order Items */}
                      <td className="px-5 py-4">
                        <div className="space-y-2 min-w-[160px]">
                          {items.slice(0, 2).map((item) => {
                            const product = item.products as any;
                            const pName = product?.name || (item as any).product_name_fallback || "Product";
                            const pInitial = pName[0].toUpperCase();
                            return (
                            <div key={item.id} className="flex items-center gap-2.5">
                              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0 border border-slate-200/60">
                                {product?.image_url ? (
                                  <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{pInitial}</div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-[12px] font-bold text-teal-600 truncate max-w-[100px]">{product?.sku || "-"}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[11px] text-muted-foreground">{formatBDT(item.unit_price)}</span>
                                  <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-medium">{item.quantity}x</span>
                                </div>
                              </div>
                            </div>
                            );
                          })}
                          {items.length > 2 && (
                            <span className="text-[11px] text-muted-foreground font-medium">+{items.length - 2} more</span>
                          )}
                          {items.length === 0 && <span className="text-[11px] text-slate-300">No items</span>}
                        </div>
                      </td>

                      {/* Success Rate */}
                      <td className="px-5 py-4">
                        {sr.loading ? (
                          <Skeleton className="h-12 w-24 rounded-lg" />
                        ) : sr.noData ? (
                          <div className="flex items-center justify-center">
                            <span className="text-lg font-bold text-slate-200">0</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <div className="relative w-11 h-11 flex-shrink-0">
                              <svg className="w-11 h-11 -rotate-90" viewBox="0 0 36 36">
                                <circle cx="18" cy="18" r="14" fill="none" stroke="hsl(var(--muted) / 0.2)" strokeWidth="3" />
                                <circle
                                  cx="18" cy="18" r="14" fill="none"
                                  stroke={getSuccessColor(sr.percent)}
                                  strokeWidth="3"
                                  strokeDasharray={`${sr.percent * 0.88} 88`}
                                  strokeLinecap="round"
                                  className="transition-all duration-500"
                                />
                              </svg>
                              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold" style={{ color: getSuccessColor(sr.percent) }}>
                                {sr.percent}%
                              </span>
                            </div>
                            <div className="text-[11px] leading-[1.6] space-y-0">
                              <p className="font-bold text-[12px]" style={{ color: getSuccessColor(sr.percent) }}>Success: {sr.percent}%</p>
                              <p className="text-muted-foreground">Order: {sr.delivered}/{sr.total}</p>
                              <p className="text-muted-foreground">Rating: {sr.rating * 20}</p>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Tags */}
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1 items-center">
                          {tags.map((t: string, i: number) => (
                            <Badge key={i} variant="outline" className="text-[10px] h-5 rounded-full border-slate-200 text-slate-500 bg-slate-50 font-medium">{t}</Badge>
                          ))}
                          <button className="text-[10px] h-5 px-2 rounded-full border border-dashed border-slate-300 text-slate-400 hover:text-slate-600 hover:border-slate-400 transition-colors">
                            + Tag
                          </button>
                        </div>
                      </td>

                      {/* Site */}
                      <td className="px-5 py-4">
                        <span className="text-[11.5px] text-slate-500 capitalize font-medium">{order.channel}</span>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4">
                        <button
                          onClick={() => navigate(`/web-orders/${order.id}`)}
                          className="text-[12.5px] font-semibold text-teal-600 hover:text-teal-700 hover:underline transition-all duration-200 inline-flex items-center gap-1"
                        >
                          Open <ExternalLink className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center text-muted-foreground py-20 text-sm">
                      No orders found in this status
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
