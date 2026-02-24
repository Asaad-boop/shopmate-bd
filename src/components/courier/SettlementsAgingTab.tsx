import { useState } from "react";
import { useCouriers, useCourierSettlements, useOutstandingShipments, useCreateSettlement, useCourierAging } from "@/hooks/use-courier";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { formatBDT, formatDate } from "@/lib/format";
import { Plus, Banknote, Clock } from "lucide-react";

export function SettlementsAgingTab() {
  const { data: couriers } = useCouriers();
  const { data: settlements, isLoading } = useCourierSettlements();
  const { data: aging, isLoading: agingLoading } = useCourierAging();
  const createSettlement = useCreateSettlement();

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    courier_id: "", settlement_date: new Date().toISOString().slice(0, 10),
    settlement_ref: "", received_account: "bank", amount_received: 0, notes: "",
  });
  const { data: outstanding } = useOutstandingShipments(form.courier_id || undefined);
  const [selected, setSelected] = useState<Record<string, number>>({});

  const toggleSelect = (id: string, remaining: number) => {
    setSelected((prev) => {
      const copy = { ...prev };
      if (copy[id]) delete copy[id];
      else copy[id] = remaining;
      return copy;
    });
  };

  const totalAllocated = Object.values(selected).reduce((s, v) => s + v, 0);

  const handleCreate = () => {
    const allocations = Object.entries(selected).map(([shipment_id, allocated_amount]) => ({ shipment_id, allocated_amount }));
    createSettlement.mutate({ ...form, allocations });
    setShowCreate(false);
    setForm({ courier_id: "", settlement_date: new Date().toISOString().slice(0, 10), settlement_ref: "", received_account: "bank", amount_received: 0, notes: "" });
    setSelected({});
  };

  return (
    <div className="space-y-6">
      {/* Aging Buckets */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Clock className="w-4 h-4" /> Receivable Aging</CardTitle>
        </CardHeader>
        <CardContent>
          {agingLoading ? <Skeleton className="h-24 w-full" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Courier</TableHead>
                  <TableHead className="text-xs text-right">0-7d</TableHead>
                  <TableHead className="text-xs text-right">8-15d</TableHead>
                  <TableHead className="text-xs text-right">16-30d</TableHead>
                  <TableHead className="text-xs text-right">31-60d</TableHead>
                  <TableHead className="text-xs text-right">60+d</TableHead>
                  <TableHead className="text-xs text-right font-bold">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(aging || []).map((row) => (
                  <TableRow key={row.courier}>
                    <TableCell className="text-xs font-medium">{row.courier}</TableCell>
                    <TableCell className="text-xs text-right">{formatBDT(row["0-7"])}</TableCell>
                    <TableCell className="text-xs text-right">{formatBDT(row["8-15"])}</TableCell>
                    <TableCell className="text-xs text-right">{formatBDT(row["16-30"])}</TableCell>
                    <TableCell className="text-xs text-right text-orange-600">{formatBDT(row["31-60"])}</TableCell>
                    <TableCell className="text-xs text-right text-red-600 font-semibold">{formatBDT(row["60+"])}</TableCell>
                    <TableCell className="text-xs text-right font-bold">{formatBDT(row.total)}</TableCell>
                  </TableRow>
                ))}
                {(aging || []).length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6 text-sm">No outstanding receivables</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Settlements List */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><Banknote className="w-4 h-4" /> Settlements</CardTitle>
          <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="w-3.5 h-3.5 mr-1" /> New Settlement</Button>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-24 w-full" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Courier</TableHead>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Ref</TableHead>
                  <TableHead className="text-xs">Account</TableHead>
                  <TableHead className="text-xs text-right">Amount</TableHead>
                  <TableHead className="text-xs">Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(settlements || []).map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-xs">{s.couriers?.name}</TableCell>
                    <TableCell className="text-xs">{formatDate(s.settlement_date)}</TableCell>
                    <TableCell className="text-xs font-mono">{s.settlement_ref || "-"}</TableCell>
                    <TableCell className="text-xs">{s.received_account}</TableCell>
                    <TableCell className="text-xs text-right font-semibold text-primary">{formatBDT(s.amount_received)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">{s.notes || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Settlement Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Record Courier Settlement</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Courier</Label>
                <Select value={form.courier_id} onValueChange={(v) => { setForm({ ...form, courier_id: v }); setSelected({}); }}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {(couriers || []).filter((c) => c.is_active).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Settlement Date</Label>
                <Input type="date" value={form.settlement_date} onChange={(e) => setForm({ ...form, settlement_date: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Reference</Label>
                <Input value={form.settlement_ref} onChange={(e) => setForm({ ...form, settlement_ref: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Received Account</Label>
                <Select value={form.received_account} onValueChange={(v) => setForm({ ...form, received_account: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank">Bank</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Amount Received</Label>
                <Input type="number" value={form.amount_received} onChange={(e) => setForm({ ...form, amount_received: +e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Notes</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="h-10" />
              </div>
            </div>

            {form.courier_id && (
              <div>
                <div className="text-sm font-medium mb-2">Allocate to Outstanding Shipments</div>
                <div className="rounded-lg border max-h-60 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs w-10"></TableHead>
                        <TableHead className="text-xs">Order</TableHead>
                        <TableHead className="text-xs">Tracking</TableHead>
                        <TableHead className="text-xs text-right">Net Payable</TableHead>
                        <TableHead className="text-xs text-right">Remaining</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(outstanding || []).map((s: any) => (
                        <TableRow key={s.id}>
                          <TableCell>
                            <Checkbox checked={!!selected[s.id]} onCheckedChange={() => toggleSelect(s.id, s.remaining)} />
                          </TableCell>
                          <TableCell className="text-xs font-mono">{s.order_id?.slice(0, 8)}</TableCell>
                          <TableCell className="text-xs font-mono">{s.tracking_id || "-"}</TableCell>
                          <TableCell className="text-xs text-right">{formatBDT(s.courier_net_payable)}</TableCell>
                          <TableCell className="text-xs text-right font-semibold">{formatBDT(s.remaining)}</TableCell>
                        </TableRow>
                      ))}
                      {(outstanding || []).length === 0 && (
                        <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4 text-xs">No outstanding shipments</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span>Selected: {Object.keys(selected).length} shipments</span>
                  <span>Allocated: <strong>{formatBDT(totalAllocated)}</strong></span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={!form.courier_id || form.amount_received <= 0 || createSettlement.isPending}>
              <Banknote className="w-3.5 h-3.5 mr-1" /> Create & Post
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
