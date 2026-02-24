import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLegacyOrders, useLegacyStats, useLegacyBatchList } from "@/hooks/use-legacy-orders";
import { useLegacyCourierSync } from "@/hooks/use-legacy-courier-sync";
import { useBulkPostAdvance } from "@/hooks/use-advance-posting";
import { LegacyOrderDrawer } from "@/components/legacy-orders/LegacyOrderDrawer";
import { calculateNetPayable } from "@/lib/courier-calc";
import { cn } from "@/lib/utils";
import { formatBDT, formatBDT2, formatDate } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { KpiCard } from "@/components/ui/kpi-card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search, Download, MoreHorizontal, Eye, Truck, RefreshCw,
  Receipt, CheckCircle, Package, RotateCcw, ShieldAlert, Archive,
  FileText, Filter, ChevronDown, Loader2, XCircle, AlertTriangle, Info,
  Wallet, ArrowRightLeft
} from "lucide-react";

/* ─── Status badge configs ─── */
const LEGACY_STATUS_COLOR: Record<string, string> = {
  Delivered: "bg-emerald-100 text-emerald-800",
  Return: "bg-red-100 text-red-800",
  "Partial Delivery": "bg-amber-100 text-amber-800",
  Pending: "bg-yellow-100 text-yellow-800",
  Cancelled: "bg-red-100 text-red-800",
};

const ERP_STATUS_COLOR: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  delivered: "bg-emerald-100 text-emerald-800",
  returned: "bg-red-100 text-red-800",
  partially_delivered: "bg-amber-100 text-amber-800",
  cancelled: "bg-red-100 text-red-800",
  shipped: "bg-blue-100 text-blue-800",
  in_transit: "bg-indigo-100 text-indigo-800",
  packed: "bg-blue-100 text-blue-800",
  exchanged: "bg-violet-100 text-violet-800",
};

