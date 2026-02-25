import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useExternalMarketing, useCreateExternalMarketing, usePaymentAccounts, useProductsForLinking } from "@/hooks/use-marketing";
import { formatBDT, formatDate } from "@/lib/format";
import { ArrowLeft, Plus, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CHANNELS = ["sms", "email", "offline", "agency", "other"];

export default function MarketingExternalPage() {
  const nav = useNavigate();
  const { data: items, isLoading } = useExternalMarketing();
  const createItem = useCreateExternalMarketing();
  const { data: payAccounts } = usePaymentAccounts();
  const { data: products } = useProductsForLinking();

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    channel: "other", spend_date: new Date().toISOString().slice(0, 10),
    amount: 0, payment_method: "cash", product_id: "", campaign_name: "", notes: "", paymentAccountId: "",
  });

  const handleCreate = () => {
    createItem.mutate({
      channel: form.channel, spend_date: form.spend_date, amount: Number(form.amount),
      payment_method: form.payment_method,
      product_id: form.product_id || undefined,
      campaign_name: form.campaign_name || undefined,
      notes: form.notes || undefined,
      paymentAccountId: form.paymentAccountId,
    }, {
      onSuccess: () => {
        setShowAdd(false);
        setForm({ channel: "other", spend_date: new Date().toISOString().slice(0, 10), amount: 0, payment_method: "cash", product_id: "", campaign_name: "", notes: "", paymentAccountId: "" });
      },
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => nav("/marketing")}><ArrowLeft className="w-4 h-4" /></Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Globe className="w-6 h-6 text-primary" /> External Marketing</h1>
          <p className="text-sm text-muted-foreground">SMS, Email, Offline, Agency, and other marketing spend.</p>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-lg">Spend History</h2>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="w-4 h-4 mr-1" /> Record Spend</Button>
      </div>

      {isLoading ? <Skeleton className="h-40 w-full" /> : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Date</TableHead><TableHead>Channel</TableHead><TableHead>Campaign</TableHead>
              <TableHead className="text-right">Amount</TableHead><TableHead>Payment</TableHead>
              <TableHead>SKU</TableHead><TableHead>Notes</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(items || []).map((i: any) => (
                <TableRow key={i.id}>
                  <TableCell>{formatDate(i.spend_date)}</TableCell>
                  <TableCell><Badge variant="secondary" className="capitalize">{i.channel}</Badge></TableCell>
                  <TableCell>{i.campaign_name || "—"}</TableCell>
                  <TableCell className="text-right font-mono">{formatBDT(i.amount)}</TableCell>
                  <TableCell className="capitalize">{i.payment_method}</TableCell>
                  <TableCell className="text-xs">{i.products?.sku || "—"}</TableCell>
                  <TableCell className="text-xs max-w-[200px] truncate">{i.notes || "—"}</TableCell>
                </TableRow>
              ))}
              {!items?.length && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No external marketing spend recorded.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record External Marketing Spend</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Channel *</Label>
                <Select value={form.channel} onValueChange={v => setForm({ ...form, channel: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CHANNELS.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Date</Label><Input type="date" value={form.spend_date} onChange={e => setForm({ ...form, spend_date: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Amount (৳) *</Label><Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} /></div>
              <div><Label>Payment Account *</Label>
                <Select value={form.paymentAccountId} onValueChange={v => setForm({ ...form, paymentAccountId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{(payAccounts || []).map((a: any) => <SelectItem key={a.id} value={a.id}>{a.code} – {a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Campaign (optional)</Label><Input value={form.campaign_name} onChange={e => setForm({ ...form, campaign_name: e.target.value })} /></div>
            <div><Label>Link SKU (optional)</Label>
              <Select value={form.product_id} onValueChange={v => setForm({ ...form, product_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>{(products || []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.sku} – {p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <p className="text-xs text-muted-foreground">Dr Marketing Expense → Cr {payAccounts?.find((a: any) => a.id === form.paymentAccountId)?.name || "Payment Account"}</p>
          <DialogFooter><Button onClick={handleCreate} disabled={!form.paymentAccountId || form.amount <= 0 || createItem.isPending}>Record & Post to Queue</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
