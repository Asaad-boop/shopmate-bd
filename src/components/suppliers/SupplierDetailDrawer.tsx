import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KpiCard } from "@/components/ui/kpi-card";
import { Pencil, DollarSign, BookOpen, Package, CreditCard } from "lucide-react";
import { format } from "date-fns";

interface Props {
  supplierId: string | null;
  onClose: () => void;
  onEdit: (s: any) => void;
}

export default function SupplierDetailDrawer({ supplierId, onClose, onEdit }: Props) {
  const queryClient = useQueryClient();
  const [paymentOpen, setPaymentOpen] = useState(false);

  // Fetch supplier
  const { data: supplier, isLoading: loadingSupplier } = useQuery({
    queryKey: ["supplier-detail", supplierId],
    enabled: !!supplierId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*, agents(name)")
        .eq("id", supplierId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch financials from view
  const { data: financials } = useQuery({
    queryKey: ["supplier-financials", supplierId],
    enabled: !!supplierId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_supplier_financials")
        .select("*")
        .eq("supplier_id", supplierId!)
        .single();
      if (error) return { total_purchase_value: 0, total_paid: 0, total_due: 0, open_po_count: 0 };
      return data;
    },
  });

  // Payment history
  const { data: payments, isLoading: loadingPayments } = useQuery({
    queryKey: ["supplier-payments", supplierId],
    enabled: !!supplierId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_payments")
        .select("*, chart_of_accounts:paid_from_account_id(name)")
        .eq("supplier_id", supplierId!)
        .order("payment_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  // Open POs
  const { data: openPOs } = useQuery({
    queryKey: ["supplier-open-pos", supplierId],
    enabled: !!supplierId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("id, po_number, status, total_landed_cost_bdt, remaining_payment_bdt, created_at")
        .eq("supplier_id", supplierId!)
        .not("status", "in", '("closed","cancelled")')
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  // Payment accounts
  const { data: payAccounts } = useQuery({
    queryKey: ["pay-accounts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("chart_of_accounts")
        .select("id, name, code")
        .in("account_type", ["asset"])
        .eq("is_active", true)
        .order("code");
      return data || [];
    },
  });

  return (
    <Sheet open={!!supplierId} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        {loadingSupplier || !supplier ? (
          <div className="space-y-4 mt-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : (
          <>
            <SheetHeader className="pb-4">
              <div className="flex items-center justify-between">
                <SheetTitle className="text-lg">{supplier.name}</SheetTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => onEdit(supplier)}>
                    <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant={supplier.status === "Inactive" ? "outline" : "default"} className="text-xs">
                  {supplier.status || "Active"}
                </Badge>
                <span>{supplier.country || "—"}</span>
                <span>•</span>
                <span>{supplier.currency || "BDT"}</span>
                {supplier.payment_terms && <><span>•</span><span>{supplier.payment_terms}</span></>}
                {(supplier as any).agents?.name && <><span>•</span><span>Agent: {(supplier as any).agents.name}</span></>}
              </div>
            </SheetHeader>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <KpiCard title="Total Purchase" value={`৳${(financials?.total_purchase_value || 0).toLocaleString()}`} icon={<Package className="w-5 h-5" />} />
              <KpiCard title="Total Paid" value={`৳${(financials?.total_paid || 0).toLocaleString()}`} icon={<CreditCard className="w-5 h-5" />} />
              <KpiCard title="Total Due" value={`৳${(financials?.total_due || 0).toLocaleString()}`} icon={<DollarSign className="w-5 h-5" />}
                className={(financials?.total_due || 0) > 0 ? "border-destructive/30" : ""} />
              <KpiCard title="Open POs" value={String(financials?.open_po_count || 0)} icon={<BookOpen className="w-5 h-5" />} />
            </div>

            {/* Record Payment Button */}
            <Button className="w-full mb-4 gap-2" onClick={() => setPaymentOpen(true)}>
              <DollarSign className="w-4 h-4" /> Record Supplier Payment
            </Button>

            <Tabs defaultValue="payments">
              <TabsList className="w-full">
                <TabsTrigger value="payments" className="flex-1">Payment History</TabsTrigger>
                <TabsTrigger value="pos" className="flex-1">Open POs</TabsTrigger>
                <TabsTrigger value="info" className="flex-1">Contact Info</TabsTrigger>
              </TabsList>

              <TabsContent value="payments" className="mt-3">
                {loadingPayments ? (
                  <Skeleton className="h-24 w-full" />
                ) : !payments?.length ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No payments recorded</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Ref</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Account</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map(p => (
                        <TableRow key={p.id}>
                          <TableCell className="text-xs">{format(new Date(p.payment_date), "dd MMM yyyy")}</TableCell>
                          <TableCell className="text-xs font-mono">{p.payment_number}</TableCell>
                          <TableCell className="text-xs">{p.payment_method}</TableCell>
                          <TableCell className="text-xs">{(p as any).chart_of_accounts?.name || "—"}</TableCell>
                          <TableCell className="text-xs text-right font-medium">৳{p.amount.toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant={p.status === "posted" ? "default" : "secondary"} className="text-xs">{p.status}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              <TabsContent value="pos" className="mt-3">
                {!openPOs?.length ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No open purchase orders</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>PO #</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Remaining</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {openPOs.map(po => (
                        <TableRow key={po.id}>
                          <TableCell className="text-xs font-mono">{po.po_number}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{po.status}</Badge></TableCell>
                          <TableCell className="text-xs text-right">৳{(po.total_landed_cost_bdt || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-xs text-right font-medium">৳{(po.remaining_payment_bdt || 0).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              <TabsContent value="info" className="mt-3 space-y-3">
                <InfoRow label="Contact Person" value={supplier.contact_person} />
                <InfoRow label="Phone" value={supplier.phone} />
                <InfoRow label="Email" value={supplier.email} />
                <InfoRow label="WeChat" value={supplier.wechat_id} />
                <InfoRow label="WhatsApp" value={supplier.whatsapp} />
                <InfoRow label="Address" value={supplier.address} />
                <Separator />
                <InfoRow label="Preferred Payment" value={supplier.preferred_payment} />
                <InfoRow label="Alipay" value={supplier.alipay_id} />
                <InfoRow label="Bank" value={supplier.bank_name ? `${supplier.bank_name} — ${supplier.bank_account_number}` : null} />
                <InfoRow label="SWIFT" value={supplier.swift_code} />
                <InfoRow label="USDT" value={supplier.usdt_wallet ? `${supplier.usdt_wallet} (${supplier.usdt_network})` : null} />
                {supplier.notes && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
                      <p className="text-sm">{supplier.notes}</p>
                    </div>
                  </>
                )}
              </TabsContent>
            </Tabs>

            {/* Payment Modal */}
            <RecordPaymentModal
              open={paymentOpen}
              onOpenChange={setPaymentOpen}
              supplier={supplier}
              accounts={payAccounts || []}
              onSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ["supplier-payments", supplierId] });
                queryClient.invalidateQueries({ queryKey: ["supplier-financials", supplierId] });
              }}
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function RecordPaymentModal({ open, onOpenChange, supplier, accounts, onSuccess }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  supplier: any;
  accounts: any[];
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("bank");
  const [accountId, setAccountId] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast({ title: "Enter valid amount", variant: "destructive" }); return; }
    if (!accountId) { toast({ title: "Select payment account", variant: "destructive" }); return; }

    setSaving(true);
    try {
      // Use the post_supplier_payment RPC which creates journal entry
      const { data: paymentId, error: insertErr } = await supabase
        .from("supplier_payments")
        .insert({
          supplier_id: supplier.id,
          amount: amt,
          payment_method: method,
          paid_from_account_id: accountId,
          reference,
          notes,
          payment_date: new Date().toISOString().slice(0, 10),
          payment_number: `SP-${Date.now().toString(36).toUpperCase()}`,
          status: "draft",
        })
        .select("id")
        .single();
      if (insertErr) throw insertErr;

      // Post to finance via RPC
      const { error: postErr } = await supabase.rpc("post_supplier_payment", {
        p_payment_id: paymentId!.id,
        p_amount: amt,
        p_pay_account_id: accountId,
      });
      if (postErr) throw postErr;

      toast({ title: `৳${amt.toLocaleString()} payment posted to finance` });
      onSuccess();
      onOpenChange(false);
      setAmount(""); setReference(""); setNotes("");
    } catch (err: any) {
      toast({ title: "Payment failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment — {supplier?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input type="number" placeholder="Amount (৳)" value={amount} onChange={e => setAmount(e.target.value)} />
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger><SelectValue placeholder="Payment Method" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="bank">Bank Transfer</SelectItem>
              <SelectItem value="alipay">Alipay</SelectItem>
              <SelectItem value="usdt">USDT</SelectItem>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="bkash">bKash</SelectItem>
            </SelectContent>
          </Select>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger><SelectValue placeholder="Payment Account *" /></SelectTrigger>
            <SelectContent>
              {accounts.map(a => (
                <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input placeholder="Reference / TXN ID" value={reference} onChange={e => setReference(e.target.value)} />
          <Textarea placeholder="Notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          <p className="text-xs text-muted-foreground">
            Posting: Dr Supplier Payable → Cr {accounts.find(a => a.id === accountId)?.name || "Payment Account"}
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Posting..." : "Record & Post"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
