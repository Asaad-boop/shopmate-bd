import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AgGridReact } from "ag-grid-react";
import { ColDef, GridReadyEvent, RowClickedEvent } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { StatusBadge } from "@/components/ui/status-badge";
import { orderStatusConfig, validTransitions, formatBDT, formatDate } from "@/lib/format";
import { applyStatusChange, applyDamageReturn } from "@/hooks/use-orders";
import { StatusChangeModal } from "@/components/orders/StatusChangeModal";
import { DamageReturnModal } from "@/components/orders/DamageReturnModal";
import { ScanMode } from "@/components/orders/ScanMode";
import { printInvoice, printBulkInvoices, printPickingList, printPackingSlip, printBarcodeLabels } from "@/components/orders/PrintInvoice";
import { BulkActionToolbar } from "@/components/orders/BulkActionToolbar";
import { OrderDetailsDrawer } from "@/components/orders/OrderDetailsDrawer";
import { CODReconciliation } from "@/components/orders/CODReconciliation";
import { useToast } from "@/hooks/use-toast";
import { useCompanySettings } from "@/hooks/use-company-settings";
import { useInvoiceSettings } from "@/hooks/use-invoice-settings";
import {
  Plus, Search, ScanLine, Banknote, RefreshCw, Download,
  ChevronLeft, ChevronRight,
} from "lucide-react";

/* ────────── Status Pipeline Tabs ────────── */
const PIPELINE_TABS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "packed", label: "Packed" },
  { key: "ready_to_ship", label: "RTS" },
  { key: "shipped", label: "Shipped" },
  { key: "in_transit", label: "In Transit" },
  { key: "delivered", label: "Delivered" },
  { key: "returned", label: "Returned" },
  { key: "exchanged", label: "Exchanged" },
  { key: "cancelled", label: "Cancelled" },
  { key: "damage_return", label: "Damage" },
];

