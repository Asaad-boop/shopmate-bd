import { useState } from "react";
import { useExpensesV2, useExpenseCategories, useCreateExpense, usePostExpense, useVoidExpense } from "@/hooks/use-expenses";
import { useChartOfAccounts } from "@/hooks/use-accounting";
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
import { formatBDT, formatDate } from "@/lib/format";
import { Plus, CheckCircle, XCircle, FileText, Send } from "lucide-react";

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank" },
  { value: "bkash", label: "bKash" },
  { value: "nagad", label: "Nagad" },
  { value: "other", label: "Other" },
];

export function ExpenseEntryTab() {
  const { data: categories } = useExpenseCategories();
  const { data: accounts } = useChartOfAccounts();
  const [filters, setFilters] = useState({ dateFrom: "", dateTo: "", categoryId: "all", status: "all" });
  const { data, isLoading } = useExpensesV2({ ...filters, page: 0, pageSize: 100 });
  const createExpense = useCreateExpense();
  const postExpense = usePostExpense();
  const voidExpense = useVoidExpense();

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    expense_date: new Date().toISOString().slice(0, 10),
    category_id: "",
    vendor_name: "",
    description: "",
    amount: 0,
    payment_method: "cash",
    paid_from_account_id: "",
    reference_type: "none",
    reference_id: "",
  });

  const cashBankAccounts = (accounts || []).filter((a) =>
    ["asset"].includes(a.account_type?.toLowerCase() || "") && a.is_active
  );

  const handleCreate = () => {
    createExpense.mutate({
      ...form,
      paid_from_account_id: form.paid_from_account_id || null,
    });
    setShowCreate(false);
    setForm({
      expense_date: new Date().toISOString().slice(0, 10),
      category_id: "", vendor_name: "", description: "", amount: 0,
      payment_method: "cash", paid_from_account_id: "", reference_type: "none", reference_id: "",
    });
  };

  const statusBadge = (s: string) => {
    if (s === "posted") return <Badge className="bg-emerald-100 text-emerald-800 text-[10px]"><CheckCircle className="w-3 h-3 mr-0.5" />Posted</Badge>;
    if (s === "void") return <Badge variant="destructive" className="text-[10px]"><XCircle className="w-3 h-3 mr-0.5" />Void</Badge>;
    return <Badge variant="secondary" className="text-[10px]"><FileText className="w-3 h-3 mr-0.5" />Draft</Badge>;
  };

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Expenses</CardTitle>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" /> New Expense
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Input type="date" className="w-36" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} placeholder="From" />
            <Input type="date" className="w-36" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} placeholder="To" />
            <Select value={filters.categoryId} onValueChange={(v) => setFilters({ ...filters, categoryId: v })}>
              <SelectTrigger className="w-44"><SelectValue placeholder="All Categories" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {(categories || []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="posted">Posted</SelectItem>
                <SelectItem value="void">Void</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? <Skeleton className="h-40 w-full" /> : (
            <div className="rounded-lg border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Category</TableHead>
                    <TableHead className="text-xs">Vendor</TableHead>
                    <TableHead className="text-xs">Description</TableHead>
                    <TableHead className="text-xs text-right">Amount</TableHead>
                    <TableHead className="text-xs">Payment</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.data || []).map((exp: any) => (
                    <TableRow key={exp.id}>
                      <TableCell className="text-xs">{formatDate(exp.expense_date)}</TableCell>
                      <TableCell className="text-xs">{exp.expense_categories?.name}</TableCell>
                      <TableCell className="text-xs">{exp.vendor_name || "-"}</TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">{exp.description}</TableCell>
                      <TableCell className="text-xs text-right font-semibold">{formatBDT(exp.amount)}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{exp.payment_method}</Badge></TableCell>
                      <TableCell>{statusBadge(exp.status)}</TableCell>
                      <TableCell className="space-x-1">
                        {exp.status === "draft" && (
                          <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => postExpense.mutate(exp)}>
                            <Send className="w-3 h-3 mr-0.5" /> Post
                          </Button>
                        )}
                        {exp.status === "posted" && (
                          <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 text-destructive" onClick={() => voidExpense.mutate(exp)}>
                            Void
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(data?.data || []).length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8 text-sm">No expenses found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Expense</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Date</Label>
                <Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Category</Label>
                <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {(categories || []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Amount (৳)</Label>
                <Input type="number" value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: +e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Vendor</Label>
                <Input value={form.vendor_name} onChange={(e) => setForm({ ...form, vendor_name: e.target.value })} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="h-16" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Payment Method</Label>
                <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Paid From Account</Label>
                <Select value={form.paid_from_account_id} onValueChange={(v) => setForm({ ...form, paid_from_account_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— None —</SelectItem>
                    {cashBankAccounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Reference Type</Label>
                <Select value={form.reference_type} onValueChange={(v) => setForm({ ...form, reference_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="order">Order</SelectItem>
                    <SelectItem value="campaign">Campaign</SelectItem>
                    <SelectItem value="import">Import</SelectItem>
                    <SelectItem value="payroll">Payroll</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.reference_type !== "none" && (
                <div>
                  <Label className="text-xs">Reference ID</Label>
                  <Input value={form.reference_id} onChange={(e) => setForm({ ...form, reference_id: e.target.value })} />
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={!form.category_id || form.amount <= 0 || createExpense.isPending}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
