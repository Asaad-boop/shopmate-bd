import { useState } from "react";
import { useSupplierPayments, useCreateSupplierPayment, usePostSupplierPayment, useCashBankAccounts, useSupplierPayables } from "@/hooks/use-purchasing";
import { useSuppliers } from "@/hooks/use-purchase-orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, CheckCircle2, Wallet } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";

export function SupplierPaymentsTab() {
  const { data: payments, isLoading } = useSupplierPayments();
  const { data: suppliers } = useSuppliers();
  const { data: accounts } = useCashBankAccounts();
  const { data: payables } = useSupplierPayables();
  const createPayment = useCreateSupplierPayment();
  const postPayment = usePostSupplierPayment();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  // Form
  const [supplierId, setSupplierId] = useState("");
  const [paymentDate, setPaymentDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [paymentMethod, setPaymentMethod] = useState("BANK");
  const [paidFromAccountId, setPaidFromAccountId] = useState("");
  const [amount, setAmount] = useState(0);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedPayables, setSelectedPayables] = useState<Map<string, number>>(new Map());

  const supplierPayables = payables?.filter((p) => (p as any).supplier_id === supplierId) || [];

  const togglePayable = (id: string, outstanding: number) => {
    setSelectedPayables((prev) => {
      const next = new Map(prev);
      if (next.has(id)) next.delete(id);
      else next.set(id, outstanding);
      return next;
    });
  };

  const totalAllocated = Array.from(selectedPayables.values()).reduce((s, v) => s + v, 0);

  const handleCreate = () => {
    if (!supplierId || !paidFromAccountId || amount <= 0) {
      toast({ title: "Fill all required fields", variant: "destructive" });
      return;
    }
    const allocations = Array.from(selectedPayables.entries()).map(([payableId, allocAmt]) => ({
      payable_type: "GRN",
      payable_id: payableId,
      allocated_amount: allocAmt,
    }));
    createPayment.mutate(
      { supplier_id: supplierId, payment_date: paymentDate, payment_method: paymentMethod, paid_from_account_id: paidFromAccountId, amount, reference, notes, allocations },
      {
        onSuccess: () => {
          setModalOpen(false);
          resetForm();
        },
      }
    );
  };

  const resetForm = () => {
    setSupplierId("");
    setPaymentDate(format(new Date(), "yyyy-MM-dd"));
    setPaymentMethod("BANK");
    setPaidFromAccountId("");
    setAmount(0);
    setReference("");
    setNotes("");
    setSelectedPayables(new Map());
  };

  const filtered = payments?.filter(
    (p) => !search || p.payment_number.toLowerCase().includes(search.toLowerCase()) || (p.suppliers as any)?.name?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search payments..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => { resetForm(); setModalOpen(true); }}>
          <Plus className="w-4 h-4" /> New Payment
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16">
            <Wallet className="w-10 h-10 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No supplier payments yet</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payment #</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p, i) => (
                <TableRow key={p.id} className="animate-row-in" style={{ animationDelay: `${i * 30}ms` }}>
                  <TableCell className="font-bold text-primary">{p.payment_number}</TableCell>
                  <TableCell className="text-sm">{(p.suppliers as any)?.name || "—"}</TableCell>
                  <TableCell className="text-sm">{format(new Date(p.payment_date), "dd MMM yyyy")}</TableCell>
                  <TableCell className="text-sm">{p.payment_method}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{(p.chart_of_accounts as any)?.name || "—"}</TableCell>
                  <TableCell className="font-semibold">৳{(p.amount || 0).toLocaleString()}</TableCell>
                  <TableCell>
                    {p.status === "posted" ? (
                      <Badge className="bg-success/10 text-success text-[10px]">✅ Posted</Badge>
                    ) : (
                      <Badge className="bg-muted text-muted-foreground text-[10px]">📋 Draft</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {p.status === "draft" && (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => postPayment.mutate(p.id)} disabled={postPayment.isPending}>
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

      {/* Create Payment Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Supplier Payment</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Supplier *</label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>
                    {suppliers?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Paid From Account *</label>
                <Select value={paidFromAccountId} onValueChange={setPaidFromAccountId}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select account" /></SelectTrigger>
                  <SelectContent>
                    {accounts?.map((a) => <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Date</label>
                <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="h-9" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Method</label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["CASH", "BANK", "BKASH", "NAGAD", "OTHER"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Amount *</label>
                <Input type="number" value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} className="h-9" placeholder="0" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Reference / TxnID" value={reference} onChange={(e) => setReference(e.target.value)} className="h-9" />
              <Input placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="h-9" />
            </div>

            {/* Allocation to outstanding GRNs */}
            {supplierId && supplierPayables.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Allocate to Outstanding Payables</h3>
                <div className="rounded-xl border border-border overflow-hidden max-h-48 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8" />
                        <TableHead>GRN</TableHead>
                        <TableHead>Outstanding</TableHead>
                        <TableHead>Allocate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {supplierPayables.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>
                            <Checkbox checked={selectedPayables.has(p.id)} onCheckedChange={() => togglePayable(p.id, p.outstanding)} />
                          </TableCell>
                          <TableCell className="text-xs font-medium">{p.grn_number}</TableCell>
                          <TableCell className="text-xs">৳{p.outstanding.toLocaleString()}</TableCell>
                          <TableCell>
                            {selectedPayables.has(p.id) && (
                              <Input
                                type="number"
                                className="h-7 text-xs w-24"
                                value={selectedPayables.get(p.id) || ""}
                                onChange={(e) => {
                                  const val = Math.min(Number(e.target.value), p.outstanding);
                                  setSelectedPayables((prev) => new Map(prev).set(p.id, val));
                                }}
                              />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Allocated: ৳{totalAllocated.toLocaleString()} / Payment: ৳{amount.toLocaleString()}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createPayment.isPending}>
              {createPayment.isPending ? "Creating..." : "Create Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
