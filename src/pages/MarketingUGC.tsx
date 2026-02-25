import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useUGCCreators, useCreateUGCCreator, useUGCOrders, useCreateUGCOrder,
  useRecordUGCPayment, usePaymentAccounts, useProductsForLinking,
} from "@/hooks/use-marketing";
import { formatBDT, formatDate } from "@/lib/format";
import { ArrowLeft, Plus, Video, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CONTENT_TYPES = ["faceless", "product_demo", "reel"];

export default function MarketingUGCPage() {
  const nav = useNavigate();
  const { data: creators, isLoading } = useUGCCreators();
  const createCreator = useCreateUGCCreator();
  const { data: orders, isLoading: ordersLoading } = useUGCOrders();
  const createOrder = useCreateUGCOrder();
  const recordPayment = useRecordUGCPayment();
  const { data: payAccounts } = usePaymentAccounts();
  const { data: products } = useProductsForLinking();

  const [showAddCreator, setShowAddCreator] = useState(false);
  const [showAddOrder, setShowAddOrder] = useState(false);
  const [showPayment, setShowPayment] = useState<any>(null);

  const [cr, setCr] = useState({ name: "", contact: "", content_type: "product_demo", rate_per_video: 0 });
  const [ord, setOrd] = useState({ creator_id: "", product_id: "", campaign_name: "", video_count: 1, total_cost: 0, payment_method: "cash" });
  const [payAmount, setPayAmount] = useState(0);
  const [payAccountId, setPayAccountId] = useState("");

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => nav("/marketing")}><ArrowLeft className="w-4 h-4" /></Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Video className="w-6 h-6 text-primary" /> UGC Creator Management</h1>
          <p className="text-sm text-muted-foreground">Track video orders, delivery, and payments.</p>
        </div>
      </div>

      {/* Creators */}
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-lg">Creators</h2>
        <Button size="sm" onClick={() => setShowAddCreator(true)}><Plus className="w-4 h-4 mr-1" /> Add Creator</Button>
      </div>
      {isLoading ? <Skeleton className="h-32 w-full" /> : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Name</TableHead><TableHead>Content Type</TableHead><TableHead>Rate/Video</TableHead>
              <TableHead>Contact</TableHead><TableHead>Status</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(creators || []).map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell><Badge variant="secondary" className="capitalize">{c.content_type?.replace("_", " ")}</Badge></TableCell>
                  <TableCell className="font-mono">{formatBDT(c.rate_per_video)}</TableCell>
                  <TableCell className="text-xs">{c.contact || "—"}</TableCell>
                  <TableCell><Badge variant={c.status === "active" ? "default" : "secondary"}>{c.status}</Badge></TableCell>
                </TableRow>
              ))}
              {!creators?.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No creators yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Video Orders */}
      <div className="flex justify-between items-center pt-4">
        <h2 className="font-semibold text-lg">Video Orders</h2>
        <Button size="sm" onClick={() => setShowAddOrder(true)} disabled={!creators?.length}><Plus className="w-4 h-4 mr-1" /> New Order</Button>
      </div>
      {ordersLoading ? <Skeleton className="h-32 w-full" /> : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Creator</TableHead><TableHead>Campaign</TableHead><TableHead>Videos</TableHead>
              <TableHead className="text-right">Cost</TableHead><TableHead>Delivery</TableHead>
              <TableHead>Payment</TableHead><TableHead>SKU</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(orders || []).map((o: any) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.ugc_creators?.name}</TableCell>
                  <TableCell>{o.campaign_name || "—"}</TableCell>
                  <TableCell>{o.video_count}</TableCell>
                  <TableCell className="text-right font-mono">{formatBDT(o.total_cost)}</TableCell>
                  <TableCell><Badge variant={o.delivery_status === "delivered" ? "default" : "secondary"}>{o.delivery_status}</Badge></TableCell>
                  <TableCell><Badge variant={o.payment_status === "paid" ? "default" : "destructive"}>{o.payment_status}</Badge></TableCell>
                  <TableCell className="text-xs">{o.products?.sku || "—"}</TableCell>
                  <TableCell>
                    {o.payment_status !== "paid" && (
                      <Button size="sm" variant="outline" onClick={() => { setShowPayment(o); setPayAmount(Number(o.total_cost) - Number(o.amount_paid)); }}>
                        <CreditCard className="w-3 h-3 mr-1" /> Pay
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!orders?.length && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No video orders yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add Creator */}
      <Dialog open={showAddCreator} onOpenChange={setShowAddCreator}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add UGC Creator</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name *</Label><Input value={cr.name} onChange={e => setCr({ ...cr, name: e.target.value })} /></div>
            <div><Label>Content Type</Label>
              <Select value={cr.content_type} onValueChange={v => setCr({ ...cr, content_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CONTENT_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t.replace("_", " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Rate per Video (৳)</Label><Input type="number" value={cr.rate_per_video} onChange={e => setCr({ ...cr, rate_per_video: Number(e.target.value) })} /></div>
            <div><Label>Contact</Label><Input value={cr.contact} onChange={e => setCr({ ...cr, contact: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={() => createCreator.mutate(cr, { onSuccess: () => { setShowAddCreator(false); setCr({ name: "", contact: "", content_type: "product_demo", rate_per_video: 0 }); } })} disabled={!cr.name || createCreator.isPending}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Video Order */}
      <Dialog open={showAddOrder} onOpenChange={setShowAddOrder}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Video Order</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Creator *</Label>
              <Select value={ord.creator_id} onValueChange={v => {
                const found = creators?.find((c: any) => c.id === v);
                setOrd({ ...ord, creator_id: v, total_cost: found ? found.rate_per_video * ord.video_count : ord.total_cost });
              }}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{(creators || []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Videos</Label><Input type="number" value={ord.video_count} onChange={e => {
                const count = Number(e.target.value);
                const found = creators?.find((c: any) => c.id === ord.creator_id);
                setOrd({ ...ord, video_count: count, total_cost: found ? found.rate_per_video * count : ord.total_cost });
              }} /></div>
              <div><Label>Total Cost (৳)</Label><Input type="number" value={ord.total_cost} onChange={e => setOrd({ ...ord, total_cost: Number(e.target.value) })} /></div>
            </div>
            <div><Label>Campaign (optional)</Label><Input value={ord.campaign_name} onChange={e => setOrd({ ...ord, campaign_name: e.target.value })} /></div>
            <div><Label>Link SKU (optional)</Label>
              <Select value={ord.product_id} onValueChange={v => setOrd({ ...ord, product_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>{(products || []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.sku} – {p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={() => createOrder.mutate({ ...ord, video_count: Number(ord.video_count), total_cost: Number(ord.total_cost) }, { onSuccess: () => { setShowAddOrder(false); setOrd({ creator_id: "", product_id: "", campaign_name: "", video_count: 1, total_cost: 0, payment_method: "cash" }); } })} disabled={!ord.creator_id || createOrder.isPending}>Create Order</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={!!showPayment} onOpenChange={() => setShowPayment(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record UGC Payment</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Creator: {showPayment?.ugc_creators?.name} – Outstanding: {formatBDT(Number(showPayment?.total_cost || 0) - Number(showPayment?.amount_paid || 0))}</p>
          <div className="space-y-3">
            <div><Label>Amount (৳)</Label><Input type="number" value={payAmount} onChange={e => setPayAmount(Number(e.target.value))} /></div>
            <div><Label>Payment Account *</Label>
              <Select value={payAccountId} onValueChange={setPayAccountId}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{(payAccounts || []).map((a: any) => <SelectItem key={a.id} value={a.id}>{a.code} – {a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Dr Marketing Expense → Cr {payAccounts?.find((a: any) => a.id === payAccountId)?.name || "Account"}</p>
          <DialogFooter><Button onClick={() => recordPayment.mutate({ order: showPayment, paymentAmount: payAmount, paymentAccountId: payAccountId }, { onSuccess: () => { setShowPayment(null); setPayAmount(0); setPayAccountId(""); } })} disabled={!payAccountId || payAmount <= 0 || recordPayment.isPending}>Record & Post to Queue</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
