import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useInfluencers, useCreateInfluencer, useInfluencerDeals, useCreateDeal,
  useRecordDealPayment, usePaymentAccounts, useProductsForLinking,
} from "@/hooks/use-marketing";
import { formatBDT, formatDate } from "@/lib/format";
import { ArrowLeft, Plus, Users, DollarSign, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const PLATFORMS = ["facebook", "instagram", "tiktok", "youtube"];
const PAY_METHODS = ["cash", "bank", "bkash", "nagad"];

export default function MarketingInfluencersPage() {
  const nav = useNavigate();
  const { data: influencers, isLoading } = useInfluencers();
  const createInfluencer = useCreateInfluencer();
  const { data: deals, isLoading: dealsLoading } = useInfluencerDeals();
  const createDeal = useCreateDeal();
  const recordPayment = useRecordDealPayment();
  const { data: payAccounts } = usePaymentAccounts();
  const { data: products } = useProductsForLinking();

  const [showAddInfluencer, setShowAddInfluencer] = useState(false);
  const [showAddDeal, setShowAddDeal] = useState(false);
  const [showPayment, setShowPayment] = useState<any>(null);
  const [selectedInfluencer, setSelectedInfluencer] = useState<any>(null);

  // Form states
  const [inf, setInf] = useState({ name: "", platform: "facebook", page_link: "", contact_info: "", niche: "" });
  const [deal, setDeal] = useState({ influencer_id: "", campaign_name: "", start_date: new Date().toISOString().slice(0, 10), end_date: "", total_cost: 0, payment_method: "cash", notes: "", sku_id: "" });
  const [payAmount, setPayAmount] = useState(0);
  const [payAccountId, setPayAccountId] = useState("");

  const handleAddInfluencer = () => {
    createInfluencer.mutate(inf, { onSuccess: () => { setShowAddInfluencer(false); setInf({ name: "", platform: "facebook", page_link: "", contact_info: "", niche: "" }); } });
  };

  const handleAddDeal = () => {
    const skuData = deal.sku_id ? [{ product_id: deal.sku_id, allocation_pct: 100 }] : undefined;
    createDeal.mutate({ ...deal, total_cost: Number(deal.total_cost), sku_ids: skuData }, {
      onSuccess: () => { setShowAddDeal(false); setDeal({ influencer_id: "", campaign_name: "", start_date: new Date().toISOString().slice(0, 10), end_date: "", total_cost: 0, payment_method: "cash", notes: "", sku_id: "" }); },
    });
  };

  const handlePayment = () => {
    if (!showPayment || !payAccountId || payAmount <= 0) return;
    recordPayment.mutate({ deal: showPayment, paymentAmount: payAmount, paymentAccountId: payAccountId }, {
      onSuccess: () => { setShowPayment(null); setPayAmount(0); setPayAccountId(""); },
    });
  };

  const roi = (d: any) => {
    const cost = Number(d.total_cost || 0);
    const rev = Number(d.revenue_generated || 0);
    if (!cost) return null;
    return ((rev - cost) / cost * 100).toFixed(1);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => nav("/marketing")}><ArrowLeft className="w-4 h-4" /></Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="w-6 h-6 text-primary" /> Influencer Management</h1>
          <p className="text-sm text-muted-foreground">Manage partnerships, deals, payments, and SKU allocation.</p>
        </div>
      </div>

      {/* Influencer List */}
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-lg">Influencers</h2>
        <Button size="sm" onClick={() => setShowAddInfluencer(true)}><Plus className="w-4 h-4 mr-1" /> Add Influencer</Button>
      </div>

      {isLoading ? <Skeleton className="h-40 w-full" /> : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Name</TableHead><TableHead>Platform</TableHead><TableHead>Niche</TableHead>
              <TableHead>Contact</TableHead><TableHead>Status</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(influencers || []).map((i: any) => (
                <TableRow key={i.id} className="cursor-pointer" onClick={() => setSelectedInfluencer(i)}>
                  <TableCell className="font-medium">{i.name}</TableCell>
                  <TableCell><Badge variant="secondary" className="capitalize">{i.platform}</Badge></TableCell>
                  <TableCell>{i.niche || "—"}</TableCell>
                  <TableCell className="text-xs">{i.contact_info || "—"}</TableCell>
                  <TableCell><Badge variant={i.status === "active" ? "default" : "secondary"}>{i.status}</Badge></TableCell>
                </TableRow>
              ))}
              {!influencers?.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No influencers yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Deals Section */}
      <div className="flex justify-between items-center pt-4">
        <h2 className="font-semibold text-lg">Deals</h2>
        <Button size="sm" onClick={() => setShowAddDeal(true)} disabled={!influencers?.length}><Plus className="w-4 h-4 mr-1" /> New Deal</Button>
      </div>

      {dealsLoading ? <Skeleton className="h-40 w-full" /> : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Influencer</TableHead><TableHead>Campaign</TableHead><TableHead>Dates</TableHead>
              <TableHead className="text-right">Cost</TableHead><TableHead className="text-right">Paid</TableHead>
              <TableHead>Payment</TableHead><TableHead>SKUs</TableHead><TableHead>ROI</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(deals || []).map((d: any) => {
                const roiVal = roi(d);
                return (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.influencers?.name}</TableCell>
                    <TableCell>{d.campaign_name}</TableCell>
                    <TableCell className="text-xs">{formatDate(d.start_date)}{d.end_date ? ` → ${formatDate(d.end_date)}` : ""}</TableCell>
                    <TableCell className="text-right font-mono">{formatBDT(d.total_cost)}</TableCell>
                    <TableCell className="text-right font-mono">{formatBDT(d.amount_paid)}</TableCell>
                    <TableCell>
                      <Badge variant={d.payment_status === "paid" ? "default" : d.payment_status === "partial" ? "secondary" : "destructive"}>
                        {d.payment_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{d.influencer_deal_skus?.length ? d.influencer_deal_skus.map((s: any) => s.products?.sku || "?").join(", ") : "—"}</TableCell>
                    <TableCell>
                      {roiVal !== null && (
                        <Badge variant={Number(roiVal) > 0 ? "default" : "destructive"} className={Number(roiVal) > 0 ? "bg-green-600" : ""}>
                          {roiVal}%
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {d.payment_status !== "paid" && (
                        <Button size="sm" variant="outline" onClick={() => { setShowPayment(d); setPayAmount(Number(d.total_cost) - Number(d.amount_paid)); }}>
                          <CreditCard className="w-3 h-3 mr-1" /> Pay
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {!deals?.length && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No deals yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add Influencer Dialog */}
      <Dialog open={showAddInfluencer} onOpenChange={setShowAddInfluencer}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Influencer</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name *</Label><Input value={inf.name} onChange={e => setInf({ ...inf, name: e.target.value })} /></div>
            <div><Label>Platform</Label>
              <Select value={inf.platform} onValueChange={v => setInf({ ...inf, platform: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PLATFORMS.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Page Link</Label><Input value={inf.page_link} onChange={e => setInf({ ...inf, page_link: e.target.value })} /></div>
            <div><Label>Contact</Label><Input value={inf.contact_info} onChange={e => setInf({ ...inf, contact_info: e.target.value })} /></div>
            <div><Label>Niche</Label><Input value={inf.niche} onChange={e => setInf({ ...inf, niche: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={handleAddInfluencer} disabled={!inf.name || createInfluencer.isPending}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Deal Dialog */}
      <Dialog open={showAddDeal} onOpenChange={setShowAddDeal}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Influencer Deal</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Influencer *</Label>
              <Select value={deal.influencer_id} onValueChange={v => setDeal({ ...deal, influencer_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{(influencers || []).map((i: any) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Campaign Name *</Label><Input value={deal.campaign_name} onChange={e => setDeal({ ...deal, campaign_name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Start Date</Label><Input type="date" value={deal.start_date} onChange={e => setDeal({ ...deal, start_date: e.target.value })} /></div>
              <div><Label>End Date</Label><Input type="date" value={deal.end_date} onChange={e => setDeal({ ...deal, end_date: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Total Cost (৳)</Label><Input type="number" value={deal.total_cost} onChange={e => setDeal({ ...deal, total_cost: Number(e.target.value) })} /></div>
              <div><Label>Payment Method</Label>
                <Select value={deal.payment_method} onValueChange={v => setDeal({ ...deal, payment_method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PAY_METHODS.map(m => <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Link SKU (optional)</Label>
              <Select value={deal.sku_id} onValueChange={v => setDeal({ ...deal, sku_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>{(products || []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.sku} – {p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Notes</Label><Textarea value={deal.notes} onChange={e => setDeal({ ...deal, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={handleAddDeal} disabled={!deal.influencer_id || !deal.campaign_name || createDeal.isPending}>Create Deal</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={!!showPayment} onOpenChange={() => setShowPayment(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Deal: {showPayment?.campaign_name} – Outstanding: {formatBDT(Number(showPayment?.total_cost || 0) - Number(showPayment?.amount_paid || 0))}</p>
          <div className="space-y-3">
            <div><Label>Payment Amount (৳)</Label><Input type="number" value={payAmount} onChange={e => setPayAmount(Number(e.target.value))} /></div>
            <div><Label>Payment Account *</Label>
              <Select value={payAccountId} onValueChange={setPayAccountId}>
                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>{(payAccounts || []).map((a: any) => <SelectItem key={a.id} value={a.id}>{a.code} – {a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Dr Marketing Expense → Cr {payAccounts?.find((a: any) => a.id === payAccountId)?.name || "Payment Account"}</p>
          <DialogFooter><Button onClick={handlePayment} disabled={!payAccountId || payAmount <= 0 || recordPayment.isPending}>Record & Post to Queue</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Influencer Detail Sheet */}
      <Sheet open={!!selectedInfluencer} onOpenChange={() => setSelectedInfluencer(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selectedInfluencer?.name}</SheetTitle>
            <SheetDescription>Platform: {selectedInfluencer?.platform} | Niche: {selectedInfluencer?.niche || "N/A"}</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-3 text-sm">
            <p><strong>Contact:</strong> {selectedInfluencer?.contact_info || "—"}</p>
            <p><strong>Page:</strong> {selectedInfluencer?.page_link ? <a href={selectedInfluencer.page_link} target="_blank" rel="noreferrer" className="text-primary underline">{selectedInfluencer.page_link}</a> : "—"}</p>
            <p><strong>Status:</strong> <Badge variant={selectedInfluencer?.status === "active" ? "default" : "secondary"}>{selectedInfluencer?.status}</Badge></p>
            <h4 className="font-semibold pt-3">Deals</h4>
            {(deals || []).filter((d: any) => d.influencer_id === selectedInfluencer?.id).map((d: any) => (
              <div key={d.id} className="border rounded-lg p-3 space-y-1">
                <p className="font-medium">{d.campaign_name}</p>
                <p className="text-xs text-muted-foreground">{formatDate(d.start_date)} → {d.end_date ? formatDate(d.end_date) : "Ongoing"}</p>
                <p>Cost: {formatBDT(d.total_cost)} | Paid: {formatBDT(d.amount_paid)}</p>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
