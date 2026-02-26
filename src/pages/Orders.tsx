import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge, ChannelBadge } from "@/components/ui/status-badge";
import { orderStatusConfig, validTransitions, formatBDT, formatDate, formatDateTime, channelConfig } from "@/lib/format";
import { applyStatusChange, applyDamageReturn } from "@/hooks/use-orders";
import { StatusChangeModal } from "@/components/orders/StatusChangeModal";
import { DamageReturnModal } from "@/components/orders/DamageReturnModal";
import { ScanMode } from "@/components/orders/ScanMode";
import { printInvoice, printBulkInvoices, printPickingList, printPackingSlip, printBarcodeLabels } from "@/components/orders/PrintInvoice";
import { BulkActionToolbar } from "@/components/orders/BulkActionToolbar";
import { OrderDetailsDrawer } from "@/components/orders/OrderDetailsDrawer";
import { CODReconciliation } from "@/components/orders/CODReconciliation";
import { OrdersQuickStats } from "@/components/orders/OrdersQuickStats";
import { OrdersFilterBar, OrderFilters, defaultOrderFilters } from "@/components/orders/OrdersFilterBar";
import { NoteModal } from "@/components/orders/NoteModal";
import { useToast } from "@/hooks/use-toast";
import { useCompanySettings } from "@/hooks/use-company-settings";
import { useInvoiceSettings } from "@/hooks/use-invoice-settings";
import {
  ScanLine, Banknote, ChevronLeft, ChevronRight,
  MoreHorizontal, Eye, CheckCircle, Truck, ArrowLeftRight, XCircle,
  MessageSquare, ImageIcon, User, ShieldCheck, ExternalLink,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import * as XLSX from "xlsx";

const PAGE_SIZE = 50;

export default function OrdersPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { settings: companySettings } = useCompanySettings();
  const { invoiceSettings } = useInvoiceSettings();

  const [filters, setFilters] = useState<OrderFilters>(defaultOrderFilters);
  const [statusTab, setStatusTab] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [scanMode, setScanMode] = useState(false);
  const [codPanelOpen, setCodPanelOpen] = useState(false);
  const [drawerOrderId, setDrawerOrderId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [noteModal, setNoteModal] = useState<{ open: boolean; invoiceId: string; note: string } | null>(null);

  // Modals
  const [statusModal, setStatusModal] = useState<{ open: boolean; orderId: string; orderNumber: string; newStatus: string } | null>(null);
  const [damageModal, setDamageModal] = useState<{ open: boolean; orderId: string; orderNumber: string } | null>(null);
  const [changing, setChanging] = useState(false);

  /* ────────── Data fetch ────────── */
  const { data: orders, isLoading, refetch } = useQuery({
    queryKey: ["orders-cockpit", statusTab],
    queryFn: async () => {
      let q = supabase
        .from("orders")
        .select(`*, customers(full_name, phone, phone2, address, district, thana, segment, total_orders, is_blocked),
                 order_items(id, product_id, quantity, unit_price, total_price, products(id, name, sku, image_url, stock_quantity))`)
        .order("order_date", { ascending: false })
        .or("web_order_status.is.null,web_order_status.eq.confirm")
        .limit(500);

      if (statusTab !== "all") q = q.eq("status", statusTab);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  // Status counts
  const { data: statusCounts } = useQuery({
    queryKey: ["order-status-counts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("status, web_order_status")
        .or("web_order_status.is.null,web_order_status.eq.confirm");
      const counts: Record<string, number> = { all: data?.length || 0 };
      data?.forEach((o: any) => {
        const s = o.status || "pending";
        counts[s] = (counts[s] || 0) + 1;
      });
      return counts;
    },
  });

  // Shipment data
  const { data: shipmentMap } = useQuery({
    queryKey: ["orders-shipment-map"],
    queryFn: async () => {
      const { data } = await supabase
        .from("courier_shipments")
        .select("order_id, courier_id, tracking_id, courier_total_cost, courier_net_payable, booking_status, couriers(name)");
      const map: Record<string, any> = {};
      data?.forEach((s: any) => { map[s.order_id] = s; });
      return map;
    },
    staleTime: 30_000,
  });

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("orders-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        queryClient.invalidateQueries({ queryKey: ["orders-cockpit"] });
        queryClient.invalidateQueries({ queryKey: ["order-status-counts"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  /* ────────── Filtered + paginated rows ────────── */
  const filteredRows = useMemo(() => {
    if (!orders) return [];
    return orders.filter((o) => {
      // Text search
      if (filters.search) {
        const s = filters.search.toLowerCase();
        const customer = o.customers as any;
        const matches =
          o.order_number?.toLowerCase().includes(s) ||
          o.invoice_id?.toLowerCase().includes(s) ||
          customer?.full_name?.toLowerCase().includes(s) ||
          customer?.phone?.includes(s) ||
          o.pathao_tracking_code?.toLowerCase().includes(s);
        if (!matches) return false;
      }
      // Source
      if (filters.source !== "all" && (o.channel || "manual") !== filters.source) return false;
      // Courier
      if (filters.courier !== "all") {
        const shipment = shipmentMap?.[o.id];
        const courierName = (shipment?.couriers?.name || "").toLowerCase();
        if (!courierName.includes(filters.courier)) return false;
      }
      // Date range
      if (filters.dateFrom && new Date(o.order_date) < filters.dateFrom) return false;
      if (filters.dateTo) {
        const end = new Date(filters.dateTo);
        end.setHours(23, 59, 59);
        if (new Date(o.order_date) > end) return false;
      }
      // Amount
      if (filters.amountMin && (o.total_amount || 0) < Number(filters.amountMin)) return false;
      if (filters.amountMax && (o.total_amount || 0) > Number(filters.amountMax)) return false;
      return true;
    });
  }, [orders, filters, shipmentMap]);

  const totalFiltered = filteredRows.length;
  const totalPages = Math.ceil(totalFiltered / PAGE_SIZE);
  const pagedRows = useMemo(() => {
    const start = page * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, page]);

  /* ────────── Selection ────────── */
  const allSelected = pagedRows.length > 0 && pagedRows.every((o) => selectedIds.has(o.id));
  const someSelected = pagedRows.some((o) => selectedIds.has(o.id)) && !allSelected;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pagedRows.map((o) => o.id)));
    }
  };

  const toggleRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  /* ────────── Status change ────────── */
  const handleStatusChange = useCallback((orderId: string, orderNumber: string, newStatus: string) => {
    const order = orders?.find((o) => o.id === orderId);
    const currentStatus = order?.status || "pending";
    const allowed = validTransitions[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      toast({ title: "❌ Invalid transition", description: `${orderStatusConfig[currentStatus]?.label} → ${orderStatusConfig[newStatus]?.label} is not allowed`, variant: "destructive" });
      return;
    }
    if (newStatus === "damage_return") {
      setDamageModal({ open: true, orderId, orderNumber });
    } else {
      setStatusModal({ open: true, orderId, orderNumber, newStatus });
    }
  }, [orders, toast]);

  const confirmStatusChange = async () => {
    if (!statusModal) return;
    setChanging(true);
    const order = orders?.find((o) => o.id === statusModal.orderId);
    await applyStatusChange(statusModal.orderId, statusModal.newStatus, order?.status || null);
    queryClient.invalidateQueries({ queryKey: ["orders-cockpit"] });
    queryClient.invalidateQueries({ queryKey: ["order-status-counts"] });
    toast({ title: "✅ Status updated", description: `#${statusModal.orderNumber} → ${orderStatusConfig[statusModal.newStatus]?.label}` });
    setStatusModal(null);
    setChanging(false);
  };

  const confirmDamageReturn = async (items: any[]) => {
    if (!damageModal) return;
    setChanging(true);
    await applyDamageReturn(damageModal.orderId, items);
    queryClient.invalidateQueries({ queryKey: ["orders-cockpit"] });
    queryClient.invalidateQueries({ queryKey: ["order-status-counts"] });
    toast({ title: "💥 Damage return recorded", description: `#${damageModal.orderNumber}` });
    setDamageModal(null);
    setChanging(false);
  };

  /* ────────── Bulk ────────── */
  const handleBulkStatus = async (newStatus: string) => {
    setChanging(true);
    let success = 0;
    for (const id of selectedIds) {
      const order = orders?.find((o) => o.id === id);
      if (!order) continue;
      const allowed = validTransitions[order.status || "pending"] || [];
      if (!allowed.includes(newStatus)) continue;
      await applyStatusChange(id, newStatus, order.status || null);
      success++;
    }
    queryClient.invalidateQueries({ queryKey: ["orders-cockpit"] });
    queryClient.invalidateQueries({ queryKey: ["order-status-counts"] });
    toast({ title: `✅ ${success} orders updated to ${orderStatusConfig[newStatus]?.label}` });
    setSelectedIds(new Set());
    setChanging(false);
  };

  const handleBulkPrint = (type: "invoice" | "picking" | "packing" | "barcode") => {
    const selected = orders?.filter((o) => selectedIds.has(o.id)) || [];
    if (type === "invoice") printBulkInvoices(selected, companySettings, invoiceSettings);
    if (type === "picking") printPickingList(selected, companySettings);
    if (type === "packing") selected.forEach((o) => printPackingSlip(o, companySettings));
    if (type === "barcode") printBarcodeLabels(selected, companySettings);
  };

  /* ────────── Export ────────── */
  const handleExport = (type: "csv" | "excel") => {
    if (!filteredRows.length) return;
    const exportData = filteredRows.map((o) => {
      const customer = o.customers as any;
      const shipment = shipmentMap?.[o.id];
      return {
        Invoice: o.invoice_id || o.order_number,
        Date: formatDate(o.order_date),
        Customer: customer?.full_name || "",
        Phone: customer?.phone || "",
        Address: o.delivery_address || customer?.address || "",
        District: o.delivery_district || customer?.district || "",
        Status: o.status || "pending",
        Source: o.channel || "manual",
        Courier: shipment?.couriers?.name || "",
        Tracking: o.pathao_tracking_code || shipment?.tracking_id || "",
        Total: o.total_amount || 0,
        "Courier Cost": shipment?.courier_total_cost ?? "",
        "Net Payable": shipment?.courier_net_payable ?? "",
        Advance: o.advance_amount || 0,
        Notes: o.notes || "",
      };
    });

    if (type === "csv") {
      const headers = Object.keys(exportData[0]);
      const csv = [
        headers.join(","),
        ...exportData.map((r) => headers.map((h) => `"${String((r as any)[h] ?? "").replace(/"/g, '""')}"`).join(","))
      ].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
      URL.revokeObjectURL(url);
    } else {
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Orders");
      XLSX.writeFile(wb, `orders-${new Date().toISOString().slice(0, 10)}.xlsx`);
    }
    toast({ title: `📄 Exported ${exportData.length} orders as ${type.toUpperCase()}` });
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col h-[calc(100vh-64px)]">
        {/* Page Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-card">
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">Orders</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage and track all orders across channels
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setCodPanelOpen(true)}>
              <Banknote className="w-3.5 h-3.5 mr-1" /> COD Panel
            </Button>
            <Button
              variant={scanMode ? "default" : "outline"}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setScanMode(!scanMode)}
            >
              <ScanLine className="w-3.5 h-3.5 mr-1" /> Scan
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <OrdersQuickStats
          counts={statusCounts || { all: 0 }}
          activeStatus={statusTab}
          onStatusClick={(s) => { setStatusTab(s); setPage(0); }}
        />

        {/* Scan Mode */}
        {scanMode && <ScanMode onStatusChange={handleStatusChange} />}

        {/* Filter Bar */}
        <OrdersFilterBar
          filters={filters}
          onFiltersChange={(f) => { setFilters(f); setPage(0); }}
          onRefresh={() => refetch()}
          onExport={handleExport}
          onNewOrder={() => navigate("/orders/new")}
          totalOrders={totalFiltered}
        />

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm border-collapse min-w-[1400px]">
            <thead className="sticky top-0 z-20 bg-muted/80 backdrop-blur-sm border-b">
              <tr>
                <th className="w-10 px-3 py-2.5">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    className="translate-y-px"
                  />
                </th>
                <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Date</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Invoice</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground min-w-[180px]">Customer</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Address</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Note</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground min-w-[200px]">Product</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Source</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Courier</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Tracking</th>
                <th className="px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Courier Cost</th>
                <th className="px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Net Pay</th>
                <th className="px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Adv</th>
                <th className="w-12 px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    {Array.from({ length: 16 }).map((_, j) => (
                      <td key={j} className="px-3 py-3">
                        <div className="h-4 bg-muted rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={16} className="text-center py-16 text-muted-foreground">
                    No orders match your filters
                  </td>
                </tr>
              ) : (
                pagedRows.map((o) => {
                  const customer = o.customers as any;
                  const items = (o.order_items || []) as any[];
                  const shipment = shipmentMap?.[o.id];
                  const isSelected = selectedIds.has(o.id);
                  const hasNotes = !!o.notes;
                  const firstItem = items[0] as any;
                  const product = firstItem?.products;
                  const totalItems = items.reduce((s: number, i: any) => s + (i.quantity || 0), 0);
                  const address = o.delivery_address || customer?.address || "";
                  const isBlocked = customer?.is_blocked;
                  const totalOrders = customer?.total_orders || 0;

                  return (
                    <tr
                      key={o.id}
                      className={cn(
                        "border-b border-border/50 transition-all duration-150 group cursor-pointer",
                        isSelected
                          ? "bg-primary/[0.04] hover:bg-primary/[0.07]"
                          : "hover:bg-muted/40 hover:shadow-[0_1px_4px_-1px_rgba(0,0,0,0.06)]",
                        isBlocked && "bg-red-50/50"
                      )}
                      onClick={() => setDrawerOrderId(o.id)}
                    >
                      {/* Checkbox */}
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleRow(o.id)}
                          className="translate-y-px"
                        />
                      </td>

                      {/* Date */}
                      <td className="px-3 py-2.5">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(o.order_date)}
                        </span>
                      </td>

                      {/* Invoice */}
                      <td className="px-3 py-2.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/orders/${o.id}`); }}
                          className="text-xs font-semibold text-primary hover:underline"
                        >
                          {o.invoice_id || o.order_number || "—"}
                        </button>
                      </td>

                      {/* Customer */}
                      <td className="px-3 py-2.5">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <User className="w-3.5 h-3.5 text-primary" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-foreground truncate flex items-center gap-1">
                                  {customer?.full_name || "—"}
                                  {totalOrders >= 3 && (
                                    <ShieldCheck className="w-3 h-3 text-emerald-500 shrink-0" />
                                  )}
                                  {isBlocked && (
                                    <span className="text-[9px] font-bold text-red-600 bg-red-100 px-1 rounded">BLOCKED</span>
                                  )}
                                </p>
                                <p className="text-[11px] text-muted-foreground truncate">{customer?.phone || ""}</p>
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="bg-popover text-popover-foreground border shadow-lg p-3 max-w-xs">
                            <div className="space-y-1.5">
                              <p className="font-semibold text-sm">{customer?.full_name}</p>
                              <p className="text-xs text-muted-foreground">{customer?.phone} {customer?.phone2 ? `/ ${customer.phone2}` : ""}</p>
                              <p className="text-xs text-muted-foreground">{customer?.address}</p>
                              <div className="flex items-center gap-2 pt-1">
                                <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-medium">{totalOrders} orders</span>
                                {customer?.segment && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">{customer.segment}</span>}
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </td>

                      {/* Address */}
                      <td className="px-3 py-2.5 max-w-[140px]">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-xs text-muted-foreground truncate block">
                              {o.delivery_district || customer?.district || "—"}
                            </span>
                          </TooltipTrigger>
                          {address && (
                            <TooltipContent side="bottom" className="max-w-xs bg-popover text-popover-foreground border shadow-lg">
                              <p className="text-xs">{address}</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </td>

                      {/* Note */}
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        {hasNotes ? (
                          <button
                            onClick={() => setNoteModal({ open: true, invoiceId: o.invoice_id || o.order_number || "", note: o.notes || "" })}
                            className="w-7 h-7 rounded-lg bg-amber-50 hover:bg-amber-100 flex items-center justify-center transition-colors"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
                          </button>
                        ) : (
                          <span className="text-muted-foreground/30">—</span>
                        )}
                      </td>

                      {/* Product */}
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          {product?.image_url ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <img
                                  src={product.image_url}
                                  alt=""
                                  className="w-8 h-8 rounded-md object-cover border border-border shrink-0"
                                />
                              </TooltipTrigger>
                              <TooltipContent side="right" className="bg-popover text-popover-foreground border shadow-lg">
                                <div className="flex items-center gap-3">
                                  <img src={product.image_url} alt="" className="w-16 h-16 rounded-lg object-cover" />
                                  <div>
                                    <p className="text-xs font-semibold">{product.name}</p>
                                    {product.sku && <p className="text-[10px] text-muted-foreground">SKU: {product.sku}</p>}
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                              <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate max-w-[140px]">
                              {product?.name || firstItem?.product_name_fallback || "—"}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {product?.sku || ""} {totalItems > 1 ? `• ×${totalItems}` : `• ×${firstItem?.quantity || 1}`}
                              {items.length > 1 && ` (+${items.length - 1} more)`}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-3 py-2.5">
                        <StatusBadge config={orderStatusConfig} status={o.status} />
                      </td>

                      {/* Total */}
                      <td className="px-3 py-2.5 text-right">
                        <span className="text-xs font-bold text-foreground tabular-nums">
                          {formatBDT(o.total_amount)}
                        </span>
                      </td>

                      {/* Source */}
                      <td className="px-3 py-2.5">
                        <ChannelBadge channel={o.channel} />
                      </td>

                      {/* Courier */}
                      <td className="px-3 py-2.5">
                        <span className="text-xs text-muted-foreground">
                          {shipment?.couriers?.name || (o.pathao_consignment_id ? "Pathao" : "—")}
                        </span>
                      </td>

                      {/* Tracking */}
                      <td className="px-3 py-2.5">
                        {(o.pathao_tracking_code || shipment?.tracking_id) ? (
                          <span className="text-[11px] font-mono text-primary hover:underline cursor-pointer">
                            {o.pathao_tracking_code || shipment?.tracking_id}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/30">—</span>
                        )}
                      </td>

                      {/* Courier Cost */}
                      <td className="px-3 py-2.5 text-right">
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {shipment?.courier_total_cost != null ? formatBDT(shipment.courier_total_cost, true) : "—"}
                        </span>
                      </td>

                      {/* Net Payable */}
                      <td className="px-3 py-2.5 text-right">
                        <span className="text-xs tabular-nums font-medium">
                          {shipment?.courier_net_payable != null ? formatBDT(shipment.courier_net_payable, true) : "—"}
                        </span>
                      </td>

                      {/* Advance */}
                      <td className="px-3 py-2.5 text-center">
                        {(o.advance_amount || 0) > 0 ? (
                          <span className="inline-flex px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            ৳{(o.advance_amount || 0).toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/30">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 bg-popover z-50">
                            <DropdownMenuItem onClick={() => setDrawerOrderId(o.id)}>
                              <Eye className="w-4 h-4 mr-2" /> View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate(`/orders/${o.id}`)}>
                              <ExternalLink className="w-4 h-4 mr-2" /> Full Page
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {(validTransitions[o.status || "pending"] || []).includes("packed") && (
                              <DropdownMenuItem onClick={() => handleStatusChange(o.id, o.invoice_id || o.order_number || "", "packed")}>
                                <CheckCircle className="w-4 h-4 mr-2" /> Mark Packed
                              </DropdownMenuItem>
                            )}
                            {(validTransitions[o.status || "pending"] || []).includes("shipped") && (
                              <DropdownMenuItem onClick={() => handleStatusChange(o.id, o.invoice_id || o.order_number || "", "shipped")}>
                                <Truck className="w-4 h-4 mr-2" /> Mark Shipped
                              </DropdownMenuItem>
                            )}
                            {(validTransitions[o.status || "pending"] || []).includes("delivered") && (
                              <DropdownMenuItem onClick={() => handleStatusChange(o.id, o.invoice_id || o.order_number || "", "delivered")}>
                                <CheckCircle className="w-4 h-4 mr-2 text-emerald-600" /> Mark Delivered
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleStatusChange(o.id, o.invoice_id || o.order_number || "", "cancelled")} className="text-destructive">
                              <XCircle className="w-4 h-4 mr-2" /> Cancel Order
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-6 py-2.5 border-t bg-card text-xs">
          <span className="text-muted-foreground">
            Showing {pagedRows.length > 0 ? page * PAGE_SIZE + 1 : 0}–{Math.min((page + 1) * PAGE_SIZE, totalFiltered)} of {totalFiltered.toLocaleString()} orders
          </span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="px-2 text-muted-foreground font-medium">
              {page + 1} / {totalPages || 1}
            </span>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
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
          onCourier={(courier) => toast({ title: `${courier} bulk send coming soon` })}
          changing={changing}
        />

        {/* Modals */}
        {statusModal && (
          <StatusChangeModal
            open={statusModal.open}
            onOpenChange={(open) => !open && setStatusModal(null)}
            orderId={statusModal.orderId}
            orderNumber={statusModal.orderNumber}
            newStatus={statusModal.newStatus}
            newStatusLabel={orderStatusConfig[statusModal.newStatus]?.label || statusModal.newStatus}
            onConfirm={confirmStatusChange}
            loading={changing}
          />
        )}
        {damageModal && (
          <DamageReturnModal
            open={damageModal.open}
            onOpenChange={(open) => !open && setDamageModal(null)}
            orderId={damageModal.orderId}
            orderNumber={damageModal.orderNumber}
            onConfirm={confirmDamageReturn}
            loading={changing}
          />
        )}

        {noteModal && (
          <NoteModal
            open={noteModal.open}
            onOpenChange={(open) => !open && setNoteModal(null)}
            invoiceId={noteModal.invoiceId}
            note={noteModal.note}
          />
        )}

        <CODReconciliation open={codPanelOpen} onOpenChange={setCodPanelOpen} />
        <OrderDetailsDrawer
          open={!!drawerOrderId}
          onOpenChange={(open) => !open && setDrawerOrderId(null)}
          orderId={drawerOrderId}
        />
      </div>
    </TooltipProvider>
  );
}
