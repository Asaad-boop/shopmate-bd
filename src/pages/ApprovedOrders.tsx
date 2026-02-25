import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AgGridReact } from "ag-grid-react";
import {
  ModuleRegistry, CommunityFeaturesModule, ColDef,
  CellValueChangedEvent, GetRowIdParams, SelectionChangedEvent,
  ICellRendererParams,
} from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompanySettings } from "@/hooks/use-company-settings";
import { useInvoiceSettings } from "@/hooks/use-invoice-settings";
import { applyStatusChange } from "@/hooks/use-orders";
import { OrderDetailsDrawer } from "@/components/orders/OrderDetailsDrawer";
import { printBulkInvoices, printPickingList } from "@/components/orders/PrintInvoice";
import { formatBDT, formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { KpiCard } from "@/components/ui/kpi-card";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Search, Printer, ClipboardList, Package, Truck, Send,
  ChevronDown, Loader2, RefreshCw, Zap, StickyNote,
  Banknote, MapPin, AlertTriangle, ShoppingBag, Plus,
  Filter, ExternalLink,
} from "lucide-react";
import { Link } from "react-router-dom";

ModuleRegistry.registerModules([CommunityFeaturesModule]);

/* ─── Filter chip types ─── */
type QuickChip = "all" | "has_advance" | "needs_address" | "has_exceptions" | "web_only" | "manual_only";

const CHIPS: { key: QuickChip; label: string; icon: any }[] = [
  { key: "all", label: "All", icon: ShoppingBag },
  { key: "has_advance", label: "Has Advance", icon: Banknote },
  { key: "needs_address", label: "Needs Address Fix", icon: MapPin },
  { key: "has_exceptions", label: "Has Exceptions", icon: AlertTriangle },
  { key: "web_only", label: "Web Orders", icon: ExternalLink },
  { key: "manual_only", label: "Manual Orders", icon: StickyNote },
];

/* ─── Badge renderers ─── */
function StatusBadgeCell(props: ICellRendererParams) {
  const v = props.value || "pending";
  const colors: Record<string, string> = {
    pending: "#fef3c7", packed: "#dbeafe", shipped: "#c7d2fe",
    delivered: "#d1fae5", cancelled: "#fee2e2",
  };
  return (
    <span style={{
      backgroundColor: colors[v] || "#f3f4f6",
      padding: "2px 8px", borderRadius: "9999px",
      fontSize: "11px", fontWeight: 600,
    }}>
      {v.charAt(0).toUpperCase() + v.slice(1)}
    </span>
  );
}

function AdvanceBadgeCell(props: ICellRendererParams) {
  const amt = props.data?.advance_amount || 0;
  const method = props.data?.advance_method || "";
  if (!amt || amt <= 0) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-xs font-semibold" style={{ color: "hsl(160,84%,30%)" }}>
        {formatBDT(amt)}
      </span>
      {method && (
        <span style={{
          backgroundColor: "#dbeafe", padding: "1px 6px",
          borderRadius: "9999px", fontSize: "10px", fontWeight: 600,
        }}>
          {method}
        </span>
      )}
    </span>
  );
}

function SourceBadgeCell(props: ICellRendererParams) {
  const ch = props.value || "manual";
  const map: Record<string, { bg: string; label: string }> = {
    shopify: { bg: "#d1fae5", label: "🛍️ Shopify" },
    facebook: { bg: "#dbeafe", label: "📘 Facebook" },
    instagram: { bg: "#fce7f3", label: "📸 Instagram" },
    whatsapp: { bg: "#dcfce7", label: "💬 WhatsApp" },
    phone: { bg: "#fef9c3", label: "📞 Phone" },
    manual: { bg: "#f3f4f6", label: "✍️ Manual" },
  };
  const cfg = map[ch] || map.manual;
  return (
    <span style={{
      backgroundColor: cfg.bg, padding: "2px 8px",
      borderRadius: "9999px", fontSize: "11px", fontWeight: 600,
    }}>
      {cfg.label}
    </span>
  );
}

