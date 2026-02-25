import { useState, useCallback, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AgGridReact } from "ag-grid-react";
import { ColDef, GridReadyEvent } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { OrderDetailsDrawer } from "@/components/orders/OrderDetailsDrawer";
import { formatBDT, formatDate, formatDateTime, orderStatusConfig } from "@/lib/format";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Search, Download, RefreshCw, Filter, CalendarIcon, X, ChevronLeft, ChevronRight,
  AlertTriangle
} from "lucide-react";
import { format, subDays } from "date-fns";
import { toast } from "sonner";

const STATUSES = ["pending", "packed", "shipped", "delivered", "returned", "cancelled", "damage_return", "pending_return"];
const SOURCES = ["shopify", "facebook", "manual", "phone", "whatsapp", "instagram"];
const PAGE_SIZE = 50;

interface Filters {
  search: string;
  statuses: string[];
  sources: string[];
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  deliveredFrom: Date | undefined;
  deliveredTo: Date | undefined;
  hasAdvance: string;
  exceptionsOnly: boolean;
  settlementStatus: string;
  syncStatus: string;
  amountMin: string;
  amountMax: string;
}

const defaultFilters: Filters = {
  search: "",
  statuses: [],
  sources: [],
  dateFrom: subDays(new Date(), 7),
  dateTo: new Date(),
  deliveredFrom: undefined,
  deliveredTo: undefined,
  hasAdvance: "all",
  exceptionsOnly: false,
  settlementStatus: "all",
  syncStatus: "all",
  amountMin: "",
  amountMax: "",
};

