import { useState } from "react";
import { useExchanges, useExchangeTransition, EXCHANGE_STATUS_CONFIG, EXCHANGE_TRANSITIONS } from "@/hooks/use-exchanges";
import { formatBDT, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiCard } from "@/components/ui/kpi-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ArrowRightLeft, Search, Truck, Package, CheckCircle, AlertTriangle, DollarSign, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

export default function ExchangesPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: exchanges, isLoading } = useExchanges(statusFilter);
  const transition = useExchangeTransition();

  const filtered = (exchanges || []).filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      e.exchange_number?.toLowerCase().includes(q) ||
      e.customer_name?.toLowerCase().includes(q) ||
      e.customer_phone?.includes(q) ||
      e.reason?.toLowerCase().includes(q) ||
      e.orders?.order_number?.toLowerCase().includes(q)
    );
  });

  const selected = filtered.find((e) => e.id === selectedId);

  const statusCounts = (exchanges || []).reduce((acc, e) => {
    acc[e.status] = (acc[e.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalCourierCost = (exchanges || []).reduce((s, e) => s + (e.courier_cost_total || 0), 0);
  const totalNetCost = (exchanges || []).reduce((s, e) => s + (e.net_exchange_cost || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ArrowRightLeft className="w-6 h-6 text-primary" /> Exchange Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Track and manage product exchanges across all orders</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard title="Total Exchanges" value={String(exchanges?.length || 0)} icon={<ArrowRightLeft className="w-5 h-5" />} loading={isLoading} />
        <KpiCard title="Pending" value={String(statusCounts.pending || 0)} icon={<AlertTriangle className="w-5 h-5" />} loading={isLoading} />
        <KpiCard title="Courier Cost" value={formatBDT(totalCourierCost)} icon={<Truck className="w-5 h-5" />} loading={isLoading} />
        <KpiCard title="Net Exchange Cost" value={formatBDT(totalNetCost)} icon={<DollarSign className="w-5 h-5" />} loading={isLoading} />
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search exchange, order, customer..." className="pl-9 h-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(EXCHANGE_STATUS_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.emoji} {v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs">Exchange ID</TableHead>
                <TableHead className="text-xs">Order</TableHead>
                <TableHead className="text-xs">Customer</TableHead>
                <TableHead className="text-xs">Reason</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs text-right">Price Diff</TableHead>
                <TableHead className="text-xs text-right">Courier Cost</TableHead>
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-xs">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">No exchanges found</TableCell></TableRow>
              ) : filtered.map((ex) => {
                const cfg = EXCHANGE_STATUS_CONFIG[ex.status] || EXCHANGE_STATUS_CONFIG.pending;
                const nextStatuses = EXCHANGE_TRANSITIONS[ex.status] || [];
                return (
                  <TableRow key={ex.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setSelectedId(ex.id)}>
                    <TableCell className="font-mono text-xs font-semibold text-primary">{ex.exchange_number}</TableCell>
                    <TableCell>
                      <Link to={`/orders/${ex.order_id}`} className="text-xs text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                        #{ex.orders?.order_number || "—"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs font-medium">{ex.customer_name || "—"}</div>
                      <div className="text-[10px] text-muted-foreground">{ex.customer_phone}</div>
                    </TableCell>
                    <TableCell className="text-xs max-w-[150px] truncate">{ex.reason}</TableCell>
                    <TableCell>
                      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold", cfg.color)}>
                        {cfg.emoji} {cfg.label}
                      </span>
                    </TableCell>
                    <TableCell className={cn("text-xs text-right font-mono", ex.price_difference > 0 ? "text-emerald-600" : ex.price_difference < 0 ? "text-red-600" : "")}>
                      {formatBDT(ex.price_difference)}
                    </TableCell>
                    <TableCell className="text-xs text-right font-mono">{formatBDT(ex.courier_cost_total)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(ex.created_at)}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1">
                        {nextStatuses.map((ns) => {
                          const nsCfg = EXCHANGE_STATUS_CONFIG[ns];
                          return (
                            <Button
                              key={ns}
                              size="sm"
                              variant="outline"
                              className="h-6 text-[10px] px-2"
                              disabled={transition.isPending}
                              onClick={() => transition.mutate({ exchangeId: ex.id, newStatus: ns })}
                            >
                              {transition.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : nsCfg?.label || ns}
                            </Button>
                          );
                        })}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Detail Drawer */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent className="sm:max-w-[480px] overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <ArrowRightLeft className="w-5 h-5 text-primary" />
                  {selected.exchange_number}
                </SheetTitle>
              </SheetHeader>
              <div className="space-y-5 mt-4">
                {/* Status */}
                <div className="flex items-center gap-2">
                  {(() => { const c = EXCHANGE_STATUS_CONFIG[selected.status]; return <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-semibold", c?.color)}>{c?.emoji} {c?.label}</span>; })()}
                  <Badge variant="outline" className="text-[10px]">{selected.exchange_type}</Badge>
                </div>

                {/* Info */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div><span className="text-muted-foreground">Order:</span> <Link to={`/orders/${selected.order_id}`} className="text-primary font-mono">#{selected.orders?.order_number}</Link></div>
                  <div><span className="text-muted-foreground">Customer:</span> {selected.customer_name}</div>
                  <div><span className="text-muted-foreground">Phone:</span> {selected.customer_phone}</div>
                  <div><span className="text-muted-foreground">Created:</span> {formatDate(selected.created_at)}</div>
                </div>
                <div className="text-xs"><span className="text-muted-foreground">Reason:</span> {selected.reason}</div>

                <Separator />

                {/* Return Items */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1"><Package className="w-3.5 h-3.5" /> Returned Items</h4>
                  {(selected.exchange_items || []).filter((i) => i.direction === "return").map((item) => (
                    <div key={item.id} className="flex items-center justify-between bg-red-50 rounded-lg p-2 mb-1 border border-red-100">
                      <div>
                        <p className="text-xs font-medium">{item.product_name}</p>
                        <p className="text-[10px] text-muted-foreground">{item.sku} × {item.quantity} · {item.condition}</p>
                      </div>
                      <span className="text-xs font-mono">{formatBDT(item.unit_price * item.quantity)}</span>
                    </div>
                  ))}
                </div>

                {/* Replacement Items */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1"><Package className="w-3.5 h-3.5" /> Replacement Items</h4>
                  {(selected.exchange_items || []).filter((i) => i.direction === "replacement").map((item) => (
                    <div key={item.id} className="flex items-center justify-between bg-emerald-50 rounded-lg p-2 mb-1 border border-emerald-100">
                      <div>
                        <p className="text-xs font-medium">{item.product_name}</p>
                        <p className="text-[10px] text-muted-foreground">{item.sku} × {item.quantity}</p>
                      </div>
                      <span className="text-xs font-mono">{formatBDT(item.unit_price * item.quantity)}</span>
                    </div>
                  ))}
                </div>

                <Separator />

                {/* Financial Summary */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" /> Financial Impact</h4>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span>Price Difference</span><span className={cn("font-mono", selected.price_difference >= 0 ? "text-emerald-600" : "text-red-600")}>{formatBDT(selected.price_difference)}</span></div>
                    <div className="flex justify-between"><span>Courier Cost</span><span className="font-mono text-red-600">{formatBDT(selected.courier_cost_total)}</span></div>
                    <div className="flex justify-between"><span>Damaged Loss</span><span className="font-mono text-red-600">{formatBDT(selected.damaged_loss)}</span></div>
                    <Separator />
                    <div className="flex justify-between font-semibold"><span>Net Exchange Cost</span><span className="font-mono">{formatBDT(selected.net_exchange_cost)}</span></div>
                  </div>
                </div>

                <Separator />

                {/* Shipments */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1"><Truck className="w-3.5 h-3.5" /> Shipments</h4>
                  {(selected.exchange_shipments || []).length === 0 ? (
                    <p className="text-xs text-muted-foreground">No shipments yet</p>
                  ) : (selected.exchange_shipments || []).map((s) => (
                    <div key={s.id} className="border rounded-lg p-2 mb-1">
                      <div className="flex justify-between text-xs">
                        <Badge variant="outline" className="text-[10px]">{s.shipment_type}</Badge>
                        <span className="text-muted-foreground">{s.courier_name || "—"}</span>
                      </div>
                      <div className="text-[10px] mt-1 text-muted-foreground">
                        Tracking: {s.tracking_id || "—"} · COD: {formatBDT(s.cod_amount)} · Cost: {formatBDT(s.courier_cost)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Timeline */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground mb-2">Timeline</h4>
                  <div className="space-y-1 text-[10px] text-muted-foreground">
                    <div>Created: {formatDate(selected.created_at)}</div>
                    {selected.approved_at && <div>Approved: {formatDate(selected.approved_at)}</div>}
                    {selected.reverse_received_at && <div>Reverse Received: {formatDate(selected.reverse_received_at)}</div>}
                    {selected.replacement_sent_at && <div>Replacement Sent: {formatDate(selected.replacement_sent_at)}</div>}
                    {selected.completed_at && <div>Completed: {formatDate(selected.completed_at)}</div>}
                    {selected.cancelled_at && <div>Cancelled: {formatDate(selected.cancelled_at)} — {selected.cancel_reason}</div>}
                  </div>
                </div>

                {/* Action Buttons */}
                {(() => {
                  const next = EXCHANGE_TRANSITIONS[selected.status] || [];
                  if (next.length === 0) return null;
                  return (
                    <div className="flex gap-2 pt-2">
                      {next.map((ns) => {
                        const nsCfg = EXCHANGE_STATUS_CONFIG[ns];
                        return (
                          <Button
                            key={ns}
                            className="flex-1 text-xs h-9"
                            variant={ns === "cancelled" ? "destructive" : "default"}
                            disabled={transition.isPending}
                            onClick={() => transition.mutate({ exchangeId: selected.id, newStatus: ns })}
                          >
                            {transition.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                            {nsCfg?.label || ns}
                          </Button>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
