import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLandedCosts, useCreateLandedCost, usePostLandedCost, useCashBankAccounts } from "@/hooks/use-purchasing";
import { usePurchaseOrders } from "@/hooks/use-purchase-orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, CheckCircle2, Ship, Search, Eye, Lock } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { LandedCostDetailDrawer } from "./LandedCostDetailDrawer";

const COST_TYPES = ["FREIGHT", "DUTY", "CNF", "TRANSPORT", "WAREHOUSE", "OTHER"];

export function LandedCostsTab() {
  const { data: costs, isLoading: costsLoading } = useLandedCosts();
  const { data: pos } = usePurchaseOrders();
  const { data: accounts } = useCashBankAccounts();
  const createCost = useCreateLandedCost();
  const postCost = usePostLandedCost();
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedAllocationId, setSelectedAllocationId] = useState<string | null>(null);

  // Landed cost allocations (history)
  const { data: allocations, isLoading: allocLoading } = useQuery({
    queryKey: ["landed-cost-allocations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("landed_cost_allocations")
        .select("*, import_shipments:import_shipment_id(import_number, suppliers(name)), purchase_orders:po_id(po_number), goods_receipts:grn_id(grn_number), landed_cost_allocation_lines(id, allocated_cost)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const [poId, setPoId] = useState("");
  const [costDate, setCostDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [costType, setCostType] = useState("FREIGHT");
  const [amount, setAmount] = useState(0);
  const [paidFrom, setPaidFrom] = useState("");
  const [notes, setNotes] = useState("");

  const handleCreate = () => {
    if (amount <= 0) { toast({ title: "Amount required", variant: "destructive" }); return; }
    createCost.mutate(
      { po_id: poId || undefined, cost_date: costDate, cost_type: costType, amount, paid_from_account_id: paidFrom || undefined, notes },
      { onSuccess: () => { setModalOpen(false); resetForm(); } }
    );
  };

  const resetForm = () => {
    setPoId(""); setCostDate(format(new Date(), "yyyy-MM-dd")); setCostType("FREIGHT"); setAmount(0); setPaidFrom(""); setNotes("");
  };

  const filteredAllocations = allocations?.filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (a.import_shipments as any)?.import_number?.toLowerCase().includes(q) ||
      (a.purchase_orders as any)?.po_number?.toLowerCase().includes(q) ||
      (a.goods_receipts as any)?.grn_number?.toLowerCase().includes(q) ||
      a.allocation_method.toLowerCase().includes(q)
    );
  }) || [];

  // Stats
  const totalAllocated = allocations?.reduce((s, a) => s + (a.total_landed_cost || 0), 0) || 0;
  const finalizedCount = allocations?.filter((a) => a.is_finalized || a.status === "posted").length || 0;
  const draftCount = allocations?.filter((a) => !a.is_finalized && a.status !== "posted").length || 0;

  const methodLabel = (m: string) => {
    if (m === "BY_QTY") return "Qty";
    if (m === "BY_VALUE") return "Value";
    if (m === "BY_WEIGHT") return "Weight";
    return m;
  };

  return (
    <div className="space-y-6 mt-4">
      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total Allocated</p>
          <p className="text-lg font-bold text-foreground">৳{totalAllocated.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Finalized</p>
          <p className="text-lg font-bold text-emerald-600">{finalizedCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Draft</p>
          <p className="text-lg font-bold text-amber-600">{draftCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Cost Entries</p>
          <p className="text-lg font-bold text-foreground">{costs?.length || 0}</p>
        </div>
      </div>

      {/* Allocation History */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Allocation History</h3>
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-8 text-xs" />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          {allocLoading ? (
            <div className="p-6 space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}</div>
          ) : filteredAllocations.length === 0 ? (
            <div className="flex flex-col items-center py-12">
              <Ship className="w-10 h-10 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No allocations yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Import / PO</TableHead>
                  <TableHead className="text-xs">GRN</TableHead>
                  <TableHead className="text-xs">Method</TableHead>
                  <TableHead className="text-xs text-right">Total Landed</TableHead>
                  <TableHead className="text-xs text-center">SKUs</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAllocations.map((a, i) => {
                  const lineCount = (a.landed_cost_allocation_lines as any[])?.length || 0;
                  const finalized = a.is_finalized || a.status === "posted";
                  return (
                    <TableRow
                      key={a.id}
                      className="cursor-pointer hover:bg-muted/50 animate-row-in"
                      style={{ animationDelay: `${i * 25}ms` }}
                      onClick={() => setSelectedAllocationId(a.id)}
                    >
                      <TableCell className="text-sm font-medium text-primary">
                        {(a.import_shipments as any)?.import_number || (a.purchase_orders as any)?.po_number || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {(a.goods_receipts as any)?.grn_number || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{methodLabel(a.allocation_method)}</Badge>
                      </TableCell>
                      <TableCell className="text-sm font-semibold text-right">
                        ৳{(a.total_landed_cost || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm text-center">{lineCount}</TableCell>
                      <TableCell>
                        {finalized ? (
                          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 border text-[10px] gap-1">
                            <Lock className="w-2.5 h-2.5" /> Finalized
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 border text-[10px]">
                            📋 Draft
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {a.created_at ? format(new Date(a.created_at), "dd MMM yy") : "—"}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setSelectedAllocationId(a.id); }}>
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Individual Cost Entries */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Cost Entries</h3>
          <Button size="sm" className="gap-1.5" onClick={() => { resetForm(); setModalOpen(true); }}>
            <Plus className="w-4 h-4" /> Add Cost
          </Button>
        </div>

        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          {costsLoading ? (
            <div className="p-6 space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}</div>
          ) : !costs?.length ? (
            <div className="flex flex-col items-center py-12">
              <Ship className="w-8 h-8 text-muted-foreground/40 mb-2" />
              <p className="text-xs text-muted-foreground">No cost entries</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">PO</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs text-right">Amount</TableHead>
                  <TableHead className="text-xs">Paid From</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {costs.map((c, i) => (
                  <TableRow key={c.id} className="animate-row-in" style={{ animationDelay: `${i * 25}ms` }}>
                    <TableCell className="text-sm font-medium">{(c.purchase_orders as any)?.po_number || "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{c.cost_type}</Badge></TableCell>
                    <TableCell className="text-xs">{format(new Date(c.cost_date), "dd MMM yyyy")}</TableCell>
                    <TableCell className="font-semibold text-right">৳{(c.amount || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{(c.chart_of_accounts as any)?.name || "—"}</TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] ${c.status === "posted" ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                        {c.status === "posted" ? "✅ Posted" : "📋 Draft"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {c.status === "draft" && (
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => postCost.mutate(c.id)} disabled={postCost.isPending}>
                          <CheckCircle2 className="w-3 h-3" /> Post
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Add Cost Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Landed Cost</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Purchase Order</label>
              <Select value={poId} onValueChange={setPoId}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select PO" /></SelectTrigger>
                <SelectContent>
                  {pos?.map((p) => <SelectItem key={p.id} value={p.id}>{p.po_number}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Cost Type</label>
                <Select value={costType} onValueChange={setCostType}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COST_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Amount (BDT)</label>
                <Input type="number" value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} className="h-9" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Date</label>
                <Input type="date" value={costDate} onChange={(e) => setCostDate(e.target.value)} className="h-9" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Paid From</label>
                <Select value={paidFrom} onValueChange={setPaidFrom}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Account" /></SelectTrigger>
                  <SelectContent>
                    {accounts?.map((a) => <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Input placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="h-9" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createCost.isPending}>Add Cost</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LandedCostDetailDrawer allocationId={selectedAllocationId} onClose={() => setSelectedAllocationId(null)} />
    </div>
  );
}
