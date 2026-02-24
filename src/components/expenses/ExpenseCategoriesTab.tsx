import { useState } from "react";
import { useExpenseCategories, useAddExpenseCategory, useUpdateExpenseCategory } from "@/hooks/use-expenses";
import { useChartOfAccounts } from "@/hooks/use-accounting";
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
import { Plus, Edit2, FolderOpen } from "lucide-react";

export function ExpenseCategoriesTab() {
  const { data: categories, isLoading } = useExpenseCategories();
  const { data: accounts } = useChartOfAccounts();
  const addCat = useAddExpenseCategory();
  const updateCat = useUpdateExpenseCategory();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", default_gl_account_id: "", is_allocatable: true });

  const expenseAccounts = (accounts || []).filter((a) =>
    ["expense", "cogs"].includes(a.account_type?.toLowerCase() || "")
  );

  const openEdit = (cat: any) => {
    setEditing(cat);
    setForm({
      name: cat.name,
      default_gl_account_id: cat.default_gl_account_id || "",
      is_allocatable: cat.is_allocatable,
    });
  };

  const handleSave = () => {
    if (editing) {
      updateCat.mutate({
        id: editing.id,
        name: form.name,
        default_gl_account_id: form.default_gl_account_id || null,
        is_allocatable: form.is_allocatable,
      });
      setEditing(null);
    } else {
      addCat.mutate({
        name: form.name,
        default_gl_account_id: form.default_gl_account_id || null,
        is_allocatable: form.is_allocatable,
      });
      setShowAdd(false);
    }
    setForm({ name: "", default_gl_account_id: "", is_allocatable: true });
  };

  const isOpen = showAdd || !!editing;

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><FolderOpen className="w-4 h-4" /> Expense Categories</CardTitle>
          <Button size="sm" onClick={() => { setShowAdd(true); setForm({ name: "", default_gl_account_id: "", is_allocatable: true }); }}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Category
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-40 w-full" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Name</TableHead>
                  <TableHead className="text-xs">GL Account</TableHead>
                  <TableHead className="text-xs">Allocatable</TableHead>
                  <TableHead className="text-xs w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(categories || []).map((cat: any) => (
                  <TableRow key={cat.id}>
                    <TableCell className="font-medium text-sm">{cat.name}</TableCell>
                    <TableCell className="text-xs">
                      {cat.chart_of_accounts ? (
                        <Badge variant="outline" className="text-[10px]">{cat.chart_of_accounts.code} — {cat.chart_of_accounts.name}</Badge>
                      ) : (
                        <span className="text-muted-foreground">Not mapped</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={cat.is_allocatable ? "default" : "secondary"} className="text-[10px]">
                        {cat.is_allocatable ? "Yes" : "No"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(cat)}>
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={() => { setShowAdd(false); setEditing(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Category" : "Add Category"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Default GL Account</Label>
              <Select value={form.default_gl_account_id} onValueChange={(v) => setForm({ ...form, default_gl_account_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— None —</SelectItem>
                  {expenseAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_allocatable} onCheckedChange={(v) => setForm({ ...form, is_allocatable: v })} />
              <Label className="text-xs">Allocatable to SKU/Order</Label>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={!form.name.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
