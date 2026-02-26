import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { AgGridReact } from "ag-grid-react";
import { ColDef } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge, ChannelBadge } from "@/components/ui/status-badge";
import { orderStatusConfig, validTransitions, statusActions, formatBDT, formatDate, channelConfig } from "@/lib/format";
import { applyStatusChange, applyDamageReturn, applyBulkStatusChange } from "@/hooks/use-orders";
import { StatusChangeModal } from "@/components/orders/StatusChangeModal";
import { DamageReturnModal } from "@/components/orders/DamageReturnModal";
import { ScanMode } from "@/components/orders/ScanMode";
import { printBulkInvoices, printPickingList, printPackingSlip, printBarcodeLabels } from "@/components/orders/PrintInvoice";
import { BulkActionToolbar } from "@/components/orders/BulkActionToolbar";
import { OrderDetailsDrawer } from "@/components/orders/OrderDetailsDrawer";
import { CODReconciliation } from "@/components/orders/CODReconciliation";
import { OrdersQuickStats } from "@/components/orders/OrdersQuickStats";
import { OrdersFilterBar, OrderFilters, defaultOrderFilters } from "@/components/orders/OrdersFilterBar";
import { NoteModal } from "@/components/orders/NoteModal";
import { CourierEntryModal } from "@/components/orders/CourierEntryModal";
import { OrdersErrorBoundary } from "@/components/orders/OrdersErrorBoundary";
import { useToast } from "@/hooks/use-toast";
import { useCompanySettings } from "@/hooks/use-company-settings";
import { useInvoiceSettings } from "@/hooks/use-invoice-settings";
import {
  ScanLine, Banknote, MoreHorizontal, Eye, CheckCircle, Truck, ArrowLeftRight, XCircle,
  ExternalLink, Package, ClipboardCheck, Send, RotateCcw, AlertTriangle, AlertOctagon, Flag, Undo2,
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast as sonnerToast } from "sonner";

/* ═══════════════════════════════════════════════════════
   AG Grid Actions Cell Renderer (React component)
   ═══════════════════════════════════════════════════════ */
const iconMap: Record<string, any> = {
  Package, ClipboardCheck, Send, Truck, CheckCircle,
  XCircle, RotateCcw, AlertTriangle, AlertOctagon, Flag, Undo2,
};

function ActionsCellRenderer(params: any) {
  const data = params.data;
  const ctx = params.context;
  if (!data) return null;

  const actions = statusActions[data.status] || [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="w-7 h-7 rounded-lg hover:bg-accent flex items-center justify-center">
          <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 bg-popover z-[60]">
        <DropdownMenuItem onClick={() => ctx?.onViewDrawer(data.id)}>
          <Eye className="w-4 h-4 mr-2" /> View Details
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => ctx?.onFullPage(data.id)}>
          <ExternalLink className="w-4 h-4 mr-2" /> Full Page
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {actions.map((action: any) => {
          const Icon = iconMap[action.icon] || Package;
          return (
            <DropdownMenuItem
              key={action.key}
              onClick={() => ctx?.onStatusChange(data.id, data.invoice_id || data.order_number, action.key)}
              className={action.variant === "destructive" ? "text-destructive" : ""}
            >
              <Icon className="w-4 h-4 mr-2" /> {action.label}
            </DropdownMenuItem>
          );
        })}
        {data.status === "ready_to_ship" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => ctx?.onCourierEntry([data.id])}>
              <Truck className="w-4 h-4 mr-2" /> Courier Entry
            </DropdownMenuItem>
          </>
        )}
        {data.status === "delivered" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => ctx?.onExchange(data.id)}>
              <ArrowLeftRight className="w-4 h-4 mr-2" /> Exchange
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ═══════════════════════════════════════════════════════
   Main Orders Cockpit
   ═══════════════════════════════════════════════════════ */
