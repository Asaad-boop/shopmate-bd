import { useState, useCallback, useMemo, useEffect } from "react";
import { usePageTitle } from "@/hooks/use-page-title";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { orderStatusConfig, validTransitions, statusActions, formatBDT, formatDate, channelConfig } from "@/lib/format";
import { applyStatusChange, applyDamageReturn, applyBulkStatusChange } from "@/hooks/use-orders";
import { StatusChangeModal } from "@/components/orders/StatusChangeModal";
import { DamageReturnModal } from "@/components/orders/DamageReturnModal";
import { ScanMode } from "@/components/orders/ScanMode";
import { printBulkInvoices, printPickingList, printPackingSlip, printBarcodeLabels } from "@/components/orders/PrintInvoice";
import { BulkActionToolbar } from "@/components/orders/BulkActionToolbar";
import { OrderDetailsDrawer } from "@/components/orders/OrderDetailsDrawer";
import { CODReconciliation } from "@/components/orders/CODReconciliation";
import { NoteModal } from "@/components/orders/NoteModal";
import { CourierEntryModal } from "@/components/orders/CourierEntryModal";
import { OrdersErrorBoundary } from "@/components/orders/OrdersErrorBoundary";
import { useToast } from "@/hooks/use-toast";
import { useCompanySettings } from "@/hooks/use-company-settings";
import { useInvoiceSettings } from "@/hooks/use-invoice-settings";
import {
  ScanLine, Banknote, MoreHorizontal, Eye, ExternalLink, Truck, ArrowLeftRight,
  Search, RefreshCw, Plus, Download, FileText, FileSpreadsheet,
  Package, ClipboardCheck, Send, RotateCcw, AlertTriangle, AlertOctagon, Flag, Undo2, CheckCircle, XCircle,
  Clock, Route, MapPin, Hash, CreditCard,
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast as sonnerToast } from "sonner";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════
   Status Pipeline Tabs
   ═══════════════════════════════════════════════════════ */

const PIPELINE_TABS = [
  { key: "all", label: "All", emoji: "📋", color: "from-slate-500 to-slate-600", soft: "bg-slate-50 text-slate-700 border-slate-200", active: "bg-slate-600" },
  { key: "pending", label: "Pending", emoji: "🕐", color: "from-amber-400 to-amber-500", soft: "bg-amber-50 text-amber-700 border-amber-200", active: "bg-amber-500" },
  { key: "packed", label: "Packed", emoji: "📦", color: "from-blue-400 to-blue-500", soft: "bg-blue-50 text-blue-700 border-blue-200", active: "bg-blue-500" },
  { key: "ready_to_ship", label: "RTS", emoji: "📋", color: "from-cyan-400 to-cyan-500", soft: "bg-cyan-50 text-cyan-700 border-cyan-200", active: "bg-cyan-500" },
  { key: "shipped", label: "Shipped", emoji: "🚚", color: "from-indigo-400 to-indigo-500", soft: "bg-indigo-50 text-indigo-700 border-indigo-200", active: "bg-indigo-500" },
  { key: "in_transit", label: "In Transit", emoji: "🛣️", color: "from-violet-400 to-violet-500", soft: "bg-violet-50 text-violet-700 border-violet-200", active: "bg-violet-500" },
  { key: "delivered", label: "Delivered", emoji: "✅", color: "from-emerald-400 to-emerald-500", soft: "bg-emerald-50 text-emerald-700 border-emerald-200", active: "bg-emerald-500" },
  { key: "returned", label: "Returned", emoji: "↩️", color: "from-gray-400 to-gray-500", soft: "bg-gray-100 text-gray-700 border-gray-300", active: "bg-gray-600" },
  { key: "exchanged", label: "Exchanged", emoji: "🔁", color: "from-orange-400 to-orange-500", soft: "bg-orange-50 text-orange-700 border-orange-200", active: "bg-orange-500" },
  { key: "cancelled", label: "Cancelled", emoji: "❌", color: "from-red-400 to-red-500", soft: "bg-red-50 text-red-700 border-red-200", active: "bg-red-500" },
  { key: "damage_return", label: "Damage", emoji: "💥", color: "from-rose-400 to-rose-500", soft: "bg-rose-50 text-rose-700 border-rose-200", active: "bg-rose-500" },
];

