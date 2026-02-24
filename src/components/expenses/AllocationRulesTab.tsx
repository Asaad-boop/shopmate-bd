import { useState } from "react";
import { useAllocationRules, useAddAllocationRule, useToggleAllocationRule, useExpenseCategories } from "@/hooks/use-expenses";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Settings2 } from "lucide-react";

const METHODS = [
  { value: "per_order", label: "Per Order" },
  { value: "per_delivered_qty", label: "Per Delivered Qty" },
  { value: "revenue_share", label: "Revenue Share" },
  { value: "cogs_share", label: "COGS Share" },
  { value: "sku_fixed_rate", label: "SKU Fixed Rate" },
  { value: "manual_split", label: "Manual Split" },
];

const SCOPES = [
  { value: "date_range", label: "Date Range" },
  { value: "campaign", label: "Campaign" },
  { value: "order", label: "Order" },
  { value: "global", label: "Global" },
];

export function AllocationRulesTab() {
  const { data: rules, isLoading } = useAllocationRules();
  const { data: categories } = useExpenseCategories();
  const addRule = useAddAllocationRule();
  const toggleRule = useToggleAllocationRule();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: "", category_id: "", allocation_method: "revenue_share", scope: "date_range", default_target: "sku",
  });

  const handleSave = () => {
    addRule.mutate(form);
    setShowAdd(false);
    setForm({ name: "", category_id: "", allocation_method: "revenue_share", scope: "date_range", default_target: "sku" });
  };

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><Settings2 className="w-4 h-4" /> Allocation Rules</CardTitle>
          <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="w-3.5 h-3.5 mr-1" /> Add Rule</Button>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-40 w-full" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Name</TableHead>
                  <TableHead className="text-xs">Category</TableHead>
                  <TableHead className="text-xs">Method</TableHead>
                  <TableHead className="text-xs">Scope</TableHead>
                  <TableHead className="text-xs">Target</TableHead>
                  <TableHead className="text-xs w-16">Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(rules || []).map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm font-medium">{r.name}</TableCell>
                    <TableCell className="text-xs">{r.expense_categories?.name}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{r.allocation_method?.replace(/_/g, " ")}</Badge></TableCell>
                    <TableCell><Badge variant="secondary" className="text-[10px]">{r.scope}</Badge></TableCell>
                    <TableCell className="text-xs">{r.default_target}</TableCell>
                    <TableCell>
                      <Switch checked={r.is_active} onCheckedChange={(v) => toggleRule.mutate({ id: r.id, is_active: v })} />
                    </TableCell>
                  </TableRow>
                ))}
                {(rules || []).length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8 text-sm">No rules yet</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Allocation Rule</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Rule Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Meta Ads → Revenue Share" />
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
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Method</Label>
                <Select value={form.allocation_method} onValueChange={(v) => setForm({ ...form, allocation_method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Scope</Label>
                <Select value={form.scope} onValueChange={(v) => setForm({ ...form, scope: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SCOPES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Target</Label>
                <Select value={form.default_target} onValueChange={(v) => setForm({ ...form, default_target: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sku">SKU</SelectItem>
                    <SelectItem value="order">Order</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={!form.name || !form.category_id || addRule.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
