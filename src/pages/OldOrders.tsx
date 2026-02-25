import { useState, useMemo, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLegacyOrders, useLegacyStats, useLegacyBatchList, MAX_BULK_LIMIT } from "@/hooks/use-legacy-orders";
import { useLegacyCourierSync } from "@/hooks/use-legacy-courier-sync";
import { useBulkPostAdvance } from "@/hooks/use-advance-posting";
import { useBulkPostSettlement } from "@/hooks/use-settlement-posting";
import { LegacyOrderDrawer } from "@/components/legacy-orders/LegacyOrderDrawer";
import { LegacyOrdersGrid } from "@/components/legacy-orders/LegacyOrdersGrid";
import { calculateNetPayable } from "@/lib/courier-calc";
import { cn } from "@/lib/utils";
import { formatBDT, formatDate } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { KpiCard } from "@/components/ui/kpi-card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  Search, Download, RefreshCw,
  Receipt, CheckCircle, RotateCcw, ShieldAlert, Archive,
  Filter, ChevronDown, Loader2, XCircle, AlertTriangle,
  Wallet, Zap, CircleDot, Ban
} from "lucide-react";

/* ─── Quick filter presets ─── */
type QuickFilter = "all" | "not_synced" | "sync_failed" | "delivered_not_settled" | "settlement_pending" | "advance_not_posted" | "returned_exchange";

const QUICK_FILTERS: Array<{ key: QuickFilter; label: string; icon: any; color: string }> = [
  { key: "all", label: "All", icon: Archive, color: "" },
  { key: "not_synced", label: "Not Synced", icon: CircleDot, color: "text-muted-foreground" },
  { key: "sync_failed", label: "Sync Failed", icon: XCircle, color: "text-destructive" },
  { key: "delivered_not_settled", label: "Delivered, Not Settled", icon: Receipt, color: "text-amber-600" },
  { key: "settlement_pending", label: "Settlement Pending", icon: AlertTriangle, color: "text-amber-500" },
  { key: "advance_not_posted", label: "Advance Not Posted", icon: Wallet, color: "text-blue-600" },
  { key: "returned_exchange", label: "Returned/Exchange", icon: RotateCcw, color: "text-red-600" },
];

