import { useState, useCallback, useMemo, useRef } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { AgGridReact } from "ag-grid-react";
import {
  ModuleRegistry, CommunityFeaturesModule, ColDef,
  SelectionChangedEvent, GetRowIdParams, ICellRendererParams,
} from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompanySettings } from "@/hooks/use-company-settings";
import { useInvoiceSettings } from "@/hooks/use-invoice-settings";
import { printBulkInvoices, printPickingList } from "@/components/orders/PrintInvoice";
import { OrderDetailsDrawer } from "@/components/orders/OrderDetailsDrawer";
import { formatBDT, formatDateTime } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { KpiCard } from "@/components/ui/kpi-card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Search, Printer, ClipboardList, Package, ChevronDown, Loader2,
  RefreshCw, Zap, Banknote, MapPin, AlertTriangle, ShoppingBag,
  Plus, CalendarDays, FolderOpen, CheckCircle2, ArrowRight,
  ExternalLink, StickyNote, Layers,
} from "lucide-react";

ModuleRegistry.registerModules([CommunityFeaturesModule]);

/* ── Filter chips ── */
type QuickChip = "all" | "has_advance" | "needs_address" | "has_exceptions" | "web_only" | "manual_only";
const CHIPS: { key: QuickChip; label: string; icon: any }[] = [
  { key: "all", label: "All", icon: ShoppingBag },
  { key: "has_advance", label: "Has Advance", icon: Banknote },
  { key: "needs_address", label: "Needs Address", icon: MapPin },
  { key: "has_exceptions", label: "Exceptions", icon: AlertTriangle },
  { key: "web_only", label: "Web", icon: ExternalLink },
  { key: "manual_only", label: "Manual", icon: StickyNote },
];

/* ── Badge cell renderers ── */
function AdvanceBadgeCell(props: ICellRendererParams) {
  const amt = props.data?.advance_amount || 0;
  const method = props.data?.advance_method || "";
  if (!amt || amt <= 0) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-xs font-semibold text-emerald-600">{formatBDT(amt)}</span>
      {method && <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{method}</Badge>}
    </span>
  );
}

function SourceBadgeCell(props: ICellRendererParams) {
  const ch = props.value || "manual";
  const map: Record<string, { label: string }> = {
    shopify: { label: "🛍️ Web" }, facebook: { label: "📘 FB" },
    manual: { label: "✍️ Manual" }, whatsapp: { label: "💬 WA" },
    phone: { label: "📞 Phone" },
  };
  const cfg = map[ch] || map.manual;
  return <Badge variant="outline" className="text-[10px] h-4">{cfg.label}</Badge>;
}

function BatchBadgeCell(props: ICellRendererParams) {
  const name = props.value;
  if (!name) return <span className="text-xs text-muted-foreground">—</span>;
  return <Badge className="text-[10px] h-4 bg-primary/10 text-primary border-primary/20">{name}</Badge>;
}