function OrdersCockpit() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { settings: companySettings } = useCompanySettings();
  const { invoiceSettings } = useInvoiceSettings();
  const gridRef = useRef<AgGridReact>(null);

  // ────────── State ──────────
  const [filters, setFilters] = useState<OrderFilters>(defaultOrderFilters);
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

  // ────────── Debounced search ──────────
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(filters.search), 300);
    return () => clearTimeout(t);
  }, [filters.search]);

  // ────────── Data fetch ──────────
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
    staleTime: 15_000,
  });

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

  // ────────── Realtime ──────────
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

  // ────────── Filtered rows ──────────
  const filteredRows = useMemo(() => {
    if (!orders) return [];
    return orders.filter((o) => {
      if (debouncedSearch) {
        const s = debouncedSearch.toLowerCase();
        const customer = o.customers as any;
        const matches =
          o.order_number?.toLowerCase().includes(s) ||
          o.invoice_id?.toLowerCase().includes(s) ||
          customer?.full_name?.toLowerCase().includes(s) ||
          customer?.phone?.includes(s) ||
          o.pathao_tracking_code?.toLowerCase().includes(s);
        if (!matches) return false;
      }
      if (filters.source !== "all" && (o.channel || "manual") !== filters.source) return false;
      if (filters.courier !== "all") {
        const shipment = shipmentMap?.[o.id];
        const courierName = (shipment?.couriers?.name || "").toLowerCase();
        if (!courierName.includes(filters.courier)) return false;
      }
      if (filters.dateFrom && new Date(o.order_date) < filters.dateFrom) return false;
      if (filters.dateTo) {
        const end = new Date(filters.dateTo);
        end.setHours(23, 59, 59);
        if (new Date(o.order_date) > end) return false;
      }
      if (filters.amountMin && (o.total_amount || 0) < Number(filters.amountMin)) return false;
      if (filters.amountMax && (o.total_amount || 0) > Number(filters.amountMax)) return false;
      return true;
    });
  }, [orders, debouncedSearch, filters, shipmentMap]);

  // ────────── AG Grid row data (flattened) ──────────
  const rowData = useMemo(() => {
    return filteredRows.map(o => {
      const c = o.customers as any;
      const items = (o.order_items || []) as any[];
      const s = shipmentMap?.[o.id];
      const totalItems = items.reduce((sum: number, i: any) => sum + (i.quantity || 0), 0);
      const firstProduct = items[0]?.products;

      return {
        id: o.id,
        order_date: o.order_date,
        invoice_id: o.invoice_id || o.order_number || "—",
        order_number: o.order_number,
        customer_name: c?.full_name || "—",
        customer_phone: c?.phone || "",
        district: o.delivery_district || c?.district || "—",
        items_count: totalItems,
        items_label: firstProduct?.name
          ? `${firstProduct.name}${items.length > 1 ? ` +${items.length - 1}` : ""}`
          : `${totalItems} item(s)`,
        status: o.status || "pending",
        channel: o.channel || "manual",
        total_amount: o.total_amount || 0,
        advance_amount: o.advance_amount || 0,
        notes: o.notes || "",
        courier_name: s?.couriers?.name || (o.pathao_consignment_id ? "Pathao" : ""),
        tracking_id: o.pathao_tracking_code || s?.tracking_id || "",
        courier_cost: s?.courier_total_cost ?? null,
        net_payable: s?.courier_net_payable ?? null,
        is_blocked: c?.is_blocked,
        total_orders: c?.total_orders || 0,
        booking_status: s?.booking_status || "",
      };
    });
  }, [filteredRows, shipmentMap]);

  // ────────── Column Defs ──────────
  const columnDefs: ColDef[] = useMemo(() => [
    {
      colId: "select",
      headerCheckboxSelection: true,
      checkboxSelection: true,
      width: 45,
      pinned: "left",
      suppressMenu: true,
      headerName: "",
    },
    {
      field: "order_date", headerName: "Date", width: 110, pinned: "left",
      valueFormatter: (p: any) => formatDate(p.value),
    },
    {
      field: "invoice_id", headerName: "Invoice", width: 140, pinned: "left",
      cellRenderer: (p: any) =>
        `<span class="text-xs font-semibold" style="color: hsl(var(--primary)); cursor: pointer;">${p.value}</span>`,
    },
    {
      field: "customer_name", headerName: "Customer", width: 175, pinned: "left",
      cellRenderer: (p: any) => {
        const blocked = p.data?.is_blocked
          ? '<span style="font-size:9px;font-weight:700;color:#dc2626;background:#fee2e2;padding:0 4px;border-radius:3px;margin-left:4px;">BLOCKED</span>'
          : '';
        const verified = (p.data?.total_orders || 0) >= 3
          ? '<span style="color:#10b981;margin-left:2px;">✓</span>'
          : '';
        return `<div style="line-height:1.3;">
          <div style="font-size:12px;font-weight:600;">${p.value}${verified}${blocked}</div>
          <div style="font-size:11px;color:hsl(var(--muted-foreground));">${p.data?.customer_phone || ""}</div>
        </div>`;
      },
    },
    { field: "district", headerName: "Area", width: 100 },
    {
      field: "items_count", headerName: "Items", width: 80, type: "numericColumn",
      cellRenderer: (p: any) =>
        `<span style="font-size:11px;" title="${p.data?.items_label || ""}">${p.value} pcs</span>`,
    },
    {
      field: "status", headerName: "Status", width: 135,
      cellRenderer: (p: any) => {
        const cfg = orderStatusConfig[p.value] || { label: p.value, emoji: "", color: "bg-muted text-muted-foreground" };
        return `<span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}">${cfg.emoji} ${cfg.label}</span>`;
      },
    },
    { field: "courier_name", headerName: "Courier", width: 100 },
    {
      field: "tracking_id", headerName: "Tracking", width: 140,
      cellRenderer: (p: any) => p.value
        ? `<span style="font-size:11px;font-family:monospace;color:hsl(var(--primary));">${p.value}</span>`
        : '<span style="color:hsl(var(--muted-foreground));opacity:0.3;">—</span>',
    },
    {
      field: "total_amount", headerName: "Total", width: 100, type: "numericColumn",
      valueFormatter: (p: any) => formatBDT(p.value),
    },
    {
      field: "advance_amount", headerName: "Advance", width: 90, type: "numericColumn",
      cellRenderer: (p: any) => p.value > 0
        ? `<span class="inline-flex px-1.5 py-0.5 rounded-md text-emerald-800 bg-emerald-100" style="font-size:10px;font-weight:700;">৳${(p.value || 0).toLocaleString()}</span>`
        : '<span style="color:hsl(var(--muted-foreground));opacity:0.3;">—</span>',
    },
    {
      field: "courier_cost", headerName: "Cour. Cost", width: 100, type: "numericColumn",
      valueFormatter: (p: any) => p.value != null ? formatBDT(p.value, true) : "—",
    },
    {
      field: "net_payable", headerName: "Net Pay", width: 100, type: "numericColumn",
      valueFormatter: (p: any) => p.value != null ? formatBDT(p.value, true) : "—",
    },
    {
      field: "channel", headerName: "Source", width: 95,
      cellRenderer: (p: any) => {
        const cfg = channelConfig[p.value] || channelConfig.manual;
        return `<span class="inline-flex px-2 py-0.5 rounded-full font-medium ${cfg.color}" style="font-size:10px;">${cfg.emoji} ${cfg.label}</span>`;
      },
    },
    {
      field: "booking_status", headerName: "Sync", width: 85,
      cellRenderer: (p: any) => {
        const v = p.value || "";
        if (!v) return '<span style="color:hsl(var(--muted-foreground));opacity:0.3;">—</span>';
        const color = v === "booked" || v === "SYNCED"
          ? "bg-green-100 text-green-800"
          : v === "FAILED" || v === "error"
            ? "bg-red-100 text-red-800"
            : "bg-muted text-muted-foreground";
        return `<span class="inline-flex px-1.5 py-0.5 rounded-full font-medium ${color}" style="font-size:10px;">${v}</span>`;
      },
    },
    {
      colId: "actions",
      headerName: "",
      width: 50,
      pinned: "right",
      suppressMenu: true,
      sortable: false,
      cellRenderer: ActionsCellRenderer,
    },
  ], []);

  const defaultColDef = useMemo(() => ({
    sortable: true,
    resizable: true,
    suppressMenu: true,
  }), []);

  // ────────── Handlers ──────────
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
      toast({
        title: `✅ ${result.success} updated, ${result.skipped} skipped`,
        description: result.errors.length > 0 ? result.errors.slice(0, 3).join("; ") : undefined,
      });
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
      return {
        Invoice: o.invoice_id || o.order_number,
        Date: formatDate(o.order_date),
        Customer: customer?.full_name || "",
        Phone: customer?.phone || "",
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

  // ────────── Grid context (passed to cell renderers) ──────────
  const gridContext = useMemo(() => ({
    onStatusChange: handleStatusChange,
    onViewDrawer: (id: string) => setDrawerOrderId(id),
    onFullPage: (id: string) => navigate(`/orders/${id}`),
    onCourierEntry: (ids: string[]) => setCourierEntryIds(ids),
    onExchange: (id: string) => navigate(`/exchanges?order=${id}`),
  }), [handleStatusChange, navigate]);

  // ────────── Grid events ──────────
  const onSelectionChanged = useCallback((e: any) => {
    const rows = e.api.getSelectedRows();
    setSelectedIds(new Set(rows.map((r: any) => r.id)));
  }, []);

  const onRowClicked = useCallback((e: any) => {
    const colId = e.column?.getColId?.();
    if (colId === "select" || colId === "actions") return;
    if (e.data?.id) setDrawerOrderId(e.data.id);
  }, []);

  // ────────── Render ──────────
  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Page Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-card">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Orders</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Operations Cockpit — {rowData.length.toLocaleString()} orders
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
          {selectedIds.size > 0 && (
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={() => setCourierEntryIds(Array.from(selectedIds))}
            >
              <Truck className="w-3.5 h-3.5 mr-1" /> Courier Entry ({selectedIds.size})
            </Button>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <OrdersQuickStats
        counts={statusCounts || { all: 0 }}
        activeStatus={statusTab}
        onStatusClick={(s) => { setStatusTab(s); setSelectedIds(new Set()); }}
      />

      {/* Scan Mode */}
      {scanMode && (
        <div className="px-6 py-3 border-b">
          <ScanMode onStatusChange={handleStatusChange} />
        </div>
      )}

      {/* Filter Bar */}
      <OrdersFilterBar
        filters={filters}
        onFiltersChange={(f) => setFilters(f)}
        onRefresh={() => refetch()}
        onExport={handleExport}
        onNewOrder={() => navigate("/orders/new")}
        totalOrders={rowData.length}
      />

      {/* AG Grid */}
      <div className="flex-1 ag-theme-alpine" style={{ width: "100%" }}>
        <AgGridReact
          ref={gridRef}
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          context={gridContext}
          rowHeight={44}
          headerHeight={40}
          animateRows={false}
          suppressCellFocus={true}
          suppressRowClickSelection={true}
          rowSelection="multiple"
          onSelectionChanged={onSelectionChanged}
          onRowClicked={onRowClicked}
          pagination={true}
          paginationPageSize={50}
          paginationPageSizeSelector={[25, 50, 100]}
          overlayLoadingTemplate='<span class="text-muted-foreground">Loading orders…</span>'
          overlayNoRowsTemplate='<span class="text-muted-foreground">No orders match filters</span>'
          loading={isLoading}
          getRowId={(params) => params.data.id}
        />
      </div>

      {/* Bulk Action Toolbar */}
      <BulkActionToolbar
        selectedCount={selectedIds.size}
        onDeselect={() => { setSelectedIds(new Set()); gridRef.current?.api?.deselectAll(); }}
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

      {/* Courier Entry Modal */}
      <CourierEntryModal
        open={courierEntryIds.length > 0}
        onOpenChange={(open) => !open && setCourierEntryIds([])}
        orderIds={courierEntryIds}
        orders={orders || []}
        onComplete={() => {
          setCourierEntryIds([]);
          setSelectedIds(new Set());
          gridRef.current?.api?.deselectAll();
        }}
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

/* ═══════════════════════════════════════════════════════
   Export with Error Boundary
   ═══════════════════════════════════════════════════════ */
export default function OrdersPage() {
  return (
    <OrdersErrorBoundary>
      <OrdersCockpit />
    </OrdersErrorBoundary>
  );
}