export default function OldOrdersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState({
    search: "",
    dateFrom: "",
    dateTo: "",
    batchId: "",
    courierName: "all",
    legacyStatus: "all",
    courierFinalStatus: "all",
    settlementStatus: "all",
  });
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [settlementConfirmOpen, setSettlementConfirmOpen] = useState(false);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 });

  const { syncOrders, syncing: courierSyncing, progress: syncProgress } = useLegacyCourierSync();
  const { data: orders, isLoading } = useLegacyOrders(filters);
  const { data: stats, isLoading: statsLoading } = useLegacyStats();
  const { data: batches } = useLegacyBatchList();
  const bulkPostAdvance = useBulkPostAdvance();
  const bulkPostSettlement = useBulkPostSettlement();

  const setFilter = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  /* ─── Apply quick filter on top of data ─── */
  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    let data = orders;
    switch (quickFilter) {
      case "not_synced":
        data = data.filter((o: any) => !o.courier_sync_status || o.courier_sync_status === "NOT_SYNCED");
        break;
      case "sync_failed":
        data = data.filter((o: any) => o.courier_sync_status === "FAILED");
        break;
      case "delivered_not_settled":
        data = data.filter((o: any) =>
          (o.courier_final_status === "DELIVERED" || o.status === "delivered") && !o.settlement_posted
        );
        break;
      case "settlement_pending":
        data = data.filter((o: any) => !o.settlement_posted);
        break;
      case "advance_not_posted":
        data = data.filter((o: any) =>
          parseFloat(o.advance_amount) > 0 && !o.advance_posted
        );
        break;
      case "returned_exchange":
        data = data.filter((o: any) =>
          o.status === "returned" || o.status === "exchanged" ||
          o.courier_final_status === "RETURNED"
        );
        break;
    }
    return data;
  }, [orders, quickFilter]);

  const openDrawer = (id: string) => {
    setActiveOrderId(id);
    setDrawerOpen(true);
  };

  /* ─── Bulk actions ─── */
  const processBatch = useCallback(async (
    items: any[],
    batchFn: (batch: any[]) => Promise<void>,
    batchSize = 200
  ) => {
    setBatchProcessing(true);
    setBatchProgress({ done: 0, total: items.length });
    try {
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        await batchFn(batch);
        setBatchProgress({ done: Math.min(i + batchSize, items.length), total: items.length });
      }
    } finally {
      setBatchProcessing(false);
      setBatchProgress({ done: 0, total: 0 });
    }
  }, []);

  const handleBulkSync = async () => {
    if (!orders) return;
    const toSync = orders
      .filter((o: any) => selectedIds.includes(o.id) && o.legacy_tracking_id)
      .map((o: any) => ({ id: o.id, trackingId: o.legacy_tracking_id }));
    if (toSync.length === 0) {
      toast({ title: "No tracking IDs", description: "Selected orders have no tracking IDs to sync", variant: "destructive" });
      return;
    }
    // Update sync status in DB after sync
    const results = await syncOrders(toSync);
    // Update courier_sync_status for each
    for (const r of results) {
      await supabase.from("orders").update({
        courier_sync_status: r.success ? "SYNCED" : "FAILED",
        courier_last_sync_at: new Date().toISOString(),
        courier_last_sync_error: r.success ? null : r.error,
      }).eq("id", r.orderId);
    }
    queryClient.invalidateQueries({ queryKey: ["legacy-orders"] });
    setSelectedIds([]);
  };

  const handleBulkPostAdvance = () => {
    if (!orders) return;
    const eligible = orders.filter((o: any) =>
      selectedIds.includes(o.id) && !o.advance_posted &&
      parseFloat(o.advance_amount) > 0 && o.advance_method
    );
    if (eligible.length === 0) {
      toast({ title: "No eligible orders", variant: "destructive" });
      return;
    }
    bulkPostAdvance.mutate(eligible.map((o: any) => ({
      id: o.id,
      advance_amount: parseFloat(o.advance_amount),
      advance_method: o.advance_method,
    })));
  };

  const handleBulkPostSettlement = () => {
    if (!orders) return;
    const eligible = orders.filter((o: any) =>
      selectedIds.includes(o.id) && !o.settlement_posted &&
      (o.courier_final_status === "DELIVERED" || o.status === "delivered") &&
      (o.courier_total_cost > 0 || o.courier_delivery_fee > 0)
    );
    if (eligible.length === 0) {
      toast({ title: "No eligible orders for settlement", variant: "destructive" });
      return;
    }
    // Open confirmation
    setSettlementConfirmOpen(true);
  };

  const confirmBulkSettlement = async () => {
    if (!orders) return;
    setSettlementConfirmOpen(false);
    const eligible = orders.filter((o: any) =>
      selectedIds.includes(o.id) && !o.settlement_posted &&
      (o.courier_final_status === "DELIVERED" || o.status === "delivered") &&
      (o.courier_total_cost > 0 || o.courier_delivery_fee > 0)
    ).map((o: any) => {
      const calc = calculateNetPayable({
        collectable_amount: o.total_amount,
        courier_delivery_fee: o.courier_delivery_fee,
        courier_cod_fee: o.courier_cod_fee,
        courier_discount: o.courier_discount,
        courier_promo_discount: o.courier_promo_discount,
        courier_additional_charge: o.courier_additional_charge,
        courier_compensation_cost: o.courier_compensation_cost,
        is_return: o.courier_final_status === "RETURNED",
      });
      return {
        id: o.id,
        customerTotal: o.total_amount || 0,
        courierTotalCost: calc.totalCost,
        netPayable: calc.netPayable,
      };
    });

    if (eligible.length > 200) {
      await processBatch(eligible, async (batch) => {
        await bulkPostSettlement.mutateAsync(batch);
      });
    } else {
      await bulkPostSettlement.mutateAsync(eligible);
    }
    setSelectedIds([]);
  };

  const handleExportCsv = () => {
    if (!filteredOrders) return;
    const rows = filteredOrders.filter((o: any) => selectedIds.length === 0 || selectedIds.includes(o.id));
    const headers = ["Invoice", "Date", "Customer", "Phone", "Total", "Advance", "Method", "Remaining", "Legacy", "ERP", "Courier Final", "Tracking", "Settlement", "Sync Status"];
    const csvRows = rows.map((o: any) => {
      const c = o.customers as any;
      const adv = parseFloat(o.advance_amount) || 0;
      return [
        o.order_number || o.legacy_order_id, o.order_date?.slice(0, 10),
        c?.full_name, c?.phone, o.total_amount, adv, o.advance_method || "",
        Math.max(0, (o.total_amount || 0) - adv), o.legacy_status, o.status,
        o.courier_final_status || "UNKNOWN", o.legacy_tracking_id,
        o.settlement_posted ? "Posted" : "Pending", o.courier_sync_status || "NOT_SYNCED",
      ].map((v) => `"${v || ""}"`).join(",");
    });
    const csv = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `legacy-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast({ title: `Exported ${csvRows.length} orders` });
  };

  const settlementEligibleCount = useMemo(() => {
    if (!orders) return 0;
    return orders.filter((o: any) =>
      selectedIds.includes(o.id) && !o.settlement_posted &&
      (o.courier_final_status === "DELIVERED" || o.status === "delivered") &&
      (o.courier_total_cost > 0 || o.courier_delivery_fee > 0)
    ).length;
  }, [orders, selectedIds]);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* KPI Header — clickable filters */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div onClick={() => setQuickFilter("all")} className="cursor-pointer">
          <KpiCard title="Total Legacy Orders" value={stats?.total?.toLocaleString() || "0"} icon={<Archive className="w-5 h-5" />} loading={statsLoading} className={cn(quickFilter === "all" && "ring-2 ring-primary")} />
        </div>
        <div onClick={() => setQuickFilter("delivered_not_settled")} className="cursor-pointer">
          <KpiCard title="Delivered" value={stats?.delivered?.toLocaleString() || "0"} icon={<CheckCircle className="w-5 h-5" />} loading={statsLoading} className={cn("border-emerald-200", quickFilter === "delivered_not_settled" && "ring-2 ring-primary")} />
        </div>
        <div onClick={() => setQuickFilter("returned_exchange")} className="cursor-pointer">
          <KpiCard title="Returned" value={stats?.returned?.toLocaleString() || "0"} icon={<RotateCcw className="w-5 h-5" />} loading={statsLoading} className={cn("border-red-200", quickFilter === "returned_exchange" && "ring-2 ring-primary")} />
        </div>
        <div onClick={() => setQuickFilter("settlement_pending")} className="cursor-pointer">
          <KpiCard title="Settlement Pending" value={formatBDT(stats?.settlementPending || 0)} icon={<Receipt className="w-5 h-5" />} loading={statsLoading} className={cn("border-amber-200", quickFilter === "settlement_pending" && "ring-2 ring-primary")} />
        </div>
        <div onClick={() => { setQuickFilter("sync_failed"); }} className="cursor-pointer">
          <KpiCard title="Open Exceptions" value={stats?.exceptions?.toLocaleString() || "0"} icon={<ShieldAlert className="w-5 h-5" />} loading={statsLoading} className={cn("border-destructive/30", quickFilter === "sync_failed" && "ring-2 ring-primary")} />
        </div>
      </div>

      {/* Toolbar */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Quick filter pills */}
            <div className="flex items-center gap-1 flex-wrap">
              {QUICK_FILTERS.map((qf) => (
                <Button
                  key={qf.key}
                  variant={quickFilter === qf.key ? "default" : "outline"}
                  size="sm"
                  className={cn("h-7 text-[11px] gap-1 px-2.5", quickFilter !== qf.key && qf.color)}
                  onClick={() => setQuickFilter(qf.key)}
                >
                  <qf.icon className="w-3 h-3" />
                  {qf.label}
                  {qf.key !== "all" && filteredOrders && quickFilter === qf.key && (
                    <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{filteredOrders.length}</Badge>
                  )}
                </Button>
              ))}
            </div>

            <div className="flex-1" />

            {/* Search */}
            <div className="relative min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input placeholder="Invoice, phone, tracking..." className="pl-8 h-8 text-xs" value={filters.search} onChange={(e) => setFilter("search", e.target.value)} />
            </div>

            <Button variant="outline" size="sm" className="gap-1 h-8 text-xs" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="w-3 h-3" /> Filters
              <ChevronDown className={cn("w-3 h-3 transition-transform", showFilters && "rotate-180")} />
            </Button>
            <Button variant="outline" size="sm" className="gap-1 h-8 text-xs" onClick={handleExportCsv}>
              <Download className="w-3 h-3" /> Export
            </Button>

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
                  <DropdownMenuItem onClick={handleBulkSync} disabled={courierSyncing}>
                    <RefreshCw className={cn("w-4 h-4 mr-2", courierSyncing && "animate-spin")} />
                    Sync Courier {courierSyncing && syncProgress.total > 0 ? `(${syncProgress.done}/${syncProgress.total})` : ""}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleBulkPostAdvance} disabled={bulkPostAdvance.isPending}>
                    <Wallet className="w-4 h-4 mr-2" />
                    Post Advance for Selected
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleBulkPostSettlement} disabled={bulkPostSettlement.isPending}>
                    <Receipt className="w-4 h-4 mr-2" />
                    Post Settlement ({settlementEligibleCount})
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleExportCsv}>
                    <Download className="w-4 h-4 mr-2" /> Export Selected
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Expanded filters */}
          {showFilters && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mt-3 pt-3 border-t">
              <div>
                <label className="text-[10px] text-muted-foreground font-medium">Date From</label>
                <Input type="date" className="h-7 text-xs" value={filters.dateFrom} onChange={(e) => setFilter("dateFrom", e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground font-medium">Date To</label>
                <Input type="date" className="h-7 text-xs" value={filters.dateTo} onChange={(e) => setFilter("dateTo", e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground font-medium">Import Batch</label>
                <Select value={filters.batchId || "all"} onValueChange={(v) => setFilter("batchId", v === "all" ? "" : v)}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Batches</SelectItem>
                    {(batches || []).map((b: any) => (
                      <SelectItem key={b.id} value={b.id}>{b.file_name} ({b.imported_count})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground font-medium">Courier</label>
                <Select value={filters.courierName} onValueChange={(v) => setFilter("courierName", v)}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Couriers</SelectItem>
                    <SelectItem value="Pathao">Pathao</SelectItem>
                    <SelectItem value="Steadfast">Steadfast</SelectItem>
                    <SelectItem value="RedX">RedX</SelectItem>
                    <SelectItem value="Sundorban">Sundorban</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground font-medium">Legacy Status</label>
                <Select value={filters.legacyStatus} onValueChange={(v) => setFilter("legacyStatus", v)}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="Delivered">Delivered</SelectItem>
                    <SelectItem value="Return">Return</SelectItem>
                    <SelectItem value="Partial Delivery">Partial</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground font-medium">Courier Final</label>
                <Select value={filters.courierFinalStatus} onValueChange={(v) => setFilter("courierFinalStatus", v)}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="DELIVERED">Delivered</SelectItem>
                    <SelectItem value="RETURNED">Returned</SelectItem>
                    <SelectItem value="PARTIAL_DELIVERED">Partial</SelectItem>
                    <SelectItem value="IN_TRANSIT">In Transit</SelectItem>
                    <SelectItem value="UNKNOWN">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground font-medium">Settlement</label>
                <Select value={filters.settlementStatus} onValueChange={(v) => setFilter("settlementStatus", v)}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="posted">Posted</SelectItem>
                    <SelectItem value="not_posted">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selection bar */}
      {selectedIds.length > 0 && (
        <div className="px-4 py-2 bg-primary/5 border border-primary/20 rounded-lg flex items-center gap-3 flex-wrap">
          <span className="text-xs font-medium">
            <span className="text-primary font-semibold">{selectedIds.length}</span> order{selectedIds.length !== 1 ? "s" : ""} selected
          </span>
          {batchProcessing && (
            <span className="text-xs text-muted-foreground flex items-center gap-1.5 ml-auto">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Processing {batchProgress.done}/{batchProgress.total}…
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground ml-auto"
            onClick={() => setSelectedIds([])}
          >
            <XCircle className="w-3.5 h-3.5 mr-1" /> Clear
          </Button>
        </div>
      )}

      {/* AG Grid */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading legacy orders…</span>
            </div>
          ) : (
            <LegacyOrdersGrid
              orders={filteredOrders}
              onRowClicked={openDrawer}
              onSelectionChanged={setSelectedIds}
            />
          )}

          {filteredOrders.length > 0 && (
            <div className="p-2.5 border-t flex items-center justify-between text-xs text-muted-foreground">
              <span>{filteredOrders.length} order{filteredOrders.length !== 1 ? "s" : ""}{quickFilter !== "all" ? ` (filtered)` : ""}</span>
              <span>Total: {formatBDT(filteredOrders.reduce((s: number, o: any) => s + (o.total_amount || 0), 0))}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Drawer */}
      <LegacyOrderDrawer open={drawerOpen} onOpenChange={setDrawerOpen} orderId={activeOrderId} />

      {/* Settlement confirmation modal */}
      <Dialog open={settlementConfirmOpen} onOpenChange={setSettlementConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Bulk Settlement</DialogTitle>
            <DialogDescription>
              You are about to post settlements for <strong>{settlementEligibleCount}</strong> orders.
              This will create GL journal entries (Dr Bank/Cash, Dr Courier Expense, Cr Courier Receivable) for each order.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">This action cannot be undone without a reversal.</p>
              <p className="mt-1">Only Finance/Admin roles should perform this action. Each posting is permanently logged for audit.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettlementConfirmOpen(false)}>Cancel</Button>
            <Button onClick={confirmBulkSettlement} disabled={bulkPostSettlement.isPending}>
              {bulkPostSettlement.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Post {settlementEligibleCount} Settlements
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
