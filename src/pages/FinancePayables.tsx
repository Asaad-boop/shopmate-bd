import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBDT, formatDate } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useCashBankAccounts } from "@/hooks/use-purchasing";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  ArrowLeft, DollarSign, Users, Clock, AlertTriangle,
  ChevronRight, CreditCard, FileText, ExternalLink, Banknote,
} from "lucide-react";

/* ─── hooks ─── */
function usePayablesAging() {
  return useQuery({
    queryKey: ["finance-payables-aging"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("supplier_payables_aging");
      if (error) throw error;
      return data as any;
    },
  });
}

function useSupplierDetail(supplierId: string | null) {
  return useQuery({
    queryKey: ["supplier-payable-detail", supplierId],
    enabled: !!supplierId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("supplier_payable_detail", { p_supplier_id: supplierId! });
      if (error) throw error;
      return data as any;
    },
  });
}

function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      supplier_id: string;
      amount: number;
      payment_date: string;
      payment_method: string;
      paid_from_account_id: string;
      reference: string;
      notes: string;
      grn_allocations: { grn_id: string; amount: number }[];
    }) => {
      const seq = String(Math.floor(Math.random() * 9999)).padStart(4, "0");
      const yr = new Date().getFullYear();
      const mo = String(new Date().getMonth() + 1).padStart(2, "0");

      const { data: payment, error } = await supabase
        .from("supplier_payments")
        .insert({
          payment_number: `SP-${yr}${mo}-${seq}`,
          supplier_id: payload.supplier_id,
          payment_date: payload.payment_date,
          payment_method: payload.payment_method,
          paid_from_account_id: payload.paid_from_account_id,
          amount: payload.amount,
          reference: payload.reference || null,
          notes: payload.notes || null,
          status: "draft",
        })
        .select("id")
        .single();
      if (error) throw error;

      // allocations
      if (payload.grn_allocations.length > 0) {
        await supabase.from("supplier_payment_allocations").insert(
          payload.grn_allocations.map((a) => ({
            payment_id: payment.id,
            payable_type: "grn",
            payable_id: a.grn_id,
            allocated_amount: a.amount,
          }))
        );
      }

      // Post journal
      const { error: postErr } = await supabase.rpc("post_supplier_payment", {
        p_payment_id: payment.id,
        p_amount: payload.amount,
        p_pay_account_id: payload.paid_from_account_id,
        p_entry_date: payload.payment_date,
      });
      if (postErr) throw postErr;

      // Audit
      await supabase.from("audit_logs").insert({
        entity_type: "supplier_payment",
        entity_id: payment.id,
        action: "record_payment",
        after_json: payload as any,
        reason: `Supplier payment ৳${payload.amount}`,
      });

      return payment;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-payables-aging"] });
      qc.invalidateQueries({ queryKey: ["supplier-payable-detail"] });
      qc.invalidateQueries({ queryKey: ["supplier-payments"] });
      toast({ title: "Payment recorded & posted to GL" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

const BUCKETS = [
  { key: "0-15", label: "0–15 days", accent: "bg-success/10 text-success" },
  { key: "16-30", label: "16–30 days", accent: "bg-info/10 text-info" },
  { key: "31-60", label: "31–60 days", accent: "bg-warning/10 text-warning" },
  { key: "60+", label: "60+ days", accent: "bg-destructive/10 text-destructive" },
];

/* ─── main page ─── */
export default function FinancePayables() {
  const nav = useNavigate();
  const { data: aging, isLoading } = usePayablesAging();
  const [selectedSupplier, setSelectedSupplier] = useState<{ id: string; name: string } | null>(null);
  const [payOpen, setPayOpen] = useState(false);

  const suppliers: any[] = aging?.suppliers || [];
  const buckets = aging?.buckets || {};

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card sticky top-0 z-20">
        <div className="flex items-center justify-between px-6 h-14 max-w-[1400px] mx-auto">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => nav("/finance")} className="h-8 w-8">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-destructive/10">
                <CreditCard className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">Supplier Payables & Aging</h1>
                <p className="text-[11px] text-muted-foreground -mt-0.5">Outstanding supplier dues with aging analysis</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-[1400px] mx-auto space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs font-medium text-muted-foreground">Total Outstanding</p>
              <p className="text-xl font-bold text-destructive mt-1">{formatBDT(aging?.total_outstanding || 0)}</p>
              <p className="text-[10px] text-muted-foreground">{suppliers.length} suppliers</p>
            </CardContent>
          </Card>
          {BUCKETS.map((b) => (
            <Card key={b.key}>
              <CardContent className="p-4 text-center">
                <p className="text-xs font-medium text-muted-foreground">{b.label}</p>
                <p className="text-lg font-bold text-foreground mt-1">{formatBDT(buckets[b.key] || 0)}</p>
                <Badge className={`text-[9px] mt-1 ${b.accent}`}>{b.key}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Supplier Table */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          {suppliers.length === 0 ? (
            <div className="flex flex-col items-center py-16">
              <Users className="w-10 h-10 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No outstanding payables</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Total Invoiced</TableHead>
                  <TableHead className="text-right">Total Paid</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead className="text-right">0–15d</TableHead>
                  <TableHead className="text-right">16–30d</TableHead>
                  <TableHead className="text-right">31–60d</TableHead>
                  <TableHead className="text-right">60+d</TableHead>
                  <TableHead className="text-center">GRNs</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((s: any, i: number) => (
                  <TableRow
                    key={s.supplier_id}
                    className="cursor-pointer hover:bg-muted/50"
                    style={{ animationDelay: `${i * 25}ms` }}
                    onClick={() => setSelectedSupplier({ id: s.supplier_id, name: s.supplier_name })}
                  >
                    <TableCell className="font-semibold text-sm">{s.supplier_name}</TableCell>
                    <TableCell className="text-right text-sm">{formatBDT(s.total_invoiced)}</TableCell>
                    <TableCell className="text-right text-sm text-success">{formatBDT(s.total_paid)}</TableCell>
                    <TableCell className="text-right text-sm font-bold text-destructive">{formatBDT(s.outstanding)}</TableCell>
                    <TableCell className="text-right text-xs">{formatBDT(s.bucket_0_15)}</TableCell>
                    <TableCell className="text-right text-xs">{formatBDT(s.bucket_16_30)}</TableCell>
                    <TableCell className="text-right text-xs">
                      {s.bucket_31_60 > 0 ? <span className="text-warning font-medium">{formatBDT(s.bucket_31_60)}</span> : "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {s.bucket_60_plus > 0 ? (
                        <span className="text-destructive font-medium flex items-center justify-end gap-1">
                          <AlertTriangle className="w-3 h-3" />{formatBDT(s.bucket_60_plus)}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="text-[10px]">{s.open_grns}</Badge>
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Supplier Detail Drawer */}
      {selectedSupplier && (
        <SupplierDrawer
          supplierId={selectedSupplier.id}
          supplierName={selectedSupplier.name}
          open={!!selectedSupplier}
          onClose={() => setSelectedSupplier(null)}
          onPayClick={() => setPayOpen(true)}
        />
      )}

      {/* Payment Modal */}
      {selectedSupplier && payOpen && (
        <PaymentModal
          supplierId={selectedSupplier.id}
          supplierName={selectedSupplier.name}
          open={payOpen}
          onClose={() => setPayOpen(false)}
        />
      )}
    </div>
  );
}

/* ─── Supplier Detail Drawer ─── */
function SupplierDrawer({
  supplierId, supplierName, open, onClose, onPayClick,
}: {
  supplierId: string; supplierName: string; open: boolean; onClose: () => void; onPayClick: () => void;
}) {
  const nav = useNavigate();
  const { data, isLoading } = useSupplierDetail(supplierId);
  const grns: any[] = data?.grns || [];
  const payments: any[] = data?.payments || [];

  const totalOutstanding = grns.reduce((s: number, g: any) => s + (g.outstanding || 0), 0);

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-[600px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            {supplierName}
          </SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="space-y-3 mt-4">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : (
          <div className="space-y-5 mt-4">
            {/* Summary */}
            <div className="flex items-center gap-3">
              <Card className="flex-1">
                <CardContent className="p-3 text-center">
                  <p className="text-[10px] text-muted-foreground">Outstanding</p>
                  <p className="text-lg font-bold text-destructive">{formatBDT(totalOutstanding)}</p>
                </CardContent>
              </Card>
              <Card className="flex-1">
                <CardContent className="p-3 text-center">
                  <p className="text-[10px] text-muted-foreground">Open GRNs</p>
                  <p className="text-lg font-bold text-foreground">{grns.filter((g: any) => g.outstanding > 0.01).length}</p>
                </CardContent>
              </Card>
              <Button onClick={onPayClick} className="bg-primary hover:bg-primary/90 text-primary-foreground h-16 px-5">
                <Banknote className="w-4 h-4 mr-1" /> Pay
              </Button>
            </div>

            {/* Open GRNs */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4" /> Open Invoices / GRNs
              </h3>
              <div className="rounded-xl border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">GRN</TableHead>
                      <TableHead className="text-xs">PO</TableHead>
                      <TableHead className="text-xs">Date</TableHead>
                      <TableHead className="text-xs text-right">Total</TableHead>
                      <TableHead className="text-xs text-right">Paid</TableHead>
                      <TableHead className="text-xs text-right">Due</TableHead>
                      <TableHead className="text-xs">Age</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {grns.map((g: any) => (
                      <TableRow key={g.id}>
                        <TableCell className="text-xs font-bold text-primary">{g.grn_number}</TableCell>
                        <TableCell className="text-xs">
                          {g.po_number ? (
                            <button
                              onClick={() => nav(`/purchase-orders/${g.po_id}`)}
                              className="text-primary hover:underline flex items-center gap-0.5"
                            >
                              {g.po_number} <ExternalLink className="w-3 h-3" />
                            </button>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-xs">{formatDate(g.receipt_date)}</TableCell>
                        <TableCell className="text-xs text-right">{formatBDT(g.total_product_cost)}</TableCell>
                        <TableCell className="text-xs text-right text-success">{formatBDT(g.paid)}</TableCell>
                        <TableCell className="text-xs text-right font-bold text-destructive">{formatBDT(g.outstanding)}</TableCell>
                        <TableCell className="text-xs">
                          <Badge className={`text-[9px] ${g.days_since > 60 ? "bg-destructive/10 text-destructive" : g.days_since > 30 ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground"}`}>
                            {g.days_since}d
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {grns.length === 0 && (
                      <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground text-sm">No GRNs</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Payment History */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <DollarSign className="w-4 h-4" /> Payment History
              </h3>
              <div className="rounded-xl border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Ref</TableHead>
                      <TableHead className="text-xs">Date</TableHead>
                      <TableHead className="text-xs">Method</TableHead>
                      <TableHead className="text-xs text-right">Amount</TableHead>
                      <TableHead className="text-xs">Account</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-xs font-medium">{p.payment_number}</TableCell>
                        <TableCell className="text-xs">{formatDate(p.payment_date)}</TableCell>
                        <TableCell className="text-xs capitalize">{p.payment_method}</TableCell>
                        <TableCell className="text-xs text-right font-bold">{formatBDT(p.amount)}</TableCell>
                        <TableCell className="text-xs">{p.paid_from_name || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={p.status === "posted" ? "default" : "secondary"} className="text-[9px]">
                            {p.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {payments.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground text-sm">No payments yet</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ─── Payment Modal ─── */
function PaymentModal({
  supplierId, supplierName, open, onClose,
}: {
  supplierId: string; supplierName: string; open: boolean; onClose: () => void;
}) {
  const { data: accounts } = useCashBankAccounts();
  const { data: detail } = useSupplierDetail(supplierId);
  const recordPayment = useRecordPayment();

  const openGRNs: any[] = (detail?.grns || []).filter((g: any) => g.outstanding > 0.01);
  const totalDue = openGRNs.reduce((s: number, g: any) => s + g.outstanding, 0);

  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [method, setMethod] = useState("bank");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const cashBankAccounts = (accounts || []).filter((a: any) =>
    ["1100", "1101", "1102", "1103"].includes(a.code)
  );

  const handleSubmit = () => {
    const amt = Number(amount);
    if (!amt || !accountId) return;
    if (!notes.trim()) {
      toast({ title: "Notes required", description: "Please provide a reason for audit trail", variant: "destructive" });
      return;
    }

    // Auto-allocate to oldest GRNs first
    let remaining = amt;
    const allocations: { grn_id: string; amount: number }[] = [];
    for (const g of openGRNs) {
      if (remaining <= 0) break;
      const alloc = Math.min(remaining, g.outstanding);
      allocations.push({ grn_id: g.id, amount: alloc });
      remaining -= alloc;
    }

    recordPayment.mutate(
      {
        supplier_id: supplierId,
        amount: amt,
        payment_date: new Date().toISOString().slice(0, 10),
        payment_method: method,
        paid_from_account_id: accountId,
        reference,
        notes,
        grn_allocations: allocations,
      },
      { onSuccess: () => onClose() }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="w-5 h-5 text-primary" />
            Pay {supplierName}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Total Outstanding</p>
            <p className="text-xl font-bold text-destructive">{formatBDT(totalDue)}</p>
            <p className="text-[10px] text-muted-foreground">{openGRNs.length} open GRNs — auto-allocated oldest first</p>
          </div>

          <div>
            <Label>Amount (৳)</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={String(totalDue)}
              className="text-lg h-12 font-mono"
            />
          </div>

          <div>
            <Label>Pay From Account</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
              <SelectContent>
                {cashBankAccounts.map((a: any) => (
                  <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Payment Method</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["bank", "bkash", "nagad", "cash"].map((m) => (
                  <SelectItem key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Reference / TxnID</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. DBBL-20250225" />
          </div>

          <div>
            <Label>Notes (required for audit)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Reason / description" />
          </div>

          <div className="bg-muted/30 rounded-lg p-3 text-xs space-y-1">
            <p className="font-semibold text-foreground">Journal Preview:</p>
            <p className="text-success">Dr Supplier Payable (2100) — {formatBDT(Number(amount) || 0)}</p>
            <p className="text-destructive">Cr {cashBankAccounts.find((a: any) => a.id === accountId)?.name || "Account"} — {formatBDT(Number(amount) || 0)}</p>
          </div>

          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={recordPayment.isPending || !Number(amount) || !accountId || !notes.trim()}
          >
            {recordPayment.isPending ? "Posting..." : "Record & Post Payment"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
