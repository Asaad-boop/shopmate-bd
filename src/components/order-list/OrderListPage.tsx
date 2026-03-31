import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OrderDetailsDrawer } from "@/components/orders/OrderDetailsDrawer";
import { StatusChangeModal } from "@/components/orders/StatusChangeModal";
import { BulkActionToolbar } from "@/components/orders/BulkActionToolbar";
import { CourierEntryModal } from "@/components/orders/CourierEntryModal";
import { PathaoBookingModal } from "@/components/pathao/PathaoBookingModal";
import { printBulkInvoices, printPickingList } from "@/components/orders/PrintInvoice";
import { applyStatusChange, applyBulkStatusChange, isTransitionAllowed, getAllowedTransitions } from "@/hooks/use-orders";
import { useCompanySettings } from "@/hooks/use-company-settings";
import { useInvoiceSettings } from "@/hooks/use-invoice-settings";
import { formatBDT, formatDate, orderStatusConfig, validTransitions, statusActions } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Search, RefreshCw, Plus, MoreHorizontal, Eye, ExternalLink, Printer, Truck,
  Package, ChevronLeft, ChevronRight, X, Copy, FileText,
  CheckCircle, XCircle, RotateCcw, ClipboardCheck, Send,
} from "lucide-react";

/* ═══ Status Tabs ═══ */
const STATUS_TABS = [
  { key: "all", label: "All", emoji: "📋" },
  { key: "confirmed", label: "Confirmed", emoji: "✅" },
  { key: "packed", label: "Packed", emoji: "📦" },
  { key: "ready_to_ship", label: "RTS", emoji: "📋" },
  { key: "shipped", label: "Shipped", emoji: "🚚" },
  { key: "in_transit", label: "In Transit", emoji: "🛣️" },
  { key: "delivered", label: "Delivered", emoji: "✅" },
  { key: "returned", label: "Returned", emoji: "↩️" },
  { key: "cancelled", label: "Cancelled", emoji: "❌" },
] as const;

const PAGE_SIZE = 50;