const COURIER_FINAL_COLOR: Record<string, string> = {
  UNKNOWN: "bg-muted text-muted-foreground",
  IN_TRANSIT: "bg-blue-100 text-blue-800",
  DELIVERED: "bg-emerald-100 text-emerald-800",
  PARTIAL_DELIVERED: "bg-amber-100 text-amber-800",
  RETURNED: "bg-red-100 text-red-800",
};

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
  const [showFilters, setShowFilters] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const { syncOrders, syncing: courierSyncing, progress: syncProgress } = useLegacyCourierSync();
  const { data: orders, isLoading } = useLegacyOrders(filters);
  const { data: stats, isLoading: statsLoading } = useLegacyStats();
  const { data: batches } = useLegacyBatchList();
  const bulkPostAdvance = useBulkPostAdvance();

  const setFilter = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (!orders) return;
    if (selectedIds.size === orders.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(orders.map((o: any) => o.id)));
  };

  const openDrawer = (id: string) => {
    setActiveOrderId(id);
    setDrawerOpen(true);
  };

  const handleExportCsv = () => {
    if (!orders) return;
    const rows = orders.filter((o: any) => selectedIds.size === 0 || selectedIds.has(o.id));
    const headers = ["Invoice", "Date", "Customer", "Phone", "Total", "Advance", "Advance Method", "Remaining", "Legacy Status", "ERP Status", "Courier Final", "Tracking", "Settlement"];
    const csvRows = rows.map((o: any) => {
      const c = o.customers as any;
      const adv = parseFloat(o.advance_amount) || 0;
      return [
        o.order_number || o.legacy_order_id,
        o.order_date?.slice(0, 10),
        c?.full_name,
        c?.phone,
        o.total_amount,
        adv,
        o.advance_method || "",
        Math.max(0, (o.total_amount || 0) - adv),
        o.legacy_status,
        o.status,
        o.courier_final_status || "UNKNOWN",
        o.legacy_tracking_id,
        o.settlement_posted ? "Posted" : "Pending",
      ].map((v) => `"${v || ""}"`).join(",");
    });
    const csv = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `legacy-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: `Exported ${csvRows.length} orders` });
  };

  const handleBulkSync = async () => {
    if (!orders) return;
    const toSync = orders
      .filter((o: any) => selectedIds.has(o.id) && o.legacy_tracking_id)
      .map((o: any) => ({ id: o.id, trackingId: o.legacy_tracking_id }));
    if (toSync.length === 0) {
      toast({ title: "No tracking IDs", description: "Selected orders have no tracking IDs to sync", variant: "destructive" });
      return;
    }
    await syncOrders(toSync);
    setSelectedIds(new Set());
  };

  const handleBulkPostAdvance = () => {
    if (!orders) return;
    const eligible = orders.filter((o: any) =>
      selectedIds.has(o.id) &&
      !o.advance_posted &&
      parseFloat(o.advance_amount) > 0 &&
      o.advance_method
    );
    if (eligible.length === 0) {
      toast({ title: "No eligible orders", description: "Selected orders must have advance_amount > 0, advance_method set, and not yet posted.", variant: "destructive" });
      return;
    }
    bulkPostAdvance.mutate(eligible.map((o: any) => ({
      id: o.id,
      advance_amount: parseFloat(o.advance_amount),
      advance_method: o.advance_method,
    })));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* KPI Header */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiCard title="Total Legacy Orders" value={stats?.total?.toLocaleString() || "0"} icon={<Archive className="w-5 h-5" />} loading={statsLoading} />
        <KpiCard title="Delivered" value={stats?.delivered?.toLocaleString() || "0"} icon={<CheckCircle className="w-5 h-5" />} loading={statsLoading} className="border-emerald-200" />
        <KpiCard title="Returned" value={stats?.returned?.toLocaleString() || "0"} icon={<RotateCcw className="w-5 h-5" />} loading={statsLoading} className="border-red-200" />
        <KpiCard title="Settlement Pending" value={formatBDT(stats?.settlementPending || 0)} icon={<Receipt className="w-5 h-5" />} loading={statsLoading} className="border-amber-200" />
        <KpiCard title="Open Exceptions" value={stats?.exceptions?.toLocaleString() || "0"} icon={<ShieldAlert className="w-5 h-5" />} loading={statsLoading} className="border-destructive/30" />
      </div>

      {/* Toolbar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search invoice, phone, tracking, SKU..." className="pl-9 h-9" value={filters.search} onChange={(e) => setFilter("search", e.target.value)} />
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="w-3.5 h-3.5" /> Filters
              <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", showFilters && "rotate-180")} />
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={handleExportCsv}>
              <Download className="w-3.5 h-3.5" /> Export
            </Button>

            {selectedIds.size > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" className="gap-1.5 h-9">
                    Bulk Actions ({selectedIds.size})
                    <ChevronDown className="w-3.5 h-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={handleBulkSync} disabled={courierSyncing}>
                    <RefreshCw className={cn("w-4 h-4 mr-2", courierSyncing && "animate-spin")} />
                    Sync Courier Status {courierSyncing && syncProgress.total > 0 ? `(${syncProgress.done}/${syncProgress.total})` : ""}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleBulkPostAdvance} disabled={bulkPostAdvance.isPending}>
                    <Wallet className="w-4 h-4 mr-2" />
                    Post Advance for Selected
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toast({ title: "Settlement matching queued" })}>
                    <Receipt className="w-4 h-4 mr-2" /> Mark for Settlement
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 pt-3 border-t">
              <div>
                <label className="text-[10px] text-muted-foreground font-medium">Date From</label>
                <Input type="date" className="h-8 text-xs" value={filters.dateFrom} onChange={(e) => setFilter("dateFrom", e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground font-medium">Date To</label>
                <Input type="date" className="h-8 text-xs" value={filters.dateTo} onChange={(e) => setFilter("dateTo", e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground font-medium">Import Batch</label>
                <Select value={filters.batchId || "all"} onValueChange={(v) => setFilter("batchId", v === "all" ? "" : v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
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
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
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
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
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
                <label className="text-[10px] text-muted-foreground font-medium">Courier Final Status</label>
                <Select value={filters.courierFinalStatus} onValueChange={(v) => setFilter("courierFinalStatus", v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
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
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
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

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-10">
                    <Checkbox checked={orders && orders.length > 0 && selectedIds.size === orders.length} onCheckedChange={toggleAll} />
                  </TableHead>
                  <TableHead className="text-xs">Invoice</TableHead>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Customer</TableHead>
                  <TableHead className="text-xs">Area</TableHead>
                  <TableHead className="text-xs">Items</TableHead>
                  <TableHead className="text-xs text-right">Total</TableHead>
                  <TableHead className="text-xs text-right">Advance</TableHead>
                  <TableHead className="text-xs text-right">Remaining</TableHead>
                  <TableHead className="text-xs">Legacy</TableHead>
                  <TableHead className="text-xs">ERP</TableHead>
                  <TableHead className="text-xs">Courier Final</TableHead>
                  <TableHead className="text-xs">Tracking</TableHead>
                  <TableHead className="text-xs text-right">Net Payable</TableHead>
                  <TableHead className="text-xs">Settlement</TableHead>
                  <TableHead className="text-xs w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 16 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : !orders || orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={16} className="text-center py-12 text-muted-foreground">
                      <Archive className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="font-medium">No legacy orders found</p>
                      <p className="text-xs mt-1">Import legacy orders or adjust your filters</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((o: any) => {
                    const c = o.customers as any;
                    const items = (o.order_items || []) as any[];
                    const itemCount = items.length;
                    const skuPreview = items.slice(0, 2).map((i: any) => i.products?.sku || "?").join(", ");
                    const legacyStatus = o.legacy_status || "—";
                    const erpStatus = o.status || "pending";
                    const courierFinal = o.courier_final_status || "UNKNOWN";
                    const advanceAmt = parseFloat(o.advance_amount) || 0;
                    const remaining = Math.max(0, (o.total_amount || 0) - advanceAmt);

                    return (
                      <TableRow
                        key={o.id}
                        className={cn(
                          "cursor-pointer hover:bg-muted/30 transition-colors",
                          selectedIds.has(o.id) && "bg-primary/5"
                        )}
                        onClick={() => openDrawer(o.id)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={selectedIds.has(o.id)} onCheckedChange={() => toggleSelect(o.id)} />
                        </TableCell>
                        <TableCell className="font-mono text-xs font-medium">{o.order_number || o.legacy_order_id}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDate(o.order_date)}</TableCell>
                        <TableCell>
                          <div>
                            <p className="text-xs font-medium truncate max-w-[120px]">{c?.full_name || "—"}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{c?.phone}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-[11px] text-muted-foreground">
                          {o.delivery_district || c?.district || "—"}
                          {(o.delivery_thana || c?.thana) && <>, {o.delivery_thana || c?.thana}</>}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs">{itemCount} item{itemCount !== 1 ? "s" : ""}</span>
                          {skuPreview && <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[80px]">{skuPreview}</p>}
                        </TableCell>
                        <TableCell className="text-right text-xs font-semibold">{formatBDT(o.total_amount)}</TableCell>

                        {/* Advance column */}
                        <TableCell className="text-right text-xs">
                          {advanceAmt > 0 ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex items-center gap-0.5 cursor-help">
                                    <span className="text-emerald-600 font-medium">{formatBDT2(advanceAmt)}</span>
                                    {o.advance_posted && <CheckCircle className="w-2.5 h-2.5 text-emerald-500" />}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="text-xs">
                                  <p>{o.advance_method || "?"} • {o.advance_posted ? "GL Posted" : "Not posted"}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Remaining collectable */}
                        <TableCell className="text-right text-xs font-medium">
                          {advanceAmt > 0 ? (
                            <span className={cn(remaining === 0 ? "text-emerald-600" : "text-primary")}>
                              {formatBDT2(remaining)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">{formatBDT(o.total_amount)}</span>
                          )}
                        </TableCell>

                        <TableCell>
                          <Badge className={cn("text-[10px] px-1.5 py-0", LEGACY_STATUS_COLOR[legacyStatus] || "bg-muted text-muted-foreground")}>
                            {legacyStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("text-[10px] px-1.5 py-0", ERP_STATUS_COLOR[erpStatus] || "bg-muted text-muted-foreground")}>
                            {erpStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("text-[10px] px-1.5 py-0", COURIER_FINAL_COLOR[courierFinal] || "bg-muted text-muted-foreground")}>
                            {courierFinal}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-[11px] text-muted-foreground">{o.legacy_tracking_id || "—"}</TableCell>
                        <TableCell className="text-right text-xs">
                          {(() => {
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
                            if (!o.courier_total_cost && !o.courier_delivery_fee) return "—";
                            return (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex items-center gap-0.5 cursor-help">
                                      {calc.warning ? (
                                        <span className="text-amber-600 flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" />N/A</span>
                                      ) : (
                                        <>{formatBDT2(calc.netPayable)}<Info className="w-2.5 h-2.5 text-muted-foreground" /></>
                                      )}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="left" className="max-w-xs">
                                    {calc.warning ? (
                                      <p className="text-xs text-amber-600">{calc.warning}</p>
                                    ) : (
                                      <div className="text-xs space-y-0.5 font-mono">
                                        {calc.breakdown.map((line, idx) => <p key={idx}>{line}</p>)}
                                      </div>
                                    )}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          {o.settlement_posted ? (
                            <Badge className="text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-800">Posted</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">Pending</Badge>
                          )}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => openDrawer(o.id)}>
                                <Eye className="w-4 h-4 mr-2" /> View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={courierSyncing || !o.legacy_tracking_id}
                                onClick={async () => {
                                  await syncOrders([{ id: o.id, trackingId: o.legacy_tracking_id }]);
                                }}
                              >
                                <RefreshCw className="w-4 h-4 mr-2" /> Sync Courier
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setActiveOrderId(o.id);
                                setDrawerOpen(true);
                              }}>
                                <ArrowRightLeft className="w-4 h-4 mr-2" /> Exchange
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toast({ title: "Marked for settlement" })}>
                                <Receipt className="w-4 h-4 mr-2" /> Mark for Settlement
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          {orders && orders.length > 0 && (
            <div className="p-3 border-t flex items-center justify-between text-xs text-muted-foreground">
              <span>{orders.length} legacy order{orders.length !== 1 ? "s" : ""}</span>
              <span>Total: {formatBDT(orders.reduce((s: number, o: any) => s + (o.total_amount || 0), 0))}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Drawer */}
      <LegacyOrderDrawer open={drawerOpen} onOpenChange={setDrawerOpen} orderId={activeOrderId} />
    </div>
  );
}