export default function ApprovedOrders() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const gridRef = useRef<AgGridReact>(null);
  const { settings: companySettings } = useCompanySettings();
  const { invoiceSettings } = useInvoiceSettings();

  const [search, setSearch] = useState("");
  const [chip, setChip] = useState<QuickChip>("all");
  const [includeLegacy, setIncludeLegacy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0, active: false });

  // Fetch approved orders (pending, not cancelled)
  const { data: orders, isLoading, refetch } = useQuery({
    queryKey: ["approved-orders", includeLegacy],
    queryFn: async () => {
      let q = supabase
        .from("orders")
        .select("*, customers(id, full_name, phone, address, district, thana), order_items(id, product_id, quantity, unit_price, products(id, name, sku))")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(500);

      if (!includeLegacy) {
        q = q.is("legacy_batch_id", null);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });

  // KPI counts
  const kpis = useMemo(() => {
    if (!orders) return { total: 0, withAdvance: 0, needsAddress: 0, totalValue: 0 };
    return {
      total: orders.length,
      withAdvance: orders.filter((o: any) => (o.advance_amount || 0) > 0).length,
      needsAddress: orders.filter((o: any) => {
        const d = o.delivery_district || (o.customers as any)?.district;
        return !d || d.trim() === "";
      }).length,
      totalValue: orders.reduce((s: number, o: any) => s + (o.total_amount || 0), 0),
    };
  }, [orders]);

  // Client-side filters
  const filtered = useMemo(() => {
    if (!orders) return [];
    let data = orders as any[];

    // Search
    if (search) {
      const s = search.toLowerCase();
      data = data.filter((o) =>
        o.invoice_id?.toLowerCase().includes(s) ||
        o.order_number?.toLowerCase().includes(s) ||
        (o.customers as any)?.full_name?.toLowerCase().includes(s) ||
        (o.customers as any)?.phone?.includes(s)
      );
    }

    // Chips
    switch (chip) {
      case "has_advance":
        data = data.filter((o) => (o.advance_amount || 0) > 0);
        break;
      case "needs_address":
        data = data.filter((o) => {
          const d = o.delivery_district || (o.customers as any)?.district;
          return !d || d.trim() === "";
        });
        break;
      case "has_exceptions":
        data = data.filter((o) => o.courier_status === "ADDRESS_FIX_REQUIRED" || o.courier_status === "PATHAO_FAILED");
        break;
      case "web_only":
        data = data.filter((o) => o.channel && o.channel !== "manual");
        break;
      case "manual_only":
        data = data.filter((o) => !o.channel || o.channel === "manual");
        break;
    }

    return data;
  }, [orders, search, chip]);

  // Selection handler
  const onSelectionChanged = useCallback((e: SelectionChangedEvent) => {
    const ids = e.api.getSelectedRows().map((r: any) => r.id);
    setSelectedIds(ids);
  }, []);

  const getRowId = useCallback((params: GetRowIdParams) => params.data.id, []);

  // Inline edit handler
  const handleCellEdit = useCallback(async (event: CellValueChangedEvent) => {
    const { data, colDef, oldValue, newValue } = event;
    if (oldValue === newValue) return;
    const field = colDef.field as string;

    if (field === "notes") {
      const { error } = await supabase.from("orders").update({ notes: newValue }).eq("id", data.id);
      if (error) { event.node.setDataValue(field, oldValue); toast({ title: "Update failed", variant: "destructive" }); return; }
    } else if (field === "delivery_district" || field === "delivery_thana") {
      const { error } = await supabase.from("orders").update({ [field]: newValue }).eq("id", data.id);
      if (error) { event.node.setDataValue(field, oldValue); toast({ title: "Update failed", variant: "destructive" }); return; }
    }

    await supabase.from("audit_logs").insert({
      entity_type: "order", entity_id: data.id, action: "inline_edit",
      before_json: { [field]: oldValue }, after_json: { [field]: newValue },
    });
    toast({ title: "Updated", description: `${field}: ${oldValue} → ${newValue}` });
  }, [toast]);

  // Column definitions
  const columnDefs = useMemo<ColDef[]>(() => [
    { headerCheckboxSelection: true, checkboxSelection: true, width: 48, pinned: "left", suppressMovable: true, lockPosition: true },
    {
      headerName: "Invoice", field: "invoice_id", pinned: "left", width: 140, editable: false,
      valueGetter: (p) => p.data?.invoice_id || p.data?.order_number || "—",
      cellStyle: { fontFamily: "monospace", fontSize: "12px", fontWeight: 600 },
    },
    {
      headerName: "Customer", pinned: "left", width: 150, editable: false,
      valueGetter: (p) => (p.data?.customers as any)?.full_name || "—",
    },
    {
      headerName: "Phone", width: 120, editable: false,
      valueGetter: (p) => (p.data?.customers as any)?.phone || "",
      cellStyle: { fontFamily: "monospace", fontSize: "11px" },
    },
    {
      headerName: "District", field: "delivery_district", width: 110, editable: true,
      valueGetter: (p) => p.data?.delivery_district || (p.data?.customers as any)?.district || "",
      cellStyle: { fontSize: "11px" },
    },
    {
      headerName: "Thana", field: "delivery_thana", width: 110, editable: true,
      valueGetter: (p) => p.data?.delivery_thana || (p.data?.customers as any)?.thana || "",
      cellStyle: { fontSize: "11px" },
    },
    {
      headerName: "Total", field: "total_amount", pinned: "left", width: 100, editable: false,
      type: "numericColumn",
      valueFormatter: (p) => formatBDT(p.value),
      cellStyle: { fontWeight: 600, fontSize: "12px" },
    },
    {
      headerName: "Advance", width: 130, editable: false,
      cellRenderer: AdvanceBadgeCell,
    },
    {
      headerName: "Items", width: 160, editable: false,
      valueGetter: (p) => {
        const items = p.data?.order_items || [];
        return items.map((i: any) => `${(i.products as any)?.sku || "?"} ×${i.quantity}`).join(", ");
      },
      cellStyle: { fontSize: "11px" },
    },
    {
      headerName: "Source", field: "channel", width: 110, editable: false,
      cellRenderer: SourceBadgeCell,
    },
    {
      headerName: "Created", field: "created_at", width: 130, editable: false,
      valueFormatter: (p) => formatDateTime(p.value),
      cellStyle: { fontSize: "11px" },
      sort: "desc",
    },
    {
      headerName: "Notes", field: "notes", width: 180, editable: true,
      cellStyle: { fontSize: "11px" },
    },
  ], []);

  const defaultColDef = useMemo(() => ({
    sortable: true, filter: true, resizable: true,
  }), []);

  // Row click
  const onRowClicked = useCallback((e: any) => {
    if (e.event?.target?.closest('[role="checkbox"]') || e.event?.target?.closest('input')) return;
    setActiveOrderId(e.data.id);
    setDrawerOpen(true);
  }, []);

  // ── Bulk Actions ──
  const runBulkStatus = useCallback(async (newStatus: string) => {
    if (selectedIds.length === 0) return;
    setChanging(true);
    setBulkProgress({ done: 0, total: selectedIds.length, active: true });
    let success = 0;
    for (let i = 0; i < selectedIds.length; i++) {
      try {
        await applyStatusChange(selectedIds[i], newStatus, "pending");
        success++;
      } catch { /* skip */ }
      setBulkProgress({ done: i + 1, total: selectedIds.length, active: true });
    }
    setBulkProgress({ done: 0, total: 0, active: false });
    setChanging(false);
    queryClient.invalidateQueries({ queryKey: ["approved-orders"] });
    setSelectedIds([]);
    gridRef.current?.api?.deselectAll();
    toast({ title: `✅ ${success}/${selectedIds.length} orders → ${newStatus}` });
  }, [selectedIds, queryClient, toast]);

  const handleBulkPrint = useCallback((type: "invoice" | "picking") => {
    const selected = (orders || []).filter((o: any) => selectedIds.includes(o.id));
    if (type === "invoice") printBulkInvoices(selected, companySettings, invoiceSettings);
    if (type === "picking") printPickingList(selected, companySettings);
  }, [orders, selectedIds, companySettings, invoiceSettings]);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard title="Approved Queue" value={kpis.total.toLocaleString()} icon={<ShoppingBag className="w-5 h-5" />} />
        <KpiCard title="Queue Value" value={formatBDT(kpis.totalValue)} icon={<Banknote className="w-5 h-5" />} />
        <KpiCard title="With Advance" value={kpis.withAdvance.toLocaleString()} icon={<Banknote className="w-5 h-5" />} className="border-emerald-200" />
        <KpiCard title="Needs Address Fix" value={kpis.needsAddress.toLocaleString()} icon={<MapPin className="w-5 h-5" />} className={kpis.needsAddress > 0 ? "border-destructive/40" : ""} />
      </div>

      {/* Toolbar */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Filter chips */}
            <div className="flex items-center gap-1 flex-wrap">
              {CHIPS.map((c) => (
                <Button
                  key={c.key}
                  variant={chip === c.key ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-[11px] gap-1 px-2.5"
                  onClick={() => setChip(c.key)}
                >
                  <c.icon className="w-3 h-3" />
                  {c.label}
                </Button>
              ))}
            </div>

            <div className="flex-1" />

            {/* Search */}
            <div className="relative min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Invoice, phone, name..."
                className="pl-8 h-8 text-xs"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Include legacy toggle */}
            <div className="flex items-center gap-1.5">
              <Switch id="legacy-toggle" checked={includeLegacy} onCheckedChange={setIncludeLegacy} />
              <Label htmlFor="legacy-toggle" className="text-xs cursor-pointer">Legacy</Label>
            </div>

            <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => refetch()}>
              <RefreshCw className="w-3 h-3" /> Refresh
            </Button>

            {/* Bulk actions */}
            {selectedIds.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" className="gap-1.5 h-8 text-xs">
                    <Zap className="w-3 h-3" />
                    Bulk ({selectedIds.length})
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => handleBulkPrint("invoice")} disabled={changing}>
                    <Printer className="w-4 h-4 mr-2" /> Print Invoices
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkPrint("picking")} disabled={changing}>
                    <ClipboardList className="w-4 h-4 mr-2" /> Print Picking List
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => runBulkStatus("packed")} disabled={changing}>
                    <Package className="w-4 h-4 mr-2" /> Mark as Packed
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => runBulkStatus("shipped")} disabled={changing}>
                    <Truck className="w-4 h-4 mr-2" /> Mark as Shipped
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled>
                    <Send className="w-4 h-4 mr-2" /> Assign Courier (coming soon)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Bulk progress */}
          {bulkProgress.active && (
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Processing {bulkProgress.done}/{bulkProgress.total}...
            </div>
          )}
        </CardContent>
      </Card>

      {/* AG Grid */}
      <Card>
        <CardContent className="p-0">
          <div className="ag-theme-alpine" style={{ height: "calc(100vh - 320px)", width: "100%" }}>
            <AgGridReact
              ref={gridRef}
              rowData={filtered}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              getRowId={getRowId}
              rowSelection="multiple"
              suppressRowClickSelection
              onSelectionChanged={onSelectionChanged}
              onRowClicked={onRowClicked}
              onCellValueChanged={handleCellEdit}
              animateRows
              rowHeight={40}
              headerHeight={36}
              suppressCellFocus={false}
              enableCellTextSelection
            />
          </div>
        </CardContent>
      </Card>

      {/* Order drawer */}
      <OrderDetailsDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        orderId={activeOrderId}
      />
    </div>
  );
}
