import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Lock, Unlock, AlertTriangle, BookOpen, ArrowRight, ShieldAlert } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";

interface Props {
  allocationId: string | null;
  onClose: () => void;
}

export function LandedCostDetailDrawer({ allocationId, onClose }: Props) {
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [unlocking, setUnlocking] = useState(false);

  const { data: allocation, isLoading, refetch } = useQuery({
    queryKey: ["landed-cost-allocation", allocationId],
    enabled: !!allocationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("landed_cost_allocations")
        .select("*, import_shipments:import_shipment_id(import_number, supplier_id, suppliers(name)), purchase_orders:po_id(po_number), goods_receipts:grn_id(grn_number)")
        .eq("id", allocationId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: lines } = useQuery({
    queryKey: ["landed-cost-allocation-lines", allocationId],
    enabled: !!allocationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("landed_cost_allocation_lines")
        .select("*, products:product_id(name, sku)")
        .eq("allocation_id", allocationId!);
      if (error) throw error;
      return data;
    },
  });

  // Get related landed_costs entries
  const { data: costEntries } = useQuery({
    queryKey: ["landed-costs-for-allocation", allocation?.import_shipment_id, allocation?.po_id],
    enabled: !!allocation && !!(allocation.import_shipment_id || allocation.po_id),
    queryFn: async () => {
      let q = supabase.from("landed_costs").select("*").order("cost_date");
      if (allocation!.import_shipment_id) q = q.eq("import_shipment_id", allocation!.import_shipment_id);
      else if (allocation!.po_id) q = q.eq("po_id", allocation!.po_id);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const isFinalized = allocation?.is_finalized || allocation?.status === "posted";
  const totalAllocated = lines?.reduce((s, l) => s + (l.allocated_cost || 0), 0) || 0;

  const handleAdminOverride = async () => {
    if (!overrideReason.trim()) {
      toast({ title: "Reason is required", variant: "destructive" });
      return;
    }
    setUnlocking(true);
    try {
      // Log to audit
      await supabase.from("audit_logs").insert({
        entity_type: "landed_cost_allocation",
        entity_id: allocationId!,
        action: "admin_override_unlock",
        reason: overrideReason,
        before_json: { is_finalized: true, status: allocation?.status },
        after_json: { is_finalized: false, status: "draft" },
      });

      // Unlock
      await supabase.from("landed_cost_allocations").update({
        is_finalized: false,
        status: "draft",
        admin_override_at: new Date().toISOString(),
        admin_override_reason: overrideReason,
      }).eq("id", allocationId!);

      toast({ title: "Allocation unlocked for editing" });
      setOverrideOpen(false);
      setOverrideReason("");
      refetch();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUnlocking(false);
    }
  };

  const methodLabel = (m: string) => {
    if (m === "BY_QTY") return "By Quantity";
    if (m === "BY_VALUE") return "By Cost Share";
    if (m === "BY_WEIGHT") return "By Weight";
    return m;
  };

  return (
    <>
      <Sheet open={!!allocationId} onOpenChange={(v) => !v && onClose()}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              Landed Cost Allocation
            </SheetTitle>
          </SheetHeader>

          {isLoading ? (
            <div className="space-y-3 mt-4">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : allocation ? (
            <div className="space-y-5 mt-4">
              {/* Status Row */}
              <div className="flex items-center gap-2 flex-wrap">
                {isFinalized ? (
                  <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 border text-xs gap-1">
                    <Lock className="w-3 h-3" /> Finalized
                  </Badge>
                ) : (
                  <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 border text-xs">
                    📋 Draft
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs">{methodLabel(allocation.allocation_method)}</Badge>
                {(allocation as any).admin_override_at && (
                  <Badge className="bg-destructive/10 text-destructive border-destructive/20 border text-[10px] gap-1">
                    <ShieldAlert className="w-3 h-3" /> Admin Override
                  </Badge>
                )}
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-3">
                <InfoRow
                  label="Import / PO"
                  value={
                    (allocation.import_shipments as any)?.import_number ||
                    (allocation.purchase_orders as any)?.po_number ||
                    "—"
                  }
                />
                <InfoRow
                  label="Supplier"
                  value={(allocation.import_shipments as any)?.suppliers?.name || "—"}
                />
                <InfoRow
                  label="GRN"
                  value={(allocation.goods_receipts as any)?.grn_number || "—"}
                />
                <InfoRow
                  label="Created"
                  value={allocation.created_at ? format(new Date(allocation.created_at), "dd MMM yyyy") : "—"}
                />
              </div>

              {/* Total Landed Cost */}
              <div className="rounded-xl border border-border bg-card p-4 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total Landed Cost</p>
                <p className="text-2xl font-bold text-foreground">৳{(allocation.total_landed_cost || 0).toLocaleString()}</p>
              </div>

              <Separator />

              {/* Cost Breakdown */}
              {costEntries && costEntries.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Cost Breakdown</h3>
                  <div className="rounded-xl border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Type</TableHead>
                          <TableHead className="text-xs">Date</TableHead>
                          <TableHead className="text-xs text-right">Amount</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {costEntries.map((c) => (
                          <TableRow key={c.id}>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px]">{c.cost_type}</Badge>
                            </TableCell>
                            <TableCell className="text-xs">{format(new Date(c.cost_date), "dd MMM yyyy")}</TableCell>
                            <TableCell className="text-xs text-right font-semibold">৳{(c.amount || 0).toLocaleString()}</TableCell>
                            <TableCell>
                              <Badge className={`text-[10px] ${c.status === "posted" ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                                {c.status === "posted" ? "✅" : "📋"} {c.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <Separator />

              {/* SKU Impact Table */}
              <div>
                <h3 className="text-sm font-semibold mb-2">Cost Per SKU Impact</h3>
                <div className="rounded-xl border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">SKU</TableHead>
                        <TableHead className="text-xs">Product</TableHead>
                        <TableHead className="text-xs text-right w-16">Qty</TableHead>
                        <TableHead className="text-xs text-right w-24">Base Value</TableHead>
                        <TableHead className="text-xs text-right w-24">Allocated</TableHead>
                        <TableHead className="text-xs text-right w-24">Avg Before</TableHead>
                        <TableHead className="text-xs text-right w-24">Avg After</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lines?.map((line) => {
                        const before = Number(line.avg_cost_before || 0);
                        const after = Number(line.avg_cost_after || 0);
                        const change = after - before;
                        return (
                          <TableRow key={line.id}>
                            <TableCell className="font-mono text-xs text-primary">{line.sku || "—"}</TableCell>
                            <TableCell className="text-xs">{(line.products as any)?.name || "—"}</TableCell>
                            <TableCell className="text-xs text-right">{line.qty_received || 0}</TableCell>
                            <TableCell className="text-xs text-right">৳{(line.base_value || 0).toLocaleString()}</TableCell>
                            <TableCell className="text-xs text-right font-semibold">৳{(line.allocated_cost || 0).toLocaleString()}</TableCell>
                            <TableCell className="text-xs text-right text-muted-foreground">৳{before.toLocaleString()}</TableCell>
                            <TableCell className="text-xs text-right">
                              <span className="font-semibold">৳{after.toLocaleString()}</span>
                              {change !== 0 && (
                                <span className={`ml-1 text-[10px] ${change > 0 ? "text-destructive" : "text-emerald-600"}`}>
                                  {change > 0 ? "↑" : "↓"}{Math.abs(change).toFixed(1)}
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {(!lines || lines.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-6">
                            No allocation lines yet
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                {lines && lines.length > 0 && (
                  <div className="flex justify-between mt-2 text-xs px-1">
                    <span className="text-muted-foreground">{lines.length} SKUs allocated</span>
                    <span className="font-bold">Total: ৳{totalAllocated.toLocaleString()}</span>
                  </div>
                )}
              </div>

              {/* Admin Override */}
              {isFinalized && (
                <>
                  <Separator />
                  <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-destructive flex items-center gap-1">
                          <Lock className="w-3.5 h-3.5" /> Finalized — Editing Locked
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {allocation.finalized_at ? `Finalized on ${format(new Date(allocation.finalized_at), "dd MMM yyyy HH:mm")}` : "Cost allocation has been finalized"}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="gap-1.5 text-xs"
                        onClick={() => setOverrideOpen(true)}
                      >
                        <Unlock className="w-3.5 h-3.5" /> Admin Override
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {/* Override Audit Trail */}
              {(allocation as any).admin_override_at && (
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">🔓 Last Admin Override</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date((allocation as any).admin_override_at), "dd MMM yyyy HH:mm")}
                  </p>
                  <p className="text-xs mt-1">
                    <strong>Reason:</strong> {(allocation as any).admin_override_reason || "—"}
                  </p>
                </div>
              )}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* Admin Override Confirmation */}
      <Dialog open={overrideOpen} onOpenChange={setOverrideOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Admin Override — Unlock Allocation
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This will unlock a finalized landed cost allocation for editing. This action is <strong>permanently recorded</strong> in the audit log.
            </p>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Reason (required) *</label>
              <Textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Explain why this allocation needs to be unlocked..."
                className="min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOverrideOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleAdminOverride} disabled={unlocking || !overrideReason.trim()}>
              {unlocking ? "Unlocking..." : "Confirm Override"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
