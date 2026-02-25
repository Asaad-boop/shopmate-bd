import { useSupplierPayments, usePostSupplierPayment, useSupplierPayables, useCashBankAccounts } from "@/hooks/use-purchasing";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CheckCircle2, Wallet, BookOpen, AlertTriangle, ExternalLink, FileImage } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface Props {
  paymentId: string | null;
  onClose: () => void;
}

export function PaymentDetailDrawer({ paymentId, onClose }: Props) {
  const { data: payments } = useSupplierPayments();
  const postPayment = usePostSupplierPayment();
  const { data: accounts } = useCashBankAccounts();
  const [confirmPost, setConfirmPost] = useState(false);

  const payment = payments?.find((p) => p.id === paymentId);

  // Get allocations for this payment
  const { data: allocations } = useQuery({
    queryKey: ["payment-allocations", paymentId],
    enabled: !!paymentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_payment_allocations")
        .select("*, goods_receipts:payable_id(grn_number, total_product_cost)")
        .eq("payment_id", paymentId!);
      if (error) throw error;
      return data;
    },
  });

  // Get all payments for same supplier to show history
  const supplierPayments = payments?.filter(
    (p) => payment && p.supplier_id === payment.supplier_id
  ).sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()) || [];

  const handlePost = () => {
    if (!paymentId) return;
    postPayment.mutate(paymentId, { onSuccess: () => setConfirmPost(false) });
  };

  const accountName = payment ? accounts?.find((a) => a.id === payment.paid_from_account_id)?.name : null;

  return (
    <>
      <Sheet open={!!paymentId} onOpenChange={(v) => !v && onClose()}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" />
              {payment?.payment_number || <Skeleton className="h-5 w-40" />}
            </SheetTitle>
          </SheetHeader>

          {!payment ? (
            <div className="space-y-3 mt-4">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <div className="space-y-5 mt-4">
              {/* Status */}
              <div className="flex items-center gap-2">
                <Badge className={`text-xs border ${payment.status === "posted" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-amber-500/10 text-amber-600 border-amber-500/20"}`}>
                  {payment.status === "posted" ? "✅ Posted" : "📋 Draft"}
                </Badge>
                <Badge variant="outline" className="text-xs">{payment.payment_method}</Badge>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-3">
                <InfoRow label="Supplier" value={(payment.suppliers as any)?.name || "—"} />
                <InfoRow label="Payment Date" value={format(new Date(payment.payment_date), "dd MMM yyyy")} />
                <InfoRow label="Account" value={accountName || (payment.chart_of_accounts as any)?.name || "—"} />
                <InfoRow label="Reference" value={payment.reference || "—"} />
              </div>

              {/* Amount */}
              <div className="rounded-xl border border-border bg-card p-4 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Payment Amount</p>
                <p className="text-2xl font-bold text-foreground">৳{(payment.amount || 0).toLocaleString()}</p>
              </div>

              {payment.notes && (
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <p className="text-xs text-muted-foreground">{payment.notes}</p>
                </div>
              )}

              {/* Payment Proof */}
              {(payment as any).proof_url && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                    <FileImage className="w-3.5 h-3.5" /> Payment Proof
                  </h4>
                  <a href={(payment as any).proof_url} target="_blank" rel="noopener noreferrer" className="block">
                    <img
                      src={(payment as any).proof_url}
                      alt="Payment proof"
                      className="rounded-lg border border-border max-h-40 object-contain cursor-pointer hover:opacity-80 transition-opacity"
                    />
                  </a>
                </div>
              )}

              <Separator />

              {/* Allocations */}
              {allocations && allocations.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Allocated To</h3>
                  <div className="rounded-xl border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">GRN</TableHead>
                          <TableHead className="text-xs text-right">GRN Total</TableHead>
                          <TableHead className="text-xs text-right">Allocated</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allocations.map((a) => (
                          <TableRow key={a.id}>
                            <TableCell className="text-xs font-medium text-primary">
                              {(a.goods_receipts as any)?.grn_number || a.payable_id.slice(0, 8)}
                            </TableCell>
                            <TableCell className="text-xs text-right text-muted-foreground">
                              ৳{((a.goods_receipts as any)?.total_product_cost || 0).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-xs text-right font-semibold">
                              ৳{(a.allocated_amount || 0).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <Separator />

              {/* GL Preview */}
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5" /> GL Entry
                </h4>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Dr Supplier Payable</span>
                    <span className="font-semibold">৳{(payment.amount || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cr {accountName || "Bank/Cash"}</span>
                    <span className="font-semibold">৳{(payment.amount || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Supplier Payment History */}
              {supplierPayments.length > 1 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Supplier Payment History</h3>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {supplierPayments.map((sp) => (
                      <div
                        key={sp.id}
                        className={`flex items-center justify-between rounded-lg border border-border p-2 text-xs ${sp.id === paymentId ? "bg-primary/5 border-primary/20" : ""}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{sp.payment_number}</span>
                          <span className="text-muted-foreground">{format(new Date(sp.payment_date), "dd MMM yy")}</span>
                          <Badge variant="outline" className="text-[9px] h-4">{sp.payment_method}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">৳{(sp.amount || 0).toLocaleString()}</span>
                          {sp.status === "posted" ? (
                            <span className="text-emerald-600 text-[10px]">✅</span>
                          ) : (
                            <span className="text-amber-600 text-[10px]">📋</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Post Action */}
              {payment.status === "draft" && (
                <Button className="w-full gap-2" onClick={() => setConfirmPost(true)}>
                  <CheckCircle2 className="w-4 h-4" /> Post Payment to GL
                </Button>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Confirm Post */}
      <Dialog open={confirmPost} onOpenChange={setConfirmPost}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Confirm Payment Posting
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>This will post the following journal entry:</p>
            <ul className="list-disc ml-5 space-y-1">
              <li><strong>Dr</strong> Supplier Payable — ৳{(payment?.amount || 0).toLocaleString()}</li>
              <li><strong>Cr</strong> {accountName || "Bank/Cash"} — ৳{(payment?.amount || 0).toLocaleString()}</li>
            </ul>
            <p className="text-xs text-amber-600 mt-3">⚠️ Posted payments require reversal entries for corrections.</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmPost(false)}>Cancel</Button>
            <Button onClick={handlePost} disabled={postPayment.isPending}>
              {postPayment.isPending ? "Posting..." : "Confirm & Post"}
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