export default function OrdersPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { settings: companySettings } = useCompanySettings();
  const { invoiceSettings } = useInvoiceSettings();
  const gridRef = useRef<AgGridReact>(null);

  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [scanMode, setScanMode] = useState(false);
  const [codPanelOpen, setCodPanelOpen] = useState(false);
  const [drawerOrderId, setDrawerOrderId] = useState<string | null>(null);

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
        .select(`*, customers(full_name, phone, address, district, thana),
                 order_items(id, product_id, quantity, unit_price, total_price, products(id, name, sku, image_url, stock_quantity, weight_kg))`)
        .order("order_date", { ascending: false })
        .or("web_order_status.is.null,web_order_status.eq.confirm")
        .limit(300);

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

  // Shipment data for courier cost / net payable
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

  /* ────────── Filtered rows for AG Grid ────────── */
  const rows = useMemo(() => {
    if (!orders) return [];
    return orders
      .filter((o) => {
        if (!search) return true;
        const s = search.toLowerCase();
        return (
          o.order_number?.toLowerCase().includes(s) ||
          (o.customers as any)?.full_name?.toLowerCase().includes(s) ||
          (o.customers as any)?.phone?.includes(s) ||
          o.invoice_id?.toLowerCase().includes(s) ||
          o.pathao_tracking_code?.toLowerCase().includes(s)
        );
      })
      .map((o) => {
        const customer = o.customers as any;
        const items = (o.order_items || []) as any[];
        const shipment = shipmentMap?.[o.id];
        return {
          id: o.id,
          invoice_id: o.invoice_id || o.order_number,
          customer_name: customer?.full_name || "—",
          phone: customer?.phone || "",
          area: o.delivery_district || customer?.district || "—",
          items_summary: items.map((i: any) => `${i.products?.name || "?"} ×${i.quantity}`).join(", ") || "—",
          items_count: items.reduce((s: number, i: any) => s + i.quantity, 0),
          status: o.status || "pending",
          courier: shipment?.couriers?.name || (o.pathao_consignment_id ? "Pathao" : "—"),
          tracking_id: o.pathao_tracking_code || shipment?.tracking_id || "—",
          customer_total: o.total_amount || 0,
          courier_cost: shipment?.courier_total_cost ?? null,
          net_payable: shipment?.courier_net_payable ?? null,
          advance_amount: o.advance_amount || 0,
          payment_method: o.payment_method,
          settlement_status: (o as any).settlement_status || null,
          sync_status: o.courier_status || null,
          exception_count: (o as any).exception_count || 0,
          order_date: o.order_date,
          _raw: o,
        };
      });
  }, [orders, search, shipmentMap]);

  /* ────────── AG Grid Columns ────────── */
  const columnDefs: ColDef[] = useMemo(() => [
    {
      headerCheckboxSelection: true,
      checkboxSelection: true,
      width: 48,
      maxWidth: 48,
      suppressSizeToFit: true,
      headerCheckboxSelectionFilteredOnly: true,
    },
    {
      field: "invoice_id", headerName: "Invoice ID", width: 140, pinned: "left",
      cellClass: "font-medium text-primary cursor-pointer",
    },
    { field: "customer_name", headerName: "Customer", width: 160, pinned: "left" },
    { field: "phone", headerName: "Phone", width: 130 },
    { field: "area", headerName: "Area", width: 120 },
    {
      field: "items_count", headerName: "Items", width: 80, type: "numericColumn",
      cellRenderer: (p: any) => {
        const count = p.value || 0;
        return `<span class="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold">${count}</span>`;
      },
    },
    {
      field: "status", headerName: "Status", width: 150,
      cellRenderer: (p: any) => {
        const cfg = orderStatusConfig[p.value] || { label: p.value, emoji: "", color: "bg-muted text-muted-foreground" };
        return `<span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}">${cfg.emoji} ${cfg.label}</span>`;
      },
    },
    { field: "courier", headerName: "Courier", width: 110 },
    {
      field: "tracking_id", headerName: "Tracking ID", width: 160,
      cellRenderer: (p: any) => {
        if (!p.value || p.value === "—") return "—";
        return `<span class="font-mono text-xs text-primary cursor-pointer hover:underline">${p.value}</span>`;
      },
    },
    {
      field: "customer_total", headerName: "Total", width: 110, type: "numericColumn",
      valueFormatter: (p: any) => formatBDT(p.value),
    },
    {
      field: "courier_cost", headerName: "Courier Cost", width: 110, type: "numericColumn",
      valueFormatter: (p: any) => p.value != null ? formatBDT(p.value, true) : "—",
    },
    {
      field: "net_payable", headerName: "Net Payable", width: 110, type: "numericColumn",
      valueFormatter: (p: any) => p.value != null ? formatBDT(p.value, true) : "—",
    },
    {
      field: "advance_amount", headerName: "Advance", width: 100,
      cellRenderer: (p: any) => {
        if (!p.value || p.value <= 0) return "—";
        return `<span class="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">৳${p.value.toLocaleString()}</span>`;
      },
    },
    {
      field: "settlement_status", headerName: "Settlement", width: 110,
      cellRenderer: (p: any) => {
        if (!p.value) return "—";
        const c = p.value === "posted" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800";
        return `<span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${c}">${p.value}</span>`;
      },
    },
    {
      field: "sync_status", headerName: "Sync", width: 100,
      cellRenderer: (p: any) => {
        const v = p.value || "";
        if (!v || v === "—") return "—";
        const c = v === "Pending" ? "bg-blue-100 text-blue-800" : v.includes("FAIL") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-800";
        return `<span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${c}">${v}</span>`;
      },
    },
    {
      field: "exception_count", headerName: "Exc.", width: 70, type: "numericColumn",
      cellRenderer: (p: any) => {
        if (!p.value || p.value === 0) return "";
        return `<span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold">${p.value}</span>`;
      },
    },
  ], []);

  const defaultColDef = useMemo(() => ({
    sortable: true,
    resizable: true,
    suppressMenu: true,
  }), []);

  /* ────────── Selection ────────── */
  const onSelectionChanged = useCallback(() => {
    const selected = gridRef.current?.api?.getSelectedRows() || [];
    setSelectedIds(new Set(selected.map((r: any) => r.id)));
  }, []);

  const onRowClicked = useCallback((e: RowClickedEvent) => {
    if ((e.event?.target as HTMLElement)?.closest('.ag-checkbox-input-wrapper')) return;
    setDrawerOrderId(e.data?.id || null);
  }, []);

  /* ────────── Status change with transition validation ────────── */
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

  /* ────────── Bulk actions ────────── */
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

  // CSV Export
  const exportCSV = () => {
    if (!rows.length) return;
    const headers = ["Invoice", "Customer", "Phone", "Area", "Status", "Courier", "Tracking", "Total", "Courier Cost", "Net Payable", "Advance", "Settlement"];
    const csvRows = rows.map((r) => [
      r.invoice_id, r.customer_name, r.phone, r.area, r.status, r.courier,
      r.tracking_id, r.customer_total, r.courier_cost ?? "", r.net_payable ?? "",
      r.advance_amount, r.settlement_status ?? "",
    ]);
    const csv = [headers, ...csvRows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-background">
        <div>
          <h1 className="text-xl font-bold text-foreground">Orders Cockpit</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} orders • Pipeline: PENDING → PACKED → RTS → SHIPPED → DELIVERED
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCodPanelOpen(true)}>
            <Banknote className="w-4 h-4 mr-1" /> COD
          </Button>
          <Button
            variant={scanMode ? "default" : "outline"}
            size="sm"
            onClick={() => setScanMode(!scanMode)}
          >
            <ScanLine className="w-4 h-4 mr-1" /> Scan
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="w-4 h-4 mr-1" /> CSV
          </Button>
          <Link to="/orders/new">
            <Button size="sm">
              <Plus className="w-4 h-4 mr-1" /> New Order
            </Button>
          </Link>
        </div>
      </div>

      {/* Scan Mode */}
      {scanMode && <ScanMode onStatusChange={handleStatusChange} />}

      {/* Status Pipeline Tabs */}
      <div className="relative group/tabs border-b bg-background">
        <button
          onClick={() => document.getElementById('pipeline-tabs')?.scrollBy({ left: -200, behavior: 'smooth' })}
          className="absolute left-0 top-0 bottom-0 z-10 flex items-center px-1.5 bg-gradient-to-r from-background via-background/80 to-transparent opacity-0 group-hover/tabs:opacity-100 transition-opacity"
        >
          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <div
          id="pipeline-tabs"
          className="flex gap-0 overflow-x-auto px-6"
          style={{ scrollbarWidth: 'none' }}
        >
          {PIPELINE_TABS.map((tab) => {
            const isActive = statusTab === tab.key;
            const count = tab.key === "all" ? (statusCounts?.all || 0) : (statusCounts?.[tab.key] || 0);
            return (
              <button
                key={tab.key}
                onClick={() => setStatusTab(tab.key)}
                className={cn(
                  "relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all duration-200",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {orderStatusConfig[tab.key]?.emoji} {tab.label}
                {count > 0 && (
                  <span className={cn(
                    "text-[11px] font-semibold min-w-[20px] h-5 px-1.5 rounded-full inline-flex items-center justify-center",
                    isActive ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                  )}>
                    {count}
                  </span>
                )}
                <span className={cn(
                  "absolute bottom-0 left-2 right-2 h-[2.5px] rounded-full transition-all duration-200",
                  isActive ? "bg-primary scale-x-100" : "bg-transparent scale-x-0"
                )} />
              </button>
            );
          })}
        </div>
        <button
          onClick={() => document.getElementById('pipeline-tabs')?.scrollBy({ left: 200, behavior: 'smooth' })}
          className="absolute right-0 top-0 bottom-0 z-10 flex items-center px-1.5 bg-gradient-to-l from-background via-background/80 to-transparent opacity-0 group-hover/tabs:opacity-100 transition-opacity"
        >
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Search Bar */}
      <div className="px-6 py-3 border-b bg-background">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search invoice, customer, phone, tracking…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* AG Grid */}
      <div className="flex-1 px-6 pb-20 ag-theme-alpine" style={{ minHeight: 400 }}>
        <AgGridReact
          ref={gridRef}
          rowData={rows}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          rowSelection="multiple"
          suppressRowClickSelection={true}
          onSelectionChanged={onSelectionChanged}
          onRowClicked={onRowClicked}
          getRowId={(p) => p.data.id}
          animateRows
          rowHeight={44}
          headerHeight={40}
          loading={isLoading}
          overlayNoRowsTemplate='<span class="text-muted-foreground py-8">No orders found</span>'
        />
      </div>

      {/* Bulk Action Toolbar */}
      <BulkActionToolbar
        selectedCount={selectedIds.size}
        onDeselect={() => {
          setSelectedIds(new Set());
          gridRef.current?.api?.deselectAll();
        }}
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

      <CODReconciliation open={codPanelOpen} onOpenChange={setCodPanelOpen} />
      <OrderDetailsDrawer
        open={!!drawerOrderId}
        onOpenChange={(open) => !open && setDrawerOrderId(null)}
        orderId={drawerOrderId}
      />
    </div>
  );
}