const iconMap: Record<string, any> = {
  Package, ClipboardCheck, Send, Truck, CheckCircle,
  XCircle, RotateCcw, AlertTriangle, AlertOctagon, Flag, Undo2,
};

/* ═══════════════════════════════════════════════════════
   Main Orders Cockpit
   ═══════════════════════════════════════════════════════ */
function OrdersCockpit() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { settings: companySettings } = useCompanySettings();
  const { invoiceSettings } = useInvoiceSettings();

  // State
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusTab, setStatusTab] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [scanMode, setScanMode] = useState(false);
  const [codPanelOpen, setCodPanelOpen] = useState(false);
  const [drawerOrderId, setDrawerOrderId] = useState<string | null>(null);
  const [noteModal, setNoteModal] = useState<{ open: boolean; invoiceId: string; note: string } | null>(null);
  const [courierEntryIds, setCourierEntryIds] = useState<string[]>([]);
  const [statusModal, setStatusModal] = useState<{ open: boolean; orderId: string; orderNumber: string; newStatus: string } | null>(null);
  const [damageModal, setDamageModal] = useState<{ open: boolean; orderId: string; orderNumber: string } | null>(null);
  const [changing, setChanging] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 30;

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Data fetch
  const { data: orders, isLoading, refetch } = useQuery({
    queryKey: ["orders-cockpit", statusTab],
    queryFn: async () => {
      try {
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
      } catch (err: any) {
        sonnerToast.error("Failed to load orders", { description: err.message });
        return [];
      }
    },
  });

  const { data: statusCounts } = useQuery({
    queryKey: ["order-status-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("status, web_order_status").or("web_order_status.is.null,web_order_status.eq.confirm");
      const counts: Record<string, number> = { all: data?.length || 0 };
      data?.forEach((o: any) => { const s = o.status || "pending"; counts[s] = (counts[s] || 0) + 1; });
      return counts;
    },
    staleTime: 15_000,
  });

  const { data: shipmentMap } = useQuery({
    queryKey: ["orders-shipment-map"],
    queryFn: async () => {
      const { data } = await supabase.from("courier_shipments").select("order_id, courier_id, tracking_id, courier_total_cost, courier_net_payable, booking_status, couriers(name)");
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

  // Filtered rows
  const filteredRows = useMemo(() => {
    if (!orders) return [];
    return orders.filter((o) => {
      if (debouncedSearch) {
        const s = debouncedSearch.toLowerCase();
        const customer = o.customers as any;
        const matches = o.order_number?.toLowerCase().includes(s) || o.invoice_id?.toLowerCase().includes(s) || customer?.full_name?.toLowerCase().includes(s) || customer?.phone?.includes(s) || o.pathao_tracking_code?.toLowerCase().includes(s);
        if (!matches) return false;
      }
      return true;
    });
  }, [orders, debouncedSearch]);

  // Paginated
  const paginatedRows = useMemo(() => {
    const start = page * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, page]);

  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE);

  // Row data
  const getRowData = useCallback((o: any) => {
    const c = o.customers as any;
    const items = (o.order_items || []) as any[];
    const s = shipmentMap?.[o.id];
    const totalItems = items.reduce((sum: number, i: any) => sum + (i.quantity || 0), 0);
    const firstProduct = items[0]?.products;
    return {
      id: o.id,
      order_date: o.order_date,
      invoice_id: o.invoice_id || o.order_number || "—",
      customer_name: c?.full_name || "—",
      customer_phone: c?.phone || "",
      district: o.delivery_district || c?.district || "—",
      items_count: totalItems,
      first_product: firstProduct,
      items_extra: items.length > 1 ? items.length - 1 : 0,
      status: o.status || "pending",
      channel: o.channel || "manual",
      total_amount: o.total_amount || 0,
      advance_amount: o.advance_amount || 0,
      courier_name: s?.couriers?.name || (o.pathao_consignment_id ? "Pathao" : ""),
      tracking_id: o.pathao_tracking_code || s?.tracking_id || "",
      courier_cost: s?.courier_total_cost ?? null,
      net_payable: s?.courier_net_payable ?? null,
      is_blocked: c?.is_blocked,
      total_orders: c?.total_orders || 0,
      booking_status: s?.booking_status || "",
      notes: o.notes || "",
    };
  }, [shipmentMap]);

  // Handlers
  const handleStatusChange = useCallback((orderId: string, orderNumber: string, newStatus: string) => {
    const order = orders?.find((o) => o.id === orderId);
    const currentStatus = order?.status || "pending";
    const allowed = validTransitions[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      toast({ title: "❌ Invalid transition", description: `${orderStatusConfig[currentStatus]?.label} → ${orderStatusConfig[newStatus]?.label} not allowed`, variant: "destructive" });
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
    try {
      const order = orders?.find((o) => o.id === statusModal.orderId);
      await applyStatusChange(statusModal.orderId, statusModal.newStatus, order?.status || null);
      queryClient.invalidateQueries({ queryKey: ["orders-cockpit"] });
      queryClient.invalidateQueries({ queryKey: ["order-status-counts"] });
      toast({ title: "✅ Status updated", description: `#${statusModal.orderNumber} → ${orderStatusConfig[statusModal.newStatus]?.label}` });
    } catch (err: any) {
      sonnerToast.error("Status change failed", { description: err.message });
    }
    setStatusModal(null);
    setChanging(false);
  };

  const confirmDamageReturn = async (items: any[]) => {
    if (!damageModal) return;
    setChanging(true);
    try {
      await applyDamageReturn(damageModal.orderId, items);
      queryClient.invalidateQueries({ queryKey: ["orders-cockpit"] });
      queryClient.invalidateQueries({ queryKey: ["order-status-counts"] });
      toast({ title: "💥 Damage return recorded", description: `#${damageModal.orderNumber}` });
    } catch (err: any) {
      sonnerToast.error("Damage return failed", { description: err.message });
    }
    setDamageModal(null);
    setChanging(false);
  };

  const handleBulkStatus = async (newStatus: string) => {
    setChanging(true);
    try {
      const result = await applyBulkStatusChange(Array.from(selectedIds), newStatus, orders || []);
      queryClient.invalidateQueries({ queryKey: ["orders-cockpit"] });
      queryClient.invalidateQueries({ queryKey: ["order-status-counts"] });
      toast({ title: `✅ ${result.success} updated, ${result.skipped} skipped`, description: result.errors.length > 0 ? result.errors.slice(0, 3).join("; ") : undefined });
    } catch (err: any) {
      sonnerToast.error("Bulk action failed", { description: err.message });
    }
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

  const handleExport = (type: "csv" | "excel") => {
    if (!filteredRows.length) return;
    const exportData = filteredRows.map((o) => {
      const customer = o.customers as any;
      const shipment = shipmentMap?.[o.id];
      return { Invoice: o.invoice_id || o.order_number, Date: formatDate(o.order_date), Customer: customer?.full_name || "", Phone: customer?.phone || "", District: o.delivery_district || customer?.district || "", Status: o.status || "pending", Total: o.total_amount || 0, Courier: shipment?.couriers?.name || "", Tracking: o.pathao_tracking_code || shipment?.tracking_id || "", Advance: o.advance_amount || 0 };
    });
    if (type === "csv") {
      const headers = Object.keys(exportData[0]);
      const csv = [headers.join(","), ...exportData.map((r) => headers.map((h) => `"${String((r as any)[h] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
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

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === paginatedRows.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedRows.map(o => o.id)));
    }
  };

  const allSelected = paginatedRows.length > 0 && selectedIds.size === paginatedRows.length;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-background">
      {/* ═══ Header ═══ */}
      <div className="px-6 pt-5 pb-4 bg-card border-b border-border/50">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">Orders</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{filteredRows.length.toLocaleString()} orders</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setCodPanelOpen(true)}>
              <Banknote className="w-3.5 h-3.5 mr-1" /> COD
            </Button>
            <Button variant={scanMode ? "default" : "outline"} size="sm" className="h-8 text-xs" onClick={() => setScanMode(!scanMode)}>
              <ScanLine className="w-3.5 h-3.5 mr-1" /> Scan
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs">
                  <Download className="w-3.5 h-3.5 mr-1" /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover z-50">
                <DropdownMenuItem onClick={() => handleExport("csv")}><FileText className="w-4 h-4 mr-2" /> CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("excel")}><FileSpreadsheet className="w-4 h-4 mr-2" /> Excel</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => refetch()}>
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
            <Button size="sm" className="h-8 text-xs shadow-sm" onClick={() => navigate("/orders/new")}>
              <Plus className="w-3.5 h-3.5 mr-1" /> New Order
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search invoice, customer, phone, tracking…"
            className="pl-9 h-9 bg-background/60 border-border/50 rounded-xl"
            value={searchInput}
            onChange={(e) => { setSearchInput(e.target.value); setPage(0); }}
          />
        </div>
      </div>

      {/* ═══ Status Pipeline ═══ */}
      <div className="flex items-center gap-1.5 overflow-x-auto px-6 py-3 bg-card/50 border-b border-border/30" style={{ scrollbarWidth: "none" }}>
        {PIPELINE_TABS.map((tab) => {
          const count = statusCounts?.[tab.key] || 0;
          const isActive = statusTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => { setStatusTab(tab.key); setPage(0); setSelectedIds(new Set()); }}
              className={cn(
                "relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all duration-300 whitespace-nowrap shrink-0",
                isActive
                  ? `${tab.active} text-white border-transparent shadow-lg shadow-current/20 scale-[1.03]`
                  : `${tab.soft} hover:shadow-sm hover:scale-[1.01]`
              )}
            >
              {isActive && (
                <span className="absolute inset-x-0 -bottom-[13px] mx-auto w-8 h-0.5 rounded-full bg-current" />
              )}
              <span className="text-sm">{tab.emoji}</span>
              {tab.label}
              <span className={cn(
                "min-w-[20px] h-[18px] px-1 rounded-md text-[10px] font-bold flex items-center justify-center",
                isActive ? "bg-white/25" : "bg-black/[0.06]"
              )}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Scan Mode */}
      {scanMode && (
        <div className="px-6 py-3 border-b border-border/30">
          <ScanMode onStatusChange={handleStatusChange} />
        </div>
      )}

      {/* ═══ In-Transit Controls ═══ */}
      {statusTab === "in_transit" && (
        <div className="flex items-center gap-3 px-6 py-2.5 bg-violet-50/50 border-b border-violet-200/30">
          <Route className="w-4 h-4 text-violet-600" />
          <span className="text-xs font-medium text-violet-700">In-Transit Mode</span>
          <Button variant="outline" size="sm" className="h-7 text-[11px] ml-auto border-violet-300 text-violet-700 hover:bg-violet-100">
            <RefreshCw className="w-3 h-3 mr-1" /> Sync All
          </Button>
        </div>
      )}

      {/* ═══ Select All Bar ═══ */}
      {paginatedRows.length > 0 && (
        <div className="flex items-center gap-3 px-6 py-2 border-b border-border/20 bg-card/30">
          <Checkbox checked={allSelected} onCheckedChange={toggleAll} className="rounded" />
          <span className="text-[11px] text-muted-foreground font-medium">
            {selectedIds.size > 0 ? `${selectedIds.size} selected` : "Select all"}
          </span>
          {selectedIds.size > 0 && (
            <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 ml-auto" onClick={() => setCourierEntryIds(Array.from(selectedIds))}>
              <Truck className="w-3 h-3 mr-1" /> Courier Entry
            </Button>
          )}
        </div>
      )}

      {/* ═══ Order List ═══ */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-card rounded-2xl p-4 animate-pulse">
              <div className="flex items-center gap-4">
                <Skeleton className="w-5 h-5 rounded" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-32 ml-auto" />
              </div>
            </div>
          ))
        ) : paginatedRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Package className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">No orders found</p>
            <p className="text-xs mt-1">Try adjusting your search or filters</p>
          </div>
        ) : (
          paginatedRows.map((o, idx) => {
            const row = getRowData(o);
            const isSelected = selectedIds.has(row.id);
            const statusCfg = orderStatusConfig[row.status] || { label: row.status, color: "bg-muted text-muted-foreground", emoji: "" };
            const chCfg = channelConfig[row.channel] || channelConfig.manual;
            const actions = statusActions[row.status] || [];

            return (
              <div
                key={row.id}
                className={cn(
                  "group bg-card rounded-2xl border border-border/40 px-4 py-3.5 transition-all duration-200",
                  "hover:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.08)] hover:border-border/60 hover:-translate-y-[1px]",
                  isSelected && "ring-2 ring-primary/30 border-primary/40 bg-primary-light/30",
                )}
                style={{ animationDelay: `${idx * 20}ms` }}
              >
                <div className="flex items-center gap-3">
                  {/* Checkbox */}
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleSelect(row.id)}
                    className="rounded shrink-0"
                  />

                  {/* LEFT: Date + Invoice + Customer */}
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    {/* Date */}
                    <div className="shrink-0 w-[70px]">
                      <p className="text-[11px] text-muted-foreground font-medium">{formatDate(row.order_date)}</p>
                    </div>

                    {/* Invoice */}
                    <button
                      onClick={() => setDrawerOrderId(row.id)}
                      className="shrink-0 text-xs font-bold text-primary hover:underline underline-offset-2 transition-colors"
                    >
                      {row.invoice_id}
                    </button>

                    {/* Customer */}
                    <div className="min-w-0 shrink-0 max-w-[160px]">
                      <div className="flex items-center gap-1">
                        <p className="text-xs font-semibold text-foreground truncate">{row.customer_name}</p>
                        {row.total_orders >= 3 && <span className="text-emerald-500 text-[10px]">✓</span>}
                        {row.is_blocked && <span className="text-[9px] font-bold text-destructive bg-destructive/10 px-1 rounded">B</span>}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{row.customer_phone}</p>
                    </div>
                  </div>

                  {/* CENTER: Product + District */}
                  <div className="hidden md:flex items-center gap-4 flex-1 min-w-0">
                    {/* Product */}
                    <div className="flex items-center gap-2 min-w-0 max-w-[200px]">
                      {row.first_product?.image_url ? (
                        <img src={row.first_product.image_url} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0 border border-border/50" />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <Package className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium text-foreground truncate">
                          {row.first_product?.name || `${row.items_count} item(s)`}
                        </p>
                        {row.first_product?.sku && (
                          <p className="text-[10px] text-muted-foreground truncate">{row.first_product.sku}</p>
                        )}
                      </div>
                      {row.items_extra > 0 && (
                        <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md shrink-0">
                          +{row.items_extra}
                        </span>
                      )}
                    </div>

                    {/* Qty badge */}
                    <span className="shrink-0 text-[10px] font-bold text-foreground bg-muted px-1.5 py-0.5 rounded-md">
                      <Hash className="w-2.5 h-2.5 inline mr-0.5" />{row.items_count}
                    </span>

                    {/* District */}
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
                      <MapPin className="w-3 h-3" />
                      <span className="truncate max-w-[80px]">{row.district}</span>
                    </div>
                  </div>

                  {/* RIGHT: Status + Financial + Actions */}
                  <div className="flex items-center gap-3 shrink-0">
                    {/* Status */}
                    <span className={cn(
                      "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all animate-flip-in",
                      statusCfg.color
                    )}>
                      {statusCfg.emoji} {statusCfg.label}
                    </span>

                    {/* Courier */}
                    {row.courier_name && (
                      <span className="hidden lg:inline-flex text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                        {row.courier_name}
                      </span>
                    )}

                    {/* Tracking */}
                    {row.tracking_id && (
                      <span className="hidden lg:inline-flex text-[10px] font-mono text-primary/70 bg-primary-light px-2 py-0.5 rounded-md truncate max-w-[100px]">
                        {row.tracking_id}
                      </span>
                    )}

                    {/* Total */}
                    <div className="text-right shrink-0 min-w-[70px]">
                      <p className="text-xs font-bold text-foreground tabular-nums">{formatBDT(row.total_amount)}</p>
                      {row.advance_amount > 0 && (
                        <p className="text-[10px] font-semibold text-emerald-600 tabular-nums flex items-center justify-end gap-0.5">
                          <CreditCard className="w-2.5 h-2.5" />
                          {formatBDT(row.advance_amount)}
                        </p>
                      )}
                    </div>

                    {/* Sync badge */}
                    {row.booking_status && (
                      <span className={cn(
                        "hidden xl:inline-flex text-[9px] font-bold px-1.5 py-0.5 rounded-md",
                        row.booking_status === "booked" || row.booking_status === "SYNCED"
                          ? "bg-emerald-100 text-emerald-700"
                          : row.booking_status === "FAILED" || row.booking_status === "error"
                            ? "bg-red-100 text-red-700"
                            : "bg-muted text-muted-foreground"
                      )}>
                        {row.booking_status}
                      </span>
                    )}

                    {/* Source */}
                    <span className={cn("hidden xl:inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium", chCfg.color)}>
                      {chCfg.emoji}
                    </span>

                    {/* Actions dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="w-7 h-7 rounded-xl hover:bg-muted flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52 bg-popover z-[60]">
                        <DropdownMenuItem onClick={() => setDrawerOrderId(row.id)}>
                          <Eye className="w-4 h-4 mr-2" /> View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/orders/${row.id}`)}>
                          <ExternalLink className="w-4 h-4 mr-2" /> Full Page
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {actions.map((action: any) => {
                          const Icon = iconMap[action.icon] || Package;
                          return (
                            <DropdownMenuItem
                              key={action.key}
                              onClick={() => handleStatusChange(row.id, row.invoice_id, action.key)}
                              className={action.variant === "destructive" ? "text-destructive" : ""}
                            >
                              <Icon className="w-4 h-4 mr-2" /> {action.label}
                            </DropdownMenuItem>
                          );
                        })}
                        {row.status === "ready_to_ship" && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setCourierEntryIds([row.id])}>
                              <Truck className="w-4 h-4 mr-2" /> Courier Entry
                            </DropdownMenuItem>
                          </>
                        )}
                        {row.status === "delivered" && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => navigate(`/exchanges?order=${row.id}`)}>
                              <ArrowLeftRight className="w-4 h-4 mr-2" /> Exchange
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ═══ Pagination ═══ */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 px-6 py-3 border-t border-border/30 bg-card/50">
          <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            Previous
          </Button>
          <span className="text-xs text-muted-foreground font-medium px-2">
            Page {page + 1} of {totalPages}
          </span>
          <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
            Next
          </Button>
        </div>
      )}

      {/* ═══ Bulk Action Toolbar ═══ */}
      <BulkActionToolbar
        selectedCount={selectedIds.size}
        onDeselect={() => setSelectedIds(new Set())}
        onStatusChange={handleBulkStatus}
        onPrint={handleBulkPrint}
        onCourier={() => setCourierEntryIds(Array.from(selectedIds))}
        changing={changing}
      />

      {/* ═══ Modals ═══ */}
      {statusModal && (
        <StatusChangeModal
          open={statusModal.open}
          onOpenChange={(open) => !open && setStatusModal(null)}
          orderId={statusModal.orderId}
          orderNumber={statusModal.orderNumber}
          currentStatus={orders?.find((o) => o.id === statusModal.orderId)?.status || "pending"}
          newStatus={statusModal.newStatus}
          newStatusLabel={orderStatusConfig[statusModal.newStatus]?.label || statusModal.newStatus}
          onConfirm={confirmStatusChange}
          loading={changing}
          orderTotal={orders?.find((o) => o.id === statusModal.orderId)?.total_amount || 0}
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
      <CourierEntryModal
        open={courierEntryIds.length > 0}
        onOpenChange={(open) => !open && setCourierEntryIds([])}
        orderIds={courierEntryIds}
        orders={orders || []}
        onComplete={() => { setCourierEntryIds([]); setSelectedIds(new Set()); }}
      />
      <CODReconciliation open={codPanelOpen} onOpenChange={setCodPanelOpen} />
      <OrderDetailsDrawer
        open={!!drawerOrderId}
        onOpenChange={(open) => !open && setDrawerOrderId(null)}
        orderId={drawerOrderId}
      />
    </div>
  );
}

export default function OrdersPage() {
  return (
    <OrdersErrorBoundary>
      <OrdersCockpit />
    </OrdersErrorBoundary>
  );
}
