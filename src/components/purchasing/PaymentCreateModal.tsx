import { useState, useRef } from "react";
import { useCreateSupplierPayment, useCashBankAccounts, useSupplierPayables } from "@/hooks/use-purchasing";
import { useSuppliers, usePurchaseOrders } from "@/hooks/use-purchase-orders";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Wallet, Upload, FileImage, BookOpen, X } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function PaymentCreateModal({ open, onOpenChange }: Props) {
  const { data: suppliers } = useSuppliers();
  const { data: accounts } = useCashBankAccounts();
  const { data: pos } = usePurchaseOrders();
  const { data: payables } = useSupplierPayables();
  const createPayment = useCreateSupplierPayment();

  const [supplierId, setSupplierId] = useState("");
  const [paymentDate, setPaymentDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [paymentMethod, setPaymentMethod] = useState("BANK");
  const [paidFromAccountId, setPaidFromAccountId] = useState("");
  const [amount, setAmount] = useState(0);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedPayables, setSelectedPayables] = useState<Map<string, number>>(new Map());
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const supplierPayables = payables?.filter((p) => (p as any).supplier_id === supplierId) || [];
  const totalOutstanding = supplierPayables.reduce((s, p) => s + p.outstanding, 0);
  const totalAllocated = Array.from(selectedPayables.values()).reduce((s, v) => s + v, 0);

  const togglePayable = (id: string, outstanding: number) => {
    setSelectedPayables((prev) => {
      const next = new Map(prev);
      if (next.has(id)) next.delete(id);
      else next.set(id, Math.min(outstanding, Math.max(0, amount - totalAllocated)));
      return next;
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large (max 5MB)", variant: "destructive" });
      return;
    }
    setProofFile(file);
    setProofPreview(URL.createObjectURL(file));
  };

  const uploadProof = async (): Promise<string | null> => {
    if (!proofFile) return null;
    setUploading(true);
    const ext = proofFile.name.split(".").pop();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("payment-proofs").upload(path, proofFile);
    setUploading(false);
    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      return null;
    }
    const { data: urlData } = supabase.storage.from("payment-proofs").getPublicUrl(path);
    return urlData.publicUrl;
  };

  const handleCreate = async () => {
    if (!supplierId || !paidFromAccountId || amount <= 0) {
      toast({ title: "Fill all required fields", variant: "destructive" });
      return;
    }

    // Upload proof first if exists
    let proofUrl: string | null = null;
    if (proofFile) {
      proofUrl = await uploadProof();
    }

    const allocations = Array.from(selectedPayables.entries()).map(([payableId, allocAmt]) => ({
      payable_type: "GRN",
      payable_id: payableId,
      allocated_amount: allocAmt,
    }));

    createPayment.mutate(
      {
        supplier_id: supplierId,
        payment_date: paymentDate,
        payment_method: paymentMethod,
        paid_from_account_id: paidFromAccountId,
        amount,
        reference,
        notes,
        allocations,
        proof_url: proofUrl,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
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
    setProofFile(null);
    setProofPreview(null);
  };

  const remainingDue = totalOutstanding - totalAllocated;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            Record Supplier Payment
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Supplier & Account */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Supplier *</label>
              <Select value={supplierId} onValueChange={(v) => { setSupplierId(v); setSelectedPayables(new Map()); }}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>
                  {suppliers?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Pay From Account *</label>
              <Select value={paidFromAccountId} onValueChange={setPaidFromAccountId}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  {accounts?.map((a) => <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date, Method, Amount */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Payment Date</label>
              <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="h-9" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Method</label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["CASH", "BANK", "BKASH", "NAGAD", "ALIPAY", "USDT", "OTHER"].map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Amount (৳) *</label>
              <Input type="number" value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} className="h-9" placeholder="0" />
            </div>
          </div>

          {/* Reference & Notes */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Reference / TxnID</label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} className="h-9" placeholder="e.g. TRX-12345" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes</label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="h-9" placeholder="Optional..." />
            </div>
          </div>

          {/* Payment Proof Upload */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Payment Proof</label>
            <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileSelect} />
            {proofPreview ? (
              <div className="relative rounded-lg border border-border overflow-hidden w-fit">
                <img src={proofPreview} alt="Proof" className="max-h-32 object-contain" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-1 right-1 h-6 w-6 bg-background/80"
                  onClick={() => { setProofFile(null); setProofPreview(null); }}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => fileRef.current?.click()}>
                <Upload className="w-3.5 h-3.5" /> Attach Receipt / Screenshot
              </Button>
            )}
          </div>

          <Separator />

          {/* Allocation to Payables */}
          {supplierId && supplierPayables.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">Allocate to Outstanding Payables</h3>
                <Badge variant="outline" className="text-xs">
                  Due: ৳{totalOutstanding.toLocaleString()}
                </Badge>
              </div>
              <div className="rounded-xl border border-border overflow-hidden max-h-52 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8" />
                      <TableHead className="text-xs">GRN</TableHead>
                      <TableHead className="text-xs">Date</TableHead>
                      <TableHead className="text-xs text-right">Outstanding</TableHead>
                      <TableHead className="text-xs w-28">Allocate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {supplierPayables.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <Checkbox checked={selectedPayables.has(p.id)} onCheckedChange={() => togglePayable(p.id, p.outstanding)} />
                        </TableCell>
                        <TableCell className="text-xs font-medium text-primary">{p.grn_number}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{format(new Date(p.receipt_date), "dd MMM")}</TableCell>
                        <TableCell className="text-xs text-right font-semibold">৳{p.outstanding.toLocaleString()}</TableCell>
                        <TableCell>
                          {selectedPayables.has(p.id) && (
                            <Input
                              type="number"
                              className="h-7 text-xs"
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
              <div className="flex items-center justify-between mt-2 text-xs">
                <span className="text-muted-foreground">
                  Allocated: ৳{totalAllocated.toLocaleString()} / Payment: ৳{amount.toLocaleString()}
                </span>
                <span className="font-semibold">
                  Remaining Due: ৳{Math.max(0, remainingDue).toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {supplierId && supplierPayables.length === 0 && (
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-xs text-muted-foreground">No outstanding payables for this supplier</p>
            </div>
          )}

          <Separator />

          {/* GL Preview */}
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5" /> GL Impact (on post)
            </h4>
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Dr Supplier Payable</span>
                <span className="font-semibold">৳{amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cr {accounts?.find(a => a.id === paidFromAccountId)?.name || "Bank/Cash"}</span>
                <span className="font-semibold">৳{amount.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={createPayment.isPending || uploading}>
            {uploading ? "Uploading..." : createPayment.isPending ? "Creating..." : "Create Payment (Draft)"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
