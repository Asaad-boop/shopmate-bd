import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { formatBDT, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Search, Phone, MessageCircle, ExternalLink, Radio } from "lucide-react";
import {
  DropdownMenu as DropdownMenuRoot,
  DropdownMenuContent as DDContent,
  DropdownMenuItem as DDItem,
  DropdownMenuTrigger as DDTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const WEB_STATUSES = [
  { key: "all", label: "All", emoji: "📋", color: "bg-muted text-foreground" },
  { key: "processing", label: "Processing", emoji: "🟡", color: "bg-yellow-100 text-yellow-800" },
  { key: "good_but_no_response", label: "Good But No Response", emoji: "🟢", color: "bg-emerald-100 text-emerald-800" },
  { key: "no_response", label: "No Response", emoji: "🔴", color: "bg-red-100 text-red-800" },
  { key: "on_hold", label: "On Hold", emoji: "⏸️", color: "bg-blue-100 text-blue-800" },
  { key: "advance_payment", label: "Advance Payment", emoji: "💰", color: "bg-amber-100 text-amber-800" },
  { key: "cancel", label: "Cancel", emoji: "❌", color: "bg-red-100 text-red-800" },
  { key: "confirm", label: "Confirm", emoji: "🟢", color: "bg-green-100 text-green-800" },
] as const;

export default function WebOrdersPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("processing");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [lastSynced, setLastSynced] = useState<Date>(new Date());

  // Check if Shopify is connected
  const { data: shopifyConnected } = useQuery({
    queryKey: ["shopify-connected"],
    queryFn: async () => {
      const { data } = await supabase.from("settings").select("value").eq("key", "shopify_store_url").maybeSingle();
      return !!(data?.value);
    },
  });

  // Realtime subscription for new shopify orders
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

  // Fetch all web orders (shopify channel or orders with web_order_status set)
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

  // Fetch order items for all these orders
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

  // Fetch latest note per order
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
      // Group by order_id, take first (latest)
      const map = new Map<string, typeof data[0]>();
      data.forEach((n) => {
        if (n.order_id && !map.has(n.order_id)) map.set(n.order_id, n);
      });
      return map;
    },
    enabled: orderIds.length > 0,
  });

  // Items grouped by order
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

  // Status counts
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

  // Filter
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

  // Bulk update
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

  // Success rate for customer
  const getSuccessRate = (customer: any) => {
    if (!customer) return { percent: 0, delivered: 0, total: 0, rating: 0 };
    const total = customer.total_orders || 0;
    const spent = customer.total_spent || 0;
    // Estimate delivered as 80% of total for display (real logic would query delivered orders)
    const delivered = Math.round(total * 0.8);
    const percent = total > 0 ? Math.round((delivered / total) * 100) : 0;
    const rating = spent > 10000 ? 5 : spent > 5000 ? 4 : spent > 2000 ? 3 : spent > 500 ? 2 : 1;
    return { percent, delivered, total, rating };
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Web Orders</h1>
          <p className="text-sm text-muted-foreground">Website & Shopify orders — confirm via phone call</p>
        </div>
        {shopifyConnected && (
          <div className="flex items-center gap-3">
            <Badge className="bg-green-500 hover:bg-green-600 text-white gap-1.5">
              <Radio className="w-3 h-3 animate-pulse" /> Live Sync
            </Badge>
            <span className="text-xs text-muted-foreground">
              Last synced: {Math.floor((Date.now() - lastSynced.getTime()) / 60000)}m ago
            </span>
          </div>
        )}
      </div>

      {/* Status Tabs */}
      <div className="flex flex-wrap gap-1.5 bg-muted/50 p-1.5 rounded-xl">
        {WEB_STATUSES.map((s) => (
          <button
            key={s.key}
            onClick={() => { setActiveTab(s.key); setSelected([]); }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all",
              activeTab === s.key
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            )}
          >
            <span>{s.emoji}</span>
            <span className="hidden sm:inline">{s.label}</span>
            <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] px-1.5 text-xs">
              {statusCounts[s.key] || 0}
            </Badge>
          </button>
        ))}
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by phone, name, order ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            {selected.length > 0 && (
              <DropdownMenuRoot>
                <DDTrigger asChild>
                  <Button variant="outline" size="sm">
                    Bulk Actions ({selected.length})
                  </Button>
                </DDTrigger>
                <DDContent>
                  {WEB_STATUSES.filter((s) => s.key !== "all").map((s) => (
                    <DDItem key={s.key} onClick={() => bulkMutation.mutate(s.key)}>
                      {s.emoji} Move to {s.label}
                    </DDItem>
                  ))}
                </DDContent>
              </DropdownMenuRoot>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={filtered.length > 0 && selected.length === filtered.length}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead>Order Items</TableHead>
                    <TableHead>Success Rate</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead className="w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((order) => {
                    const customer = order.customers as any;
                    const items = itemsByOrder.get(order.id) || [];
                    const note = latestNotes instanceof Map ? latestNotes.get(order.id) : null;
                    const sr = getSuccessRate(customer);
                    const tags = (order as any).tags || [];

                    return (
                      <TableRow key={order.id} className="group">
                        <TableCell>
                          <Checkbox
                            checked={selected.includes(order.id)}
                            onCheckedChange={() => toggleSelect(order.id)}
                          />
                        </TableCell>
                        {/* Created At */}
                        <TableCell>
                          <div className="text-sm">{formatDateTime(order.created_at)}</div>
                          <div className="text-xs text-muted-foreground">{order.order_number}</div>
                        </TableCell>
                        {/* Customer */}
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-medium">{customer?.phone || "-"}</span>
                              {customer?.phone && (
                                <>
                                  <a href={`tel:${customer.phone}`} className="text-primary hover:text-primary/80">
                                    <Phone className="w-3.5 h-3.5" />
                                  </a>
                                  <a
                                    href={`https://wa.me/${customer.phone?.replace(/[^0-9]/g, "")}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-green-600 hover:text-green-500"
                                  >
                                    <MessageCircle className="w-3.5 h-3.5" />
                                  </a>
                                </>
                              )}
                            </div>
                            <div className="text-sm">{customer?.full_name || "-"}</div>
                            <div className="text-xs text-muted-foreground truncate max-w-[160px]">
                              {customer?.address || customer?.district || "-"}
                            </div>
                          </div>
                        </TableCell>
                        {/* Note */}
                        <TableCell>
                          {note ? (
                            <div>
                              <p className="text-sm truncate max-w-[150px]">{note.content}</p>
                              <p className="text-xs text-muted-foreground">{timeAgo(note.created_at)}</p>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">No notes</span>
                          )}
                        </TableCell>
                        {/* Order Items */}
                        <TableCell>
                          <div className="space-y-1">
                            {items.slice(0, 2).map((item) => (
                              <div key={item.id} className="flex items-center gap-2 text-sm">
                                <div className="w-8 h-8 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                                  {(item.products as any)?.image_url ? (
                                    <img src={(item.products as any).image_url} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-[10px] text-muted-foreground">IMG</span>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-medium max-w-[100px]">{(item.products as any)?.sku || "-"}</p>
                                  <p className="text-xs text-muted-foreground">×{item.quantity} • {formatBDT(item.unit_price)}</p>
                                </div>
                              </div>
                            ))}
                            {items.length > 2 && (
                              <span className="text-xs text-muted-foreground">+{items.length - 2} more</span>
                            )}
                            {items.length === 0 && <span className="text-xs text-muted-foreground">No items</span>}
                          </div>
                        </TableCell>
                        {/* Success Rate */}
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="relative w-10 h-10">
                              <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                                <circle cx="18" cy="18" r="15" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
                                <circle
                                  cx="18" cy="18" r="15" fill="none"
                                  stroke={sr.percent >= 70 ? "hsl(142 76% 36%)" : sr.percent >= 40 ? "hsl(48 96% 53%)" : "hsl(0 84% 60%)"}
                                  strokeWidth="3"
                                  strokeDasharray={`${sr.percent * 0.942} 94.2`}
                                  strokeLinecap="round"
                                />
                              </svg>
                              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">{sr.percent}%</span>
                            </div>
                            <div className="text-xs">
                              <p>{sr.delivered}/{sr.total}</p>
                              <p className="text-muted-foreground">{"⭐".repeat(Math.min(sr.rating, 5))}</p>
                            </div>
                          </div>
                        </TableCell>
                        {/* Tags */}
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {tags.map((t: string, i: number) => (
                              <Badge key={i} variant="outline" className="text-[10px] h-5">{t}</Badge>
                            ))}
                            {tags.length === 0 && (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </div>
                        </TableCell>
                        {/* Site */}
                        <TableCell>
                          <Badge variant="secondary" className="text-xs capitalize">{order.channel}</Badge>
                        </TableCell>
                        {/* Actions */}
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/web-orders/${order.id}`)}
                          >
                            <ExternalLink className="w-3.5 h-3.5 mr-1" /> Open
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-12">
                        No orders found in this status
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