export function OrderListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { settings: companySettings } = useCompanySettings();
  const { invoiceSettings } = useInvoiceSettings();

  const [activeTab, setActiveTab] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [drawerOrderId, setDrawerOrderId] = useState<string | null>(null);
  const [statusModal, setStatusModal] = useState<{ open: boolean; orderId: string; orderNumber: string; currentStatus: string; newStatus: string } | null>(null);
  const [courierEntryIds, setCourierEntryIds] = useState<string[]>([]);
  const [pathaoOrder, setPathaoOrder] = useState<any>(null);
  const [changing, setChanging] = useState(false);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(searchInput); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Fetch orders
  const { data: orders, isLoading, refetch } = useQuery({
    queryKey: ["order-list-page", activeTab],
    queryFn: async () => {
      let q = supabase
        .from("orders")
        .select(`*, customers(id, full_name, phone, address, district, thana),
                 order_items(id, product_id, quantity, unit_price, products(id, name, sku, image_url))`)
        .order("created_at", { ascending: false })
        .limit(500);

      if (activeTab !== "all") {
        q = q.eq("status", activeTab);
      } else {
        // Exclude pending/draft, show confirmed+ only
        q = q.not("status", "eq", "pending");
      }

      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  // Status counts
  const { data: statusCounts } = useQuery({
    queryKey: ["order-list-status-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("status").not("status", "eq", "pending");
      const counts: Record<string, number> = { all: data?.length || 0 };
      data?.forEach((o: any) => { counts[o.status] = (counts[o.status] || 0) + 1; });
      return counts;
    },
    staleTime: 15_000,
  });

  // Shipment map
  const { data: shipmentMap } = useQuery({
    queryKey: ["order-list-shipments"],
    queryFn: async () => {
      const { data } = await supabase.from("courier_shipments").select("order_id, courier_id, tracking_id, booking_status, couriers(name)");
      const map: Record<string, any> = {};
      data?.forEach((s: any) => { map[s.order_id] = s; });
      return map;
    },
    staleTime: 30_000,
  });

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("order-list-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        queryClient.invalidateQueries({ queryKey: ["order-list-page"] });
        queryClient.invalidateQueries({ queryKey: ["order-list-status-counts"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // Filter
  const filtered = useMemo(() => {
    if (!orders) return [];
    if (!debouncedSearch) return orders;
    const s = debouncedSearch.toLowerCase();
    return orders.filter((o: any) => {
      const c = o.customers;
      return (
        o.order_number?.toLowerCase().includes(s) ||
        o.invoice_id?.toLowerCase().includes(s) ||
        c?.full_name?.toLowerCase().includes(s) ||
        c?.phone?.includes(s) ||
        o.pathao_tracking_code?.toLowerCase().includes(s)
      );
    });
  }, [orders, debouncedSearch]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const allSelected = paginated.length > 0 && paginated.every((o: any) => selectedIds.has(o.id));
  const someSelected = paginated.some((o: any) => selectedIds.has(o.id)) && !allSelected;

  const toggleAll = useCallback(() => {
    const next = new Set(selectedIds);
    if (allSelected) paginated.forEach((o: any) => next.delete(o.id));
    else paginated.forEach((o: any) => next.add(o.id));
    setSelectedIds(next);
  }, [allSelected, paginated, selectedIds]);

  const toggleOne = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // Status change
  const handleStatusChange = useCallback((orderId: string, orderNumber: string, currentStatus: string, newStatus: string) => {
    if (!isTransitionAllowed(currentStatus, newStatus)) {
      toast.error(`${currentStatus} → ${newStatus} not allowed`);
      return;
    }
    setStatusModal({ open: true, orderId, orderNumber, currentStatus, newStatus });
  }, []);

  const confirmStatusChange = async () => {
    if (!statusModal) return;
    setChanging(true);
    try {
      await applyStatusChange(statusModal.orderId, statusModal.newStatus, statusModal.currentStatus);
      queryClient.invalidateQueries({ queryKey: ["order-list-page"] });
      queryClient.invalidateQueries({ queryKey: ["order-list-status-counts"] });
      toast.success(`#${statusModal.orderNumber} → ${orderStatusConfig[statusModal.newStatus]?.label || statusModal.newStatus}`);
    } catch (err: any) {
      toast.error("Status change failed: " + err.message);
    }
    setStatusModal(null);
    setChanging(false);
  };

  // Bulk actions
  const handleBulkStatus = async (newStatus: string) => {
    setChanging(true);
    try {
      const result = await applyBulkStatusChange(Array.from(selectedIds), newStatus, orders || []);
      queryClient.invalidateQueries({ queryKey: ["order-list-page"] });
      queryClient.invalidateQueries({ queryKey: ["order-list-status-counts"] });
      toast.success(`${result.success} updated, ${result.skipped} skipped`);
    } catch (err: any) {
      toast.error("Bulk action failed: " + err.message);
    }
    setSelectedIds(new Set());
    setChanging(false);
  };

  const handleBulkPrint = (type: "invoice" | "picking" | "packing" | "barcode") => {
    const selected = orders?.filter((o: any) => selectedIds.has(o.id)) || [];
    if (type === "invoice") printBulkInvoices(selected, companySettings, invoiceSettings);
    if (type === "picking") printPickingList(selected, companySettings);
  };

  const handleSinglePrint = (order: any) => {
    printBulkInvoices([order], companySettings, invoiceSettings);
  };

  const openPathaoBooking = (order: any) => {
    setPathaoOrder(order);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-background">
      {/* Header */}
      <div className="px-6 pt-5 pb-3 bg-card border-b border-border/50">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Order List</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{filtered.length} orders</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => refetch()}>
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
            </Button>
            <Button size="sm" className="h-8 text-xs" onClick={() => navigate("/orders/new")}>
              <Plus className="w-3.5 h-3.5 mr-1" /> New Order
            </Button>
          </div>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto px-6 py-2.5 bg-card/50 border-b border-border/30" style={{ scrollbarWidth: "none" }}>
        {STATUS_TABS.map((tab) => {
          const count = statusCounts?.[tab.key] || 0;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setPage(0); setSelectedIds(new Set()); }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all whitespace-nowrap shrink-0",
                isActive
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card text-muted-foreground border-border hover:bg-accent"
              )}
            >
              <span>{tab.emoji}</span>
              {tab.label}
              <span className={cn(
                "min-w-[18px] h-[16px] px-1 rounded text-[10px] font-bold flex items-center justify-center",
                isActive ? "bg-primary-foreground/20" : "bg-muted"
              )}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-3 px-6 py-2.5 border-b border-border/30 bg-card/30">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search invoice, customer, phone, tracking…"
            className="pl-9 h-9"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        {debouncedSearch && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setSearchInput("")}>
            <X className="w-3.5 h-3.5 mr-1" /> Clear
          </Button>
        )}
        {selectedIds.size > 0 && (
          <span className="text-xs font-semibold text-primary ml-auto">{selectedIds.size} selected</span>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="px-6 py-4 space-y-2">
            {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
          </div>
        ) : (
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
              <TableRow className="hover:bg-transparent border-b border-border">
                <TableHead className="w-10 px-3">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                </TableHead>
                <TableHead className="text-[11px] font-bold w-[120px]">Order #</TableHead>
                <TableHead className="text-[11px] font-bold w-[110px]">Date</TableHead>
                <TableHead className="text-[11px] font-bold w-[170px]">Customer</TableHead>
                <TableHead className="text-[11px] font-bold w-[180px] hidden lg:table-cell">Address</TableHead>
                <TableHead className="text-[11px] font-bold w-[160px] hidden md:table-cell">Items</TableHead>
                <TableHead className="text-[11px] font-bold w-[90px]">Amount</TableHead>
                <TableHead className="text-[11px] font-bold w-[100px]">Status</TableHead>
                <TableHead className="text-[11px] font-bold w-[100px] hidden xl:table-cell">Courier</TableHead>
                <TableHead className="text-[11px] font-bold w-[120px] hidden xl:table-cell">Tracking</TableHead>
                <TableHead className="w-[100px] text-[11px] font-bold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-16 text-muted-foreground">
                    <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-medium">No orders found</p>
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((o: any) => {
                  const c = o.customers;
                  const items = o.order_items || [];
                  const shipment = shipmentMap?.[o.id];
                  const isSelected = selectedIds.has(o.id);
                  const status = o.status || "pending";
                  const statusCfg = orderStatusConfig[status] || { label: status, color: "bg-muted text-muted-foreground", emoji: "" };
                  const courierName = shipment?.couriers?.name || (o.pathao_consignment_id ? "Pathao" : "");
                  const trackingId = o.pathao_tracking_code || shipment?.tracking_id || "";
                  const totalItems = items.reduce((s: number, i: any) => s + (i.quantity || 0), 0);
                  const firstProduct = items[0]?.products;
                  const allowed = getAllowedTransitions(status);

                  return (
                    <TableRow
                      key={o.id}
                      className={cn("group transition-colors", isSelected && "bg-primary/5")}
                    >
                      <TableCell className="px-3 py-1.5">
                        <Checkbox checked={isSelected} onCheckedChange={() => toggleOne(o.id)} />
                      </TableCell>

                      {/* Order # */}
                      <TableCell className="py-1.5">
                        <button
                          onClick={() => setDrawerOrderId(o.id)}
                          className="text-[11px] font-bold text-primary hover:underline underline-offset-2"
                        >
                          {o.invoice_id || o.order_number || "—"}
                        </button>
                      </TableCell>

                      {/* Date */}
                      <TableCell className="py-1.5 text-[11px] text-muted-foreground">
                        {formatDate(o.order_date || o.created_at)}
                      </TableCell>

                      {/* Customer */}
                      <TableCell className="py-1.5">
                        <p className="text-[11px] font-semibold text-foreground truncate max-w-[150px]">
                          {c?.full_name || "—"}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{c?.phone || ""}</p>
                      </TableCell>

                      {/* Address */}
                      <TableCell className="py-1.5 hidden lg:table-cell">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-[11px] text-muted-foreground line-clamp-1 max-w-[160px] cursor-default">
                              {o.delivery_address || c?.address || "—"}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs text-xs">{o.delivery_address || c?.address || "—"}</TooltipContent>
                        </Tooltip>
                      </TableCell>

                      {/* Items */}
                      <TableCell className="py-1.5 hidden md:table-cell">
                        <div className="flex items-center gap-1.5">
                          {firstProduct?.image_url ? (
                            <img src={firstProduct.image_url} className="w-6 h-6 rounded object-cover border border-border/50" alt="" />
                          ) : (
                            <div className="w-6 h-6 rounded bg-muted flex items-center justify-center">
                              <Package className="w-3 h-3 text-muted-foreground" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-[10px] font-medium truncate max-w-[100px]">{firstProduct?.name || `${totalItems} item(s)`}</p>
                            {items.length > 1 && <span className="text-[9px] text-muted-foreground">+{items.length - 1} more</span>}
                          </div>
                          <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1 rounded">×{totalItems}</span>
                        </div>
                      </TableCell>

                      {/* Amount */}
                      <TableCell className="py-1.5">
                        <span className="text-[11px] font-bold tabular-nums">{formatBDT(o.total_amount || 0)}</span>
                      </TableCell>

                      {/* Status */}
                      <TableCell className="py-1.5">
                        <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold", statusCfg.color)}>
                          {statusCfg.emoji} {statusCfg.label}
                        </span>
                      </TableCell>

                      {/* Courier */}
                      <TableCell className="py-1.5 hidden xl:table-cell">
                        {courierName ? (
                          <span className="text-[11px] font-medium">{courierName}</span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">Unassigned</span>
                        )}
                      </TableCell>

                      {/* Tracking */}
                      <TableCell className="py-1.5 hidden xl:table-cell">
                        {trackingId ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-[10px] font-mono text-primary/70 cursor-default truncate max-w-[100px] block">{trackingId}</span>
                            </TooltipTrigger>
                            <TooltipContent>{trackingId}</TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="py-1.5">
                        <div className="flex items-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => handleSinglePrint(o)}
                                className="w-6 h-6 rounded flex items-center justify-center hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Printer className="w-3.5 h-3.5 text-muted-foreground" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Print Invoice</TooltipContent>
                          </Tooltip>

                          {!courierName && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => openPathaoBooking(o)}
                                  className="w-6 h-6 rounded flex items-center justify-center hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Truck className="w-3.5 h-3.5 text-muted-foreground" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Book Courier</TooltipContent>
                            </Tooltip>
                          )}

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="w-6 h-6 rounded flex items-center justify-center hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => setDrawerOrderId(o.id)}>
                                <Eye className="w-3.5 h-3.5 mr-2" /> View Detail
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/orders/${o.id}`)}>
                                <ExternalLink className="w-3.5 h-3.5 mr-2" /> Full Page
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {allowed.slice(0, 4).map((s) => {
                                const cfg = orderStatusConfig[s];
                                return (
                                  <DropdownMenuItem
                                    key={s}
                                    onClick={() => handleStatusChange(o.id, o.invoice_id || o.order_number || "", status, s)}
                                  >
                                    {cfg?.emoji || "→"} {cfg?.label || s}
                                  </DropdownMenuItem>
                                );
                              })}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleSinglePrint(o)}>
                                <Printer className="w-3.5 h-3.5 mr-2" /> Print Invoice
                              </DropdownMenuItem>
                              {!courierName && (
                                <DropdownMenuItem onClick={() => openPathaoBooking(o)}>
                                  <Truck className="w-3.5 h-3.5 mr-2" /> Book Courier
                                </DropdownMenuItem>
                              )}
                              {isTransitionAllowed(status, "cancelled") && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => handleStatusChange(o.id, o.invoice_id || o.order_number || "", status, "cancelled")}
                                  >
                                    <XCircle className="w-3.5 h-3.5 mr-2" /> Cancel Order
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-6 py-2.5 border-t border-border bg-card">
        <span className="text-xs text-muted-foreground">
          {filtered.length > 0 ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, filtered.length)} of ${filtered.length}` : "0 orders"}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs text-muted-foreground">{page + 1}/{totalPages || 1}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Bulk Action Toolbar */}
      <BulkActionToolbar
        selectedCount={selectedIds.size}
        onDeselect={() => setSelectedIds(new Set())}
        onStatusChange={handleBulkStatus}
        onPrint={handleBulkPrint}
        onCourier={() => setCourierEntryIds(Array.from(selectedIds))}
        changing={changing}
      />

      {/* Modals */}
      {statusModal && (
        <StatusChangeModal
          open={statusModal.open}
          onOpenChange={(open) => !open && setStatusModal(null)}
          orderId={statusModal.orderId}
          orderNumber={statusModal.orderNumber}
          currentStatus={statusModal.currentStatus}
          newStatus={statusModal.newStatus}
          newStatusLabel={orderStatusConfig[statusModal.newStatus]?.label || statusModal.newStatus}
          onConfirm={confirmStatusChange}
          loading={changing}
          orderTotal={orders?.find((o: any) => o.id === statusModal.orderId)?.total_amount || 0}
        />
      )}

      <CourierEntryModal
        open={courierEntryIds.length > 0}
        onOpenChange={(open) => !open && setCourierEntryIds([])}
        orderIds={courierEntryIds}
        orders={orders || []}
        onComplete={() => { setCourierEntryIds([]); setSelectedIds(new Set()); }}
      />

      {pathaoOrder && (
        <PathaoBookingModal
          open={!!pathaoOrder}
          onOpenChange={(open) => !open && setPathaoOrder(null)}
          order={pathaoOrder}
          customer={pathaoOrder?.customers}
          items={pathaoOrder?.order_items || []}
        />
      )}

      <OrderDetailsDrawer
        open={!!drawerOrderId}
        onOpenChange={(open) => !open && setDrawerOrderId(null)}
        orderId={drawerOrderId}
      />
    </div>
  );
}
