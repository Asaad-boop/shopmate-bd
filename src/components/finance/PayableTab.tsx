import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePayables, useAddPayable } from "@/hooks/use-finance";
import { formatBDT, formatDate } from "@/lib/format";
import { Plus, Trash2 } from "lucide-react";
import { isBefore, parseISO, addDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const mono = { fontFamily: "'DM Mono', monospace" };
const heading = { fontFamily: "'Playfair Display', serif" };

export function PayableTab() {
  const { data: payables } = usePayables();
  const addPayable = useAddPayable();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [payOpen, setPayOpen] = useState<string | null>(null);
  const [form, setForm] = useState({ party_name: "", category: "other", description: "", total_amount: "", due_date: "" });
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");

  const now = new Date();
  const totalPayable = (payables || []).reduce((s, p) => s + Math.max(0, Number(p.total_amount) - Number(p.paid_amount)), 0);
  const overdue = (payables || []).filter(p => p.due_date && isBefore(parseISO(p.due_date), now) && Number(p.total_amount) > Number(p.paid_amount)).reduce((s, p) => s + (Number(p.total_amount) - Number(p.paid_amount)), 0);
  const dueThisWeek = (payables || []).filter(p => p.due_date && !isBefore(parseISO(p.due_date), now) && isBefore(parseISO(p.due_date), addDays(now, 7)) && Number(p.total_amount) > Number(p.paid_amount)).reduce((s, p) => s + (Number(p.total_amount) - Number(p.paid_amount)), 0);

  const getStatus = (p: any) => {
    const remaining = Number(p.total_amount) - Number(p.paid_amount);
    if (remaining <= 0) return { label: "Paid", color: "bg-emerald-100 text-emerald-700" };
    if (p.due_date && isBefore(parseISO(p.due_date), now)) return { label: "Overdue", color: "bg-red-100 text-red-700" };
    if (p.due_date && isBefore(parseISO(p.due_date), addDays(now, 7))) return { label: "Due Soon", color: "bg-amber-100 text-amber-700" };
    return { label: "Upcoming", color: "bg-blue-100 text-blue-700" };
  };

  const handleAdd = () => {
    addPayable.mutate({ party_name: form.party_name, category: form.category, description: form.description, total_amount: Number(form.total_amount), due_date: form.due_date || undefined },
      { onSuccess: () => { setAddOpen(false); setForm({ party_name: "", category: "other", description: "", total_amount: "", due_date: "" }); } });
  };

  const handlePay = async (id: string) => {
    const amt = Number(payAmount);
    if (!amt) return;
    const p = (payables || []).find(p => p.id === id);
    if (!p) return;
    await supabase.from("payables").update({ paid_amount: Number(p.paid_amount) + amt, status: (Number(p.paid_amount) + amt >= Number(p.total_amount)) ? "paid" : p.status }).eq("id", id);
    await supabase.from("transactions").insert({ type: "expense", amount: amt, transaction_date: new Date().toISOString().slice(0, 10), category: "payable_payment", payment_method: payMethod, description: `Payment to ${p.party_name}`, source_module: "payables", source_id: id });
    qc.invalidateQueries({ queryKey: ["finance-payables"] });
    qc.invalidateQueries({ queryKey: ["finance-stats"] });
    toast({ title: "Payment recorded" });
    setPayOpen(null); setPayAmount("");
  };

  const handleDelete = async (id: string) => {
    await supabase.from("payables").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["finance-payables"] });
    toast({ title: "Payable deleted" });
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="bg-card rounded-xl border border-[#e4e6ef] px-4 py-3">
          <p className="text-xs text-muted-foreground">Total Payable</p>
          <p className="text-lg font-bold text-red-600" style={mono}>{formatBDT(totalPayable)}</p>
        </div>
        <div className="bg-card rounded-xl border border-[#e4e6ef] px-4 py-3">
          <p className="text-xs text-muted-foreground">Overdue</p>
          <p className="text-lg font-bold text-red-600" style={mono}>{formatBDT(overdue)}</p>
        </div>
        <div className="bg-card rounded-xl border border-[#e4e6ef] px-4 py-3">
          <p className="text-xs text-muted-foreground">Due This Week</p>
          <p className="text-lg font-bold text-amber-600" style={mono}>{formatBDT(dueThisWeek)}</p>
        </div>
        <div className="ml-auto">
          <Button onClick={() => setAddOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white"><Plus className="w-4 h-4 mr-1" /> Add Payable</Button>
        </div>
      </div>

      {/* Table */}
      <Card className="border-[#e4e6ef]">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#0f172a]">
                <TableHead className="text-white text-xs">Party</TableHead>
                <TableHead className="text-white text-xs">Category</TableHead>
                <TableHead className="text-white text-xs">Description</TableHead>
                <TableHead className="text-white text-xs text-right">Total</TableHead>
                <TableHead className="text-white text-xs text-right">Paid</TableHead>
                <TableHead className="text-white text-xs text-right">Remaining</TableHead>
                <TableHead className="text-white text-xs">Due Date</TableHead>
                <TableHead className="text-white text-xs">Status</TableHead>
                <TableHead className="text-white text-xs w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(payables || []).map(p => {
                const remaining = Math.max(0, Number(p.total_amount) - Number(p.paid_amount));
                const status = getStatus(p);
                return (
                  <TableRow key={p.id} className="hover:bg-[#f4f5f9]">
                    <TableCell className="font-medium text-sm">{p.party_name}</TableCell>
                    <TableCell className="text-xs capitalize">{p.category}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">{p.description || "-"}</TableCell>
                    <TableCell className="text-right text-sm" style={mono}>{formatBDT(Number(p.total_amount))}</TableCell>
                    <TableCell className="text-right text-sm text-emerald-600" style={mono}>{formatBDT(Number(p.paid_amount))}</TableCell>
                    <TableCell className={`text-right text-sm font-semibold ${remaining > 0 ? "text-red-600" : "text-emerald-600"}`} style={mono}>{formatBDT(remaining)}</TableCell>
                    <TableCell className="text-xs" style={mono}>{formatDate(p.due_date)}</TableCell>
                    <TableCell><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.color}`}>{status.label}</span></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {remaining > 0 && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setPayOpen(p.id); setPayAmount(String(remaining)); }}>Pay</Button>}
                        <AlertDialog>
                          <AlertDialogTrigger asChild><button className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Delete payable?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(p.id)} className="bg-red-600">Delete</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {(payables || []).length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No payables</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Payable Modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent><DialogHeader><DialogTitle style={heading}>Add Payable</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Party Name</Label><Input value={form.party_name} onChange={(e) => setForm({ ...form, party_name: e.target.value })} /></div>
            <div><Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["agent", "courier", "supplier", "salary", "rent", "other"].map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
            <div><Label>Total Amount (৳)</Label><Input type="number" value={form.total_amount} onChange={(e) => setForm({ ...form, total_amount: e.target.value })} style={mono} /></div>
            <div><Label>Due Date</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleAdd} disabled={addPayable.isPending}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pay Modal */}
      <Dialog open={!!payOpen} onOpenChange={() => setPayOpen(null)}>
        <DialogContent className="sm:max-w-[350px]"><DialogHeader><DialogTitle style={heading}>Record Payment</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Amount (৳)</Label><Input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} style={mono} className="text-xl h-12" /></div>
            <div><Label>Method</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["bkash", "nagad", "bank", "cash"].map(m => <SelectItem key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => payOpen && handlePay(payOpen)}>Pay Now</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