export default function AllOrders() {
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [page, setPage] = useState(0);
  const [drawerOrderId, setDrawerOrderId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [exporting, setExporting] = useState(false);
  const gridRef = useRef<AgGridReact>(null);

  const queryParams = useMemo(() => ({
    p_search: filters.search || null,
    p_status: filters.statuses.length > 0 ? filters.statuses : null,
    p_source: filters.sources.length > 0 ? filters.sources : null,
    p_date_from: filters.dateFrom ? format(filters.dateFrom, "yyyy-MM-dd") : null,
    p_date_to: filters.dateTo ? format(filters.dateTo, "yyyy-MM-dd") : null,
    p_delivered_from: filters.deliveredFrom ? format(filters.deliveredFrom, "yyyy-MM-dd") : null,
    p_delivered_to: filters.deliveredTo ? format(filters.deliveredTo, "yyyy-MM-dd") : null,
    p_has_advance: filters.hasAdvance === "all" ? null : filters.hasAdvance,
    p_exceptions_only: filters.exceptionsOnly,
    p_settlement_status: filters.settlementStatus === "all" ? null : filters.settlementStatus,
    p_sync_status: filters.syncStatus === "all" ? null : filters.syncStatus,
    p_amount_min: filters.amountMin ? Number(filters.amountMin) : null,
    p_amount_max: filters.amountMax ? Number(filters.amountMax) : null,
    p_offset: page * PAGE_SIZE,
    p_limit: PAGE_SIZE,
  }), [filters, page]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["all-orders", queryParams],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_all_orders", queryParams as any);
      if (error) throw error;
      return data as any;
    },
    placeholderData: (prev) => prev,
  });

  const rows = data?.rows || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const columnDefs: ColDef[] = useMemo(() => [
    { field: "invoice_id", headerName: "Invoice", width: 150, pinned: "left",
      cellRenderer: (p: any) => p.value || p.data?.order_number || "—" },
    { field: "source", headerName: "Source", width: 100,
      cellRenderer: (p: any) => {
        const v = p.value || "";
        const colors: Record<string, string> = {
          shopify: "bg-emerald-100 text-emerald-800",
          facebook: "bg-blue-100 text-blue-800",
          manual: "bg-muted text-muted-foreground",
        };
        return `<span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${colors[v] || "bg-muted text-muted-foreground"}">${v || "manual"}</span>`;
      }
    },
    { field: "created_at", headerName: "Created", width: 150,
      valueFormatter: (p: any) => formatDate(p.value) },
    { field: "customer_name", headerName: "Customer", width: 160, pinned: "left" },
    { field: "phone", headerName: "Phone", width: 130 },
    { field: "district", headerName: "District", width: 110 },
    { field: "thana", headerName: "Thana", width: 110 },
    { field: "status", headerName: "Status", width: 130,
      cellRenderer: (p: any) => {
        const cfg = orderStatusConfig[p.value] || { label: p.value, emoji: "", color: "bg-muted text-muted-foreground" };
        return `<span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}">${cfg.emoji} ${cfg.label}</span>`;
      }
    },
    { field: "courier_name", headerName: "Courier", width: 110 },
    { field: "tracking_id", headerName: "Tracking", width: 150 },
    { field: "customer_total", headerName: "Total", width: 100, type: "numericColumn",
      valueFormatter: (p: any) => formatBDT(p.value) },
    { field: "courier_total_cost", headerName: "Courier Cost", width: 110, type: "numericColumn",
      valueFormatter: (p: any) => p.value != null ? formatBDT(p.value, true) : "—" },
    { field: "net_payable", headerName: "Net Payable", width: 110, type: "numericColumn",
      valueFormatter: (p: any) => p.value != null ? formatBDT(p.value, true) : "—" },
    { field: "settlement_status", headerName: "Settlement", width: 110,
      cellRenderer: (p: any) => {
        if (!p.value) return "—";
        const c = p.value === "Posted" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800";
        return `<span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${c}">${p.value}</span>`;
      }
    },
    { field: "sync_status", headerName: "Sync", width: 100,
      cellRenderer: (p: any) => {
        const v = p.value || "";
        const c = v === "SYNCED" ? "bg-green-100 text-green-800" : v === "FAILED" ? "bg-red-100 text-red-800" : "bg-muted text-muted-foreground";
        return `<span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${c}">${v || "—"}</span>`;
      }
    },
    { field: "exception_count", headerName: "Exc.", width: 70, type: "numericColumn",
      cellRenderer: (p: any) => {
        if (!p.value || p.value === 0) return "";
        return `<span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold">${p.value}</span>`;
      }
    },
    { field: "advance_amount", headerName: "Advance", width: 100, type: "numericColumn",
      valueFormatter: (p: any) => p.value > 0 ? formatBDT(p.value) : "—" },
    { field: "notes", headerName: "Notes", width: 180 },
  ], []);

  const defaultColDef = useMemo(() => ({
    sortable: false,
    resizable: true,
    suppressMenu: true,
  }), []);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const { data, error } = await supabase.rpc("export_all_orders", {
        p_search: filters.search || null,
        p_status: filters.statuses.length > 0 ? filters.statuses : null,
        p_source: filters.sources.length > 0 ? filters.sources : null,
        p_date_from: filters.dateFrom ? format(filters.dateFrom, "yyyy-MM-dd") : null,
        p_date_to: filters.dateTo ? format(filters.dateTo, "yyyy-MM-dd") : null,
      } as any);
      if (error) throw error;
      const rows = data as any[];
      if (!rows || rows.length === 0) { toast.info("No data to export"); return; }
      const headers = Object.keys(rows[0]);
      const csv = [
        headers.join(","),
        ...rows.map(r => headers.map(h => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(","))
      ].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `all-orders-${format(new Date(), "yyyy-MM-dd")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${rows.length} orders`);
    } catch (err: any) {
      toast.error("Export failed: " + err.message);
    } finally {
      setExporting(false);
    }
  }, [filters]);

  const toggleStatus = (s: string) => {
    setFilters(f => ({
      ...f,
      statuses: f.statuses.includes(s) ? f.statuses.filter(x => x !== s) : [...f.statuses, s]
    }));
    setPage(0);
  };

  const toggleSource = (s: string) => {
    setFilters(f => ({
      ...f,
      sources: f.sources.includes(s) ? f.sources.filter(x => x !== s) : [...f.sources, s]
    }));
    setPage(0);
  };

  const activeFilterCount = [
    filters.statuses.length > 0,
    filters.sources.length > 0,
    filters.hasAdvance !== "all",
    filters.exceptionsOnly,
    filters.settlementStatus !== "all",
    filters.syncStatus !== "all",
    filters.amountMin !== "",
    filters.amountMax !== "",
    filters.deliveredFrom != null,
    filters.deliveredTo != null,
  ].filter(Boolean).length;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-background">
        <div>
          <h1 className="text-xl font-bold text-foreground">All Orders</h1>
          <p className="text-sm text-muted-foreground">
            Unified archive — {total.toLocaleString()} orders
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
            <Download className="w-4 h-4 mr-1" /> {exporting ? "Exporting…" : "Export CSV"}
          </Button>
        </div>
      </div>

      {/* Search + Filter Toggle */}
      <div className="px-6 py-3 border-b bg-background flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search invoice, phone, tracking, customer…"
            className="pl-9"
            value={filters.search}
            onChange={e => { setFilters(f => ({ ...f, search: e.target.value })); setPage(0); }}
          />
        </div>

        {/* Date range quick */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <CalendarIcon className="w-4 h-4 mr-1" />
              {filters.dateFrom ? format(filters.dateFrom, "dd MMM") : "Start"} – {filters.dateTo ? format(filters.dateTo, "dd MMM") : "End"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="flex gap-2 p-3">
              <div>
                <p className="text-xs font-medium mb-1 text-muted-foreground">From</p>
                <Calendar mode="single" selected={filters.dateFrom} onSelect={d => { setFilters(f => ({ ...f, dateFrom: d })); setPage(0); }} />
              </div>
              <div>
                <p className="text-xs font-medium mb-1 text-muted-foreground">To</p>
                <Calendar mode="single" selected={filters.dateTo} onSelect={d => { setFilters(f => ({ ...f, dateTo: d })); setPage(0); }} />
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Button
          variant={showFilters ? "default" : "outline"}
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="w-4 h-4 mr-1" />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs">
              {activeFilterCount}
            </span>
          )}
        </Button>

        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={() => { setFilters(defaultFilters); setPage(0); }}>
            <X className="w-4 h-4 mr-1" /> Clear all
          </Button>
        )}
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <div className="px-6 py-3 border-b bg-muted/30 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {/* Status multi-select */}
          <div>
            <p className="text-xs font-medium mb-1 text-muted-foreground">Status</p>
            <div className="flex flex-wrap gap-1">
              {STATUSES.map(s => (
                <button
                  key={s}
                  onClick={() => toggleStatus(s)}
                  className={`px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                    filters.statuses.includes(s)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:bg-accent"
                  }`}
                >
                  {orderStatusConfig[s]?.emoji} {orderStatusConfig[s]?.label || s}
                </button>
              ))}
            </div>
          </div>

          {/* Source multi-select */}
          <div>
            <p className="text-xs font-medium mb-1 text-muted-foreground">Source</p>
            <div className="flex flex-wrap gap-1">
              {SOURCES.map(s => (
                <button
                  key={s}
                  onClick={() => toggleSource(s)}
                  className={`px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                    filters.sources.includes(s)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:bg-accent"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Settlement Status */}
          <div>
            <p className="text-xs font-medium mb-1 text-muted-foreground">Settlement</p>
            <Select value={filters.settlementStatus} onValueChange={v => { setFilters(f => ({ ...f, settlementStatus: v })); setPage(0); }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="posted">Posted</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sync Status */}
          <div>
            <p className="text-xs font-medium mb-1 text-muted-foreground">Sync Status</p>
            <Select value={filters.syncStatus} onValueChange={v => { setFilters(f => ({ ...f, syncStatus: v })); setPage(0); }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="SYNCED">Synced</SelectItem>
                <SelectItem value="NOT_SYNCED">Not Synced</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Has Advance */}
          <div>
            <p className="text-xs font-medium mb-1 text-muted-foreground">Advance</p>
            <Select value={filters.hasAdvance} onValueChange={v => { setFilters(f => ({ ...f, hasAdvance: v })); setPage(0); }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="yes">Has Advance</SelectItem>
                <SelectItem value="no">No Advance</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Exceptions only */}
          <div className="flex items-end gap-2 pb-1">
            <Checkbox
              id="exc-only"
              checked={filters.exceptionsOnly}
              onCheckedChange={v => { setFilters(f => ({ ...f, exceptionsOnly: !!v })); setPage(0); }}
            />
            <label htmlFor="exc-only" className="text-xs font-medium flex items-center gap-1 cursor-pointer">
              <AlertTriangle className="w-3.5 h-3.5 text-destructive" /> Exceptions only
            </label>
          </div>

          {/* Amount range */}
          <div>
            <p className="text-xs font-medium mb-1 text-muted-foreground">Amount Range</p>
            <div className="flex gap-1">
              <Input
                placeholder="Min"
                className="h-8 text-xs w-20"
                type="number"
                value={filters.amountMin}
                onChange={e => { setFilters(f => ({ ...f, amountMin: e.target.value })); setPage(0); }}
              />
              <Input
                placeholder="Max"
                className="h-8 text-xs w-20"
                type="number"
                value={filters.amountMax}
                onChange={e => { setFilters(f => ({ ...f, amountMax: e.target.value })); setPage(0); }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 ag-theme-alpine" style={{ width: "100%" }}>
        <AgGridReact
          ref={gridRef}
          rowData={rows}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          rowHeight={40}
          headerHeight={40}
          animateRows={false}
          suppressCellFocus={false}
          onRowClicked={(e) => e.data?.id && setDrawerOrderId(e.data.id)}
          overlayLoadingTemplate='<span class="text-muted-foreground">Loading orders…</span>'
          overlayNoRowsTemplate='<span class="text-muted-foreground">No orders match filters</span>'
          loading={isLoading}
        />
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-6 py-2 border-t bg-background text-sm">
        <span className="text-muted-foreground">
          Showing {rows.length > 0 ? page * PAGE_SIZE + 1 : 0}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total.toLocaleString()}
        </span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="px-2 text-muted-foreground">
            Page {page + 1} of {totalPages || 1}
          </span>
          <Button variant="ghost" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Drawer */}
      <OrderDetailsDrawer
        open={!!drawerOrderId}
        onOpenChange={(open) => !open && setDrawerOrderId(null)}
        orderId={drawerOrderId}
      />
    </div>
  );
}