/* ── Main Component ── */
export default function PreOrderList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const gridRef = useRef<AgGridReact>(null);
  const { settings: companySettings } = useCompanySettings();
  const { invoiceSettings } = useInvoiceSettings();

  const [search, setSearch] = useState("");
  const [chip, setChip] = useState<QuickChip>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0, active: false });

  // Batch dialog
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [newBatchName, setNewBatchName] = useState("");
  const [newBatchDate, setNewBatchDate] = useState(new Date().toISOString().split("T")[0]);
  const [assignBatchId, setAssignBatchId] = useState<string>("");

  // ── Fetch preorders ──
  const { data: orders, isLoading, refetch } = useQuery({
    queryKey: ["preorders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(`*, customers(id, full_name, phone, address, district, thana), order_items(id, product_id, quantity, unit_price, products(id, name, sku)), preorder_batch_items(batch_id, preorder_batches(id, name, scheduled_date, status))`)
        .eq("status", "pending")
        .eq("preorder_flag", true)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []).map((o: any) => ({
        ...o,
        _batch: o.preorder_batch_items?.[0]?.preorder_batches || null,
      }));
    },
    staleTime: 30_000,
  });

  // ── Fetch batches ──
  const { data: batches } = useQuery({
    queryKey: ["preorder-batches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("preorder_batches")
        .select("*")
        .eq("status", "open")
        .order("scheduled_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // KPIs
  const kpis = useMemo(() => {
    if (!orders) return { total: 0, totalValue: 0, withAdvance: 0, batched: 0 };
    return {
      total: orders.length,
      totalValue: orders.reduce((s: number, o: any) => s + (o.total_amount || 0), 0),
      withAdvance: orders.filter((o: any) => (o.advance_amount || 0) > 0).length,
      batched: orders.filter((o: any) => o._batch).length,
    };
  }, [orders]);

  // Client filters
  const filtered = useMemo(() => {
    if (!orders) return [];
    let data = orders as any[];
    if (search) {
      const s = search.toLowerCase();
      data = data.filter((o) =>
        o.invoice_id?.toLowerCase().includes(s) ||
        o.order_number?.toLowerCase().includes(s) ||
        o.customers?.full_name?.toLowerCase().includes(s) ||
        o.customers?.phone?.includes(s)
      );
    }
    switch (chip) {
      case "has_advance": data = data.filter((o) => (o.advance_amount || 0) > 0); break;
      case "needs_address": data = data.filter((o) => !o.delivery_district && !o.customers?.district); break;
      case "has_exceptions": data = data.filter((o) => o.courier_status === "ADDRESS_FIX_REQUIRED"); break;
      case "web_only": data = data.filter((o) => o.channel && o.channel !== "manual"); break;
      case "manual_only": data = data.filter((o) => !o.channel || o.channel === "manual"); break;
    }
    return data;
  }, [orders, search, chip]);

  // Selection
  const onSelectionChanged = useCallback((e: SelectionChangedEvent) => {
    setSelectedIds(e.api.getSelectedRows().map((r: any) => r.id));
  }, []);
  const getRowId = useCallback((params: GetRowIdParams) => params.data.id, []);

  // ── Create Batch ──
  const createBatchMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("preorder_batches").insert({
        name: newBatchName,
        scheduled_date: newBatchDate,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["preorder-batches"] });
      toast({ title: `Batch "${data.name}" created` });
      setBatchDialogOpen(false);
      setNewBatchName("");
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  // ── Assign to Batch ──
  const assignToBatch = useCallback(async () => {
    if (!assignBatchId || selectedIds.length === 0) return;
    setBulkProgress({ done: 0, total: selectedIds.length, active: true });
    let success = 0;
    for (let i = 0; i < selectedIds.length; i++) {
      const { error } = await supabase.from("preorder_batch_items").upsert({
        batch_id: assignBatchId,
        order_id: selectedIds[i],
      }, { onConflict: "batch_id,order_id" });
      if (!error) success++;
      setBulkProgress({ done: i + 1, total: selectedIds.length, active: true });
    }
    setBulkProgress({ done: 0, total: 0, active: false });
    queryClient.invalidateQueries({ queryKey: ["preorders"] });
    setSelectedIds([]);
    gridRef.current?.api?.deselectAll();
    toast({ title: `✅ ${success} orders assigned to batch` });
    // Audit
    await supabase.from("audit_logs").insert({
      entity_type: "preorder_batch", entity_id: assignBatchId, action: "batch_assign",
      after_json: { order_ids: selectedIds.slice(0, 50), count: selectedIds.length },
    });
  }, [assignBatchId, selectedIds, queryClient, toast]);

  // ── Move to Approved ──
  const moveToApproved = useCallback(async () => {
    if (selectedIds.length === 0) return;
    setBulkProgress({ done: 0, total: selectedIds.length, active: true });
    let success = 0;
    for (let i = 0; i < selectedIds.length; i++) {
      const { error } = await supabase.from("orders")
        .update({ preorder_flag: false, updated_at: new Date().toISOString() })
        .eq("id", selectedIds[i]);
      if (!error) success++;
      setBulkProgress({ done: i + 1, total: selectedIds.length, active: true });
    }
    setBulkProgress({ done: 0, total: 0, active: false });
    queryClient.invalidateQueries({ queryKey: ["preorders"] });
    queryClient.invalidateQueries({ queryKey: ["approved-orders"] });
    setSelectedIds([]);
    gridRef.current?.api?.deselectAll();
    toast({ title: `✅ ${success} orders moved to Approved` });
    await supabase.from("audit_logs").insert({
      entity_type: "order", entity_id: selectedIds[0], action: "move_to_approved",
      after_json: { order_ids: selectedIds.slice(0, 50), count: selectedIds.length },
    });
  }, [selectedIds, queryClient, toast]);

  // Print
  const handlePrint = useCallback((type: "invoice" | "picking") => {
    const selected = (orders || []).filter((o: any) => selectedIds.includes(o.id));
    if (type === "invoice") printBulkInvoices(selected, companySettings, invoiceSettings);
    if (type === "picking") printPickingList(selected, companySettings);
  }, [orders, selectedIds, companySettings, invoiceSettings]);

  // Row click
  const onRowClicked = useCallback((e: any) => {
    if (e.event?.target?.closest('[role="checkbox"]') || e.event?.target?.closest("input")) return;
    setActiveOrderId(e.data.id);
    setDrawerOpen(true);
  }, []);

  // Columns
  const columnDefs = useMemo<ColDef[]>(() => [
    { headerCheckboxSelection: true, checkboxSelection: true, width: 48, pinned: "left", suppressMovable: true, lockPosition: true },
    {
      headerName: "Invoice", field: "invoice_id", pinned: "left", width: 140,
      valueGetter: (p) => p.data?.invoice_id || p.data?.order_number || "—",
      cellStyle: { fontFamily: "monospace", fontSize: "12px", fontWeight: 600 },
    },
    {
      headerName: "Customer", pinned: "left", width: 150,
      valueGetter: (p) => p.data?.customers?.full_name || "—",
    },
    {
      headerName: "Phone", width: 120,
      valueGetter: (p) => p.data?.customers?.phone || "",
      cellStyle: { fontFamily: "monospace", fontSize: "11px" },
    },
    {
      headerName: "District", width: 100,
      valueGetter: (p) => p.data?.delivery_district || p.data?.customers?.district || "",
      cellStyle: { fontSize: "11px" },
    },
    {
      headerName: "Thana", width: 100,
      valueGetter: (p) => p.data?.delivery_thana || p.data?.customers?.thana || "",
      cellStyle: { fontSize: "11px" },
    },
    {
      headerName: "Items", width: 170,
      valueGetter: (p) => {
        const items = p.data?.order_items || [];
        return items.map((i: any) => `${i.products?.sku || "?"} ×${i.quantity}`).join(", ");
      },
      cellStyle: { fontSize: "11px" },
    },
    {
      headerName: "Total", field: "total_amount", width: 100, type: "numericColumn",
      valueFormatter: (p) => formatBDT(p.value),
      cellStyle: { fontWeight: 600, fontSize: "12px" },
    },
    { headerName: "Advance", width: 130, cellRenderer: AdvanceBadgeCell },
    { headerName: "Source", field: "channel", width: 90, cellRenderer: SourceBadgeCell },
    {
      headerName: "Batch", width: 120,
      valueGetter: (p) => p.data?._batch?.name || null,
      cellRenderer: BatchBadgeCell,
    },
    {
      headerName: "Created", field: "created_at", width: 130, sort: "desc",
      valueFormatter: (p) => formatDateTime(p.value),
      cellStyle: { fontSize: "11px" },
    },
    { headerName: "Notes", field: "notes", width: 160, cellStyle: { fontSize: "11px" } },
  ], []);

  const defaultColDef = useMemo(() => ({ sortable: true, filter: true, resizable: true }), []);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard title="Pre Orders" value={kpis.total.toLocaleString()} icon={<Package className="w-5 h-5" />} />
        <KpiCard title="Queue Value" value={formatBDT(kpis.totalValue)} icon={<Banknote className="w-5 h-5" />} />
        <KpiCard title="With Advance" value={kpis.withAdvance.toLocaleString()} icon={<Banknote className="w-5 h-5" />} className="border-emerald-200" />
        <KpiCard title="In Batches" value={kpis.batched.toLocaleString()} icon={<Layers className="w-5 h-5" />} />
      </div>

      {/* Toolbar */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Chips */}
            <div className="flex items-center gap-1 flex-wrap">
              {CHIPS.map((c) => (
                <Button key={c.key} variant={chip === c.key ? "default" : "outline"} size="sm" className="h-7 text-[11px] gap-1 px-2.5" onClick={() => setChip(c.key)}>
                  <c.icon className="w-3 h-3" />{c.label}
                </Button>
              ))}
            </div>

            <div className="flex-1" />

            <div className="relative min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input placeholder="Invoice, phone, name..." className="pl-8 h-8 text-xs" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => setBatchDialogOpen(true)}>
              <Plus className="w-3 h-3" /> New Batch
            </Button>

            <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => refetch()}>
              <RefreshCw className="w-3 h-3" /> Refresh
            </Button>

            {/* Bulk */}
            {selectedIds.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" className="gap-1.5 h-8 text-xs">
                    <Zap className="w-3 h-3" /> Actions ({selectedIds.length})<ChevronDown className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuItem onClick={() => handlePrint("invoice")}>
                    <Printer className="w-4 h-4 mr-2" /> Print Invoices
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handlePrint("picking")}>
                    <ClipboardList className="w-4 h-4 mr-2" /> Print Picking List
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />

                  {/* Assign to batch sub-section */}
                  <div className="px-2 py-1.5">
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Assign to Batch</Label>
                    <div className="flex gap-1 mt-1">
                      <Select value={assignBatchId} onValueChange={setAssignBatchId}>
                        <SelectTrigger className="h-7 text-xs flex-1"><SelectValue placeholder="Select batch" /></SelectTrigger>
                        <SelectContent>
                          {(batches || []).map((b: any) => (
                            <SelectItem key={b.id} value={b.id}>{b.name} ({b.scheduled_date})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="sm" className="h-7 text-xs px-2" onClick={assignToBatch} disabled={!assignBatchId}>
                        <CheckCircle2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={moveToApproved}>
                    <ArrowRight className="w-4 h-4 mr-2" /> Move to Approved
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {bulkProgress.active && (
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing {bulkProgress.done}/{bulkProgress.total}...
            </div>
          )}
        </CardContent>
      </Card>

      {/* Open Batches summary */}
      {(batches || []).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {(batches || []).map((b: any) => (
            <Badge key={b.id} variant="outline" className="text-xs gap-1.5 py-1 px-2.5">
              <FolderOpen className="w-3 h-3" />
              {b.name} — {b.scheduled_date}
            </Badge>
          ))}
        </div>
      )}

      {/* Grid */}
      <Card>
        <CardContent className="p-0">
          <div className="ag-theme-alpine" style={{ height: "calc(100vh - 340px)", width: "100%" }}>
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
              animateRows
              pagination
              paginationPageSize={100}
              overlayNoRowsTemplate="<span class='text-muted-foreground text-sm'>No pre-orders found</span>"
              overlayLoadingTemplate="<span class='text-muted-foreground text-sm'>Loading pre-orders...</span>"
            />
          </div>
        </CardContent>
      </Card>

      {/* New Batch Dialog */}
      <Dialog open={batchDialogOpen} onOpenChange={setBatchDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CalendarDays className="w-4 h-4" /> Create Batch</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Batch Name</Label>
              <Input className="h-9 text-xs mt-1" placeholder="e.g. Morning Batch - Feb 25" value={newBatchName} onChange={(e) => setNewBatchName(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Scheduled Date</Label>
              <Input className="h-9 text-xs mt-1" type="date" value={newBatchDate} onChange={(e) => setNewBatchDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setBatchDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={() => createBatchMutation.mutate()} disabled={!newBatchName.trim() || createBatchMutation.isPending}>
              {createBatchMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Order Drawer */}
      {activeOrderId && (
        <OrderDetailsDrawer
          orderId={activeOrderId}
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
        />
      )}
    </div>
  );
}
