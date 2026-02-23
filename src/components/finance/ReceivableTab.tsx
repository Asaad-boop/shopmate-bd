import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useReceivables, useAddReceivable, useMarkReceived } from "@/hooks/use-finance";
import { formatBDT, formatDate } from "@/lib/format";
import { Plus, CheckCircle } from "lucide-react";
import { isBefore, parseISO } from "date-fns";

const mono = { fontFamily: "'DM Mono', monospace" };
const heading = { fontFamily: "'Playfair Display', serif" };

export function ReceivableTab() {
  const { data: receivables } = useReceivables();
  const addReceivable = useAddReceivable();
  const markReceived = useMarkReceived();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ source: "cod", description: "", amount: "", expected_date: "", reference: "" });

  const now = new Date();
  const pending = (receivables || []).filter(r => r.status !== "received");
  const totalReceivable = pending.reduce((s, r) => s + Number(r.amount), 0);
  const codInTransit = pending.filter(r => r.source === "cod").reduce((s, r) => s + Number(r.amount), 0);
  const overdueCollection = pending.filter(r => r.expected_date && isBefore(parseISO(r.expected_date), now)).reduce((s, r) => s + Number(r.amount), 0);

  const getStatus = (r: any) => {
    if (r.status === "received") return { label: "Received", color: "bg-emerald-100 text-emerald-700" };
    if (r.status === "confirmed") return { label: "Confirmed", color: "bg-blue-100 text-blue-700" };
    if (r.expected_date && isBefore(parseISO(r.expected_date), now)) return { label: "Overdue", color: "bg-red-100 text-red-700" };
    return { label: "Expected", color: "bg-amber-100 text-amber-700" };
  };

  const handleAdd = () => {
    addReceivable.mutate({ source: form.source, description: form.description, amount: Number(form.amount), expected_date: form.expected_date || undefined, reference: form.reference || undefined },
      { onSuccess: () => { setAddOpen(false); setForm({ source: "cod", description: "", amount: "", expected_date: "", reference: "" }); } });
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="bg-card rounded-xl border border-[#e4e6ef] px-4 py-3">
          <p className="text-xs text-muted-foreground">Total Receivable</p>
          <p className="text-lg font-bold text-emerald-600" style={mono}>{formatBDT(totalReceivable)}</p>
        </div>
        <div className="bg-card rounded-xl border border-[#e4e6ef] px-4 py-3">
          <p className="text-xs text-muted-foreground">COD in Transit</p>
          <p className="text-lg font-bold text-blue-600" style={mono}>{formatBDT(codInTransit)}</p>
        </div>
        <div className="bg-card rounded-xl border border-[#e4e6ef] px-4 py-3">
          <p className="text-xs text-muted-foreground">Overdue</p>
          <p className="text-lg font-bold text-red-600" style={mono}>{formatBDT(overdueCollection)}</p>
        </div>
        <div className="ml-auto">
          <Button onClick={() => setAddOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white"><Plus className="w-4 h-4 mr-1" /> Add Receivable</Button>
        </div>
      </div>

      {/* Table */}
      <Card className="border-[#e4e6ef]">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#0f172a]">
                <TableHead className="text-white text-xs">Source</TableHead>
                <TableHead className="text-white text-xs">Description</TableHead>
                <TableHead className="text-white text-xs">Reference</TableHead>
                <TableHead className="text-white text-xs">Expected Date</TableHead>
                <TableHead className="text-white text-xs text-right">Amount</TableHead>
                <TableHead className="text-white text-xs">Status</TableHead>
                <TableHead className="text-white text-xs w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(receivables || []).map(r => {
                const status = getStatus(r);
                return (
                  <TableRow key={r.id} className="hover:bg-[#f4f5f9]">
                    <TableCell className="text-sm font-medium capitalize">{r.source}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{r.description || "-"}</TableCell>
                    <TableCell className="text-xs" style={mono}>{r.reference || "-"}</TableCell>
                    <TableCell className="text-xs" style={mono}>{formatDate(r.expected_date)}</TableCell>
                    <TableCell className="text-right text-sm font-semibold text-emerald-600" style={mono}>{formatBDT(Number(r.amount))}</TableCell>
                    <TableCell><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.color}`}>{status.label}</span></TableCell>
                    <TableCell>
                      {r.status !== "received" && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => markReceived.mutate(r.id)} disabled={markReceived.isPending}>
                          <CheckCircle className="w-3.5 h-3.5 mr-1" /> Received
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {(receivables || []).length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No receivables</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent><DialogHeader><DialogTitle style={heading}>Add Receivable</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Source</Label>
              <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["cod", "advance", "refund_due", "other"].map(s => <SelectItem key={s} value={s}>{s.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
            <div><Label>Amount (৳)</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} style={mono} /></div>
            <div><Label>Expected Date</Label><Input type="date" value={form.expected_date} onChange={(e) => setForm({ ...form, expected_date: e.target.value })} /></div>
            <div><Label>Reference</Label><Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="Order ID / PO #" /></div>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleAdd} disabled={addReceivable.isPending}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
