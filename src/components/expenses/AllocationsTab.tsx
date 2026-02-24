import { useState } from "react";
import {
  useExpenseAllocations, useAllocationLines, useCreateAllocation,
  usePostAllocation, useReverseAllocation, useExpenseCategories,
  useDeliveredOrderStats,
} from "@/hooks/use-expenses";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { formatBDT, formatDate } from "@/lib/format";
import { Plus, Eye, Send, RotateCcw, Calculator } from "lucide-react";

const METHODS = [
  { value: "per_order", label: "Per Order" },
  { value: "per_delivered_qty", label: "Per Delivered Qty" },
  { value: "revenue_share", label: "Revenue Share" },
  { value: "cogs_share", label: "COGS Share" },
  { value: "manual_split", label: "Manual Split" },
];

export function AllocationsTab() {
  const { data: allocations, isLoading } = useExpenseAllocations();
  const { data: categories } = useExpenseCategories();
  const postAlloc = usePostAllocation();
  const reverseAlloc = useReverseAllocation();
  const createAlloc = useCreateAllocation();

  const [viewId, setViewId] = useState<string | null>(null);
  const { data: viewLines } = useAllocationLines(viewId);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    run_name: "", category_id: "", date_from: "", date_to: "",
    allocation_method: "revenue_share", total_amount: 0,
  });

  const { data: orderStats } = useDeliveredOrderStats(form.date_from, form.date_to);

  const [previewLines, setPreviewLines] = useState<any[]>([]);

  const computePreview = () => {
    if (!orderStats || !form.total_amount) return;
    const lines: any[] = [];
    const skus = orderStats.skus;
    if (skus.length === 0) return;

    if (form.allocation_method === "per_delivered_qty") {
      const totalQty = orderStats.totalQty;
      if (totalQty === 0) return;
      skus.forEach((s) => {
        lines.push({
          target_type: "sku", target_id: s.sku,
          allocated_amount: Math.round((s.qty / totalQty) * form.total_amount * 100) / 100,
          weight_value: s.qty,
          _name: s.name,
        });
      });
    } else if (form.allocation_method === "revenue_share") {
      const totalRev = orderStats.totalRevenue;
      if (totalRev === 0) return;
      skus.forEach((s) => {
        lines.push({
          target_type: "sku", target_id: s.sku,
          allocated_amount: Math.round((s.revenue / totalRev) * form.total_amount * 100) / 100,
          weight_value: s.revenue,
          _name: s.name,
        });
      });
    } else if (form.allocation_method === "cogs_share") {
      const totalCogs = orderStats.totalCogs;
      if (totalCogs === 0) return;
      skus.forEach((s) => {
        lines.push({
          target_type: "sku", target_id: s.sku,
          allocated_amount: Math.round((s.cogs / totalCogs) * form.total_amount * 100) / 100,
          weight_value: s.cogs,
          _name: s.name,
        });
      });
    } else if (form.allocation_method === "per_order") {
      const perOrder = form.total_amount / orderStats.totalOrders;
      // Allocate per-order proportionally by SKU qty
      skus.forEach((s) => {
        lines.push({
          target_type: "sku", target_id: s.sku,
          allocated_amount: Math.round((s.qty / orderStats.totalQty) * form.total_amount * 100) / 100,
          weight_value: s.qty,
          _name: s.name,
        });
      });
    } else {
      // manual_split — start with even split
      const each = Math.round((form.total_amount / skus.length) * 100) / 100;
      skus.forEach((s) => {
        lines.push({ target_type: "sku", target_id: s.sku, allocated_amount: each, weight_value: 0, _name: s.name });
      });
    }

    // Fix rounding
    if (lines.length > 0) {
      const sum = lines.reduce((s, l) => s + l.allocated_amount, 0);
      lines[0].allocated_amount += Math.round((form.total_amount - sum) * 100) / 100;
    }

    setPreviewLines(lines);
  };

  const handleCreate = (postNow: boolean) => {
    createAlloc.mutate({
      run_name: form.run_name,
      category_id: form.category_id,
      date_from: form.date_from,
      date_to: form.date_to,
      allocation_method: form.allocation_method,
      total_amount: form.total_amount,
      lines: previewLines.map(({ _name, ...rest }) => rest),
      status: postNow ? "posted" : "draft",
    });
    setShowCreate(false);
    setPreviewLines([]);
  };

  const statusBadge = (s: string) => {
    if (s === "posted") return <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">Posted</Badge>;
    if (s === "reversed") return <Badge variant="destructive" className="text-[10px]">Reversed</Badge>;
    return <Badge variant="secondary" className="text-[10px]">Draft</Badge>;
  };

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><Calculator className="w-4 h-4" /> Allocation Runs</CardTitle>
          <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="w-3.5 h-3.5 mr-1" /> New Allocation</Button>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-40 w-full" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Run Name</TableHead>
                  <TableHead className="text-xs">Category</TableHead>
                  <TableHead className="text-xs">Period</TableHead>
                  <TableHead className="text-xs">Method</TableHead>
                  <TableHead className="text-xs text-right">Total</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs w-28"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(allocations || []).map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-sm font-medium">{a.run_name}</TableCell>
                    <TableCell className="text-xs">{a.expense_categories?.name}</TableCell>
                    <TableCell className="text-xs">{formatDate(a.date_from)} — {formatDate(a.date_to)}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{a.allocation_method?.replace(/_/g, " ")}</Badge></TableCell>
                    <TableCell className="text-xs text-right font-semibold">{formatBDT(a.total_amount)}</TableCell>
                    <TableCell>{statusBadge(a.status)}</TableCell>
                    <TableCell className="space-x-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setViewId(a.id)}>
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      {a.status === "draft" && (
                        <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => postAlloc.mutate(a.id)}>
                          <Send className="w-3 h-3 mr-0.5" /> Post
                        </Button>
                      )}
                      {a.status === "posted" && (
                        <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 text-destructive" onClick={() => reverseAlloc.mutate(a.id)}>
                          <RotateCcw className="w-3 h-3 mr-0.5" /> Reverse
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {(allocations || []).length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8 text-sm">No allocation runs yet</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* View Lines */}
      <Dialog open={!!viewId} onOpenChange={() => setViewId(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Allocation Lines</DialogTitle></DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Type</TableHead>
                <TableHead className="text-xs">Target</TableHead>
                <TableHead className="text-xs text-right">Weight</TableHead>
                <TableHead className="text-xs text-right">Allocated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(viewLines || []).map((l: any) => (
                <TableRow key={l.id}>
                  <TableCell><Badge variant="outline" className="text-[10px]">{l.target_type}</Badge></TableCell>
                  <TableCell className="text-xs font-mono">{l.target_id}</TableCell>
                  <TableCell className="text-xs text-right">{l.weight_value?.toFixed(2) || "-"}</TableCell>
                  <TableCell className="text-xs text-right font-semibold">{formatBDT(l.allocated_amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      {/* Create Allocation */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Allocation Run</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Run Name</Label>
                <Input value={form.run_name} onChange={(e) => setForm({ ...form, run_name: e.target.value })} placeholder="e.g. Feb Meta Ads" />
              </div>
              <div>
                <Label className="text-xs">Category</Label>
                <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {(categories || []).filter((c: any) => c.is_allocatable).map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Date From</Label>
                <Input type="date" value={form.date_from} onChange={(e) => setForm({ ...form, date_from: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Date To</Label>
                <Input type="date" value={form.date_to} onChange={(e) => setForm({ ...form, date_to: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Total Amount (৳)</Label>
                <Input type="number" value={form.total_amount || ""} onChange={(e) => setForm({ ...form, total_amount: +e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Method</Label>
                <Select value={form.allocation_method} onValueChange={(v) => setForm({ ...form, allocation_method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button onClick={computePreview} disabled={!form.date_from || !form.date_to || !form.total_amount} className="w-full">
                  <Calculator className="w-3.5 h-3.5 mr-1" /> Compute Preview
                </Button>
              </div>
            </div>

            {orderStats && (
              <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded-lg">
                Period: {orderStats.totalOrders} delivered orders, {orderStats.totalQty} units, Revenue {formatBDT(orderStats.totalRevenue)}, COGS {formatBDT(orderStats.totalCogs)}
              </div>
            )}

            {previewLines.length > 0 && (
              <div className="rounded-lg border max-h-60 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">SKU</TableHead>
                      <TableHead className="text-xs">Product</TableHead>
                      <TableHead className="text-xs text-right">Weight</TableHead>
                      <TableHead className="text-xs text-right">Allocated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewLines.map((l, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs font-mono">{l.target_id}</TableCell>
                        <TableCell className="text-xs">{l._name}</TableCell>
                        <TableCell className="text-xs text-right">{l.weight_value?.toFixed(2)}</TableCell>
                        <TableCell className="text-xs text-right font-semibold">{formatBDT(l.allocated_amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="px-3 py-2 bg-muted/30 text-xs font-medium text-right">
                  Total: {formatBDT(previewLines.reduce((s, l) => s + l.allocated_amount, 0))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => handleCreate(false)} disabled={previewLines.length === 0 || createAlloc.isPending}>
              Save Draft
            </Button>
            <Button onClick={() => handleCreate(true)} disabled={previewLines.length === 0 || createAlloc.isPending}>
              <Send className="w-3.5 h-3.5 mr-1" /> Save & Post
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
