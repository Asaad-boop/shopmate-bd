import { useState } from "react";
import { useLandedCosts, useCreateLandedCost, usePostLandedCost, useCashBankAccounts } from "@/hooks/use-purchasing";
import { usePurchaseOrders } from "@/hooks/use-purchase-orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, CheckCircle2, Ship } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";

const COST_TYPES = ["FREIGHT", "DUTY", "CNF", "TRANSPORT", "WAREHOUSE", "OTHER"];

export function LandedCostsTab() {
  const { data: costs, isLoading } = useLandedCosts();
  const { data: pos } = usePurchaseOrders();
  const { data: accounts } = useCashBankAccounts();
  const createCost = useCreateLandedCost();
  const postCost = usePostLandedCost();
  const [modalOpen, setModalOpen] = useState(false);

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

  const resetForm = () => { setPoId(""); setCostDate(format(new Date(), "yyyy-MM-dd")); setCostType("FREIGHT"); setAmount(0); setPaidFrom(""); setNotes(""); };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Import Landed Costs</h3>
        <Button size="sm" className="gap-1.5" onClick={() => { resetForm(); setModalOpen(true); }}>
          <Plus className="w-4 h-4" /> Add Cost
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}</div>
        ) : !costs?.length ? (
          <div className="flex flex-col items-center py-16">
            <Ship className="w-10 h-10 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No landed costs yet</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Paid From</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {costs.map((c, i) => (
                <TableRow key={c.id} className="animate-row-in" style={{ animationDelay: `${i * 30}ms` }}>
                  <TableCell className="text-sm font-medium">{(c.purchase_orders as any)?.po_number || "—"}</TableCell>
                  <TableCell><Badge className="text-[10px] bg-primary/10 text-primary">{c.cost_type}</Badge></TableCell>
                  <TableCell className="text-sm">{format(new Date(c.cost_date), "dd MMM yyyy")}</TableCell>
                  <TableCell className="font-semibold">৳{(c.amount || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{(c.chart_of_accounts as any)?.name || "—"}</TableCell>
                  <TableCell>
                    {c.status === "posted" ? (
                      <Badge className="bg-success/10 text-success text-[10px]">✅ Posted</Badge>
                    ) : (
                      <Badge className="bg-muted text-muted-foreground text-[10px]">📋 Draft</Badge>
                    )}
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
                    {accounts?.map((a) => <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>)}
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
    </div>
  );
}
