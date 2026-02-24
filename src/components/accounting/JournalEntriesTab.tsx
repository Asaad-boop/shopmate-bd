import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useJournalEntries, useJournalLines, useChartOfAccounts, useCreateJournal, usePostJournal, useReverseJournal } from "@/hooks/use-accounting";
import { formatBDT } from "@/lib/format";
import { Plus, Eye, Check, Undo2, Trash2 } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";

const heading = { fontFamily: "'Playfair Display', serif" };
const mono = { fontFamily: "'DM Mono', monospace" };

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-amber-100 text-amber-800",
  posted: "bg-emerald-100 text-emerald-800",
  reversed: "bg-red-100 text-red-800",
};

const REF_TYPES = ["all", "manual", "order", "courier", "purchase", "expense", "payroll"];

interface LineInput { account_id: string; debit: number; credit: number; description: string; }

export function JournalEntriesTab() {
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [refTypeFilter, setRefTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const { data: result, isLoading } = useJournalEntries({ status: statusFilter, referenceType: refTypeFilter, dateFrom, dateTo, page, pageSize: 20 });
  const [createOpen, setCreateOpen] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const { data: viewLines } = useJournalLines(viewId);
  const { data: accounts } = useChartOfAccounts();
  const createJournal = useCreateJournal();
  const postJournal = usePostJournal();
  const reverseJournal = useReverseJournal();

  const [entryDate, setEntryDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [description, setDescription] = useState("");
  const [refType, setRefType] = useState("manual");
  const [lines, setLines] = useState<LineInput[]>([
    { account_id: "", debit: 0, credit: 0, description: "" },
    { account_id: "", debit: 0, credit: 0, description: "" },
  ]);

  const totalDr = lines.reduce((s, l) => s + l.debit, 0);
  const totalCr = lines.reduce((s, l) => s + l.credit, 0);
  const balanced = Math.abs(totalDr - totalCr) < 0.01 && totalDr > 0;

  const updateLine = (idx: number, field: keyof LineInput, value: any) => {
    const next = [...lines];
    (next[idx] as any)[field] = field === "debit" || field === "credit" ? Number(value) || 0 : value;
    setLines(next);
  };
  const addLine = () => setLines([...lines, { account_id: "", debit: 0, credit: 0, description: "" }]);
  const removeLine = (idx: number) => { if (lines.length > 2) setLines(lines.filter((_, i) => i !== idx)); };

  const resetForm = () => {
    setLines([{ account_id: "", debit: 0, credit: 0, description: "" }, { account_id: "", debit: 0, credit: 0, description: "" }]);
    setDescription("");
    setRefType("manual");
  };

  const handleCreate = (post: boolean) => {
    createJournal.mutate(
      { entry_date: entryDate, description, reference_type: refType, lines: lines.filter(l => l.account_id), post },
      { onSuccess: () => { setCreateOpen(false); resetForm(); } }
    );
  };

  const entries = result?.data || [];
  const totalCount = result?.count || 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-bold" style={heading}>Journal Entries</h3>
        <Button size="sm" onClick={() => setCreateOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="w-4 h-4 mr-1" /> New Entry
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <Label className="text-xs">From</Label>
          <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0); }} className="w-[140px] h-8 text-xs" />
        </div>
        <div>
          <Label className="text-xs">To</Label>
          <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(0); }} className="w-[140px] h-8 text-xs" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="posted">Posted</SelectItem>
            <SelectItem value="reversed">Reversed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={refTypeFilter} onValueChange={(v) => { setRefTypeFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {REF_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t === "all" ? "All Types" : t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="border-border">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left p-3 font-semibold">#</th>
                <th className="text-left p-3 font-semibold">Date</th>
                <th className="text-left p-3 font-semibold">Ref Type</th>
                <th className="text-left p-3 font-semibold">Description</th>
                <th className="text-left p-3 font-semibold">Status</th>
                <th className="text-left p-3 font-semibold">Auto</th>
                <th className="text-right p-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((je: any) => (
                <tr key={je.id} className="border-b border-border hover:bg-muted/30">
                  <td className="p-3 font-mono text-xs" style={mono}>JE-{je.entry_number}</td>
                  <td className="p-3">{je.entry_date}</td>
                  <td className="p-3 text-xs uppercase text-muted-foreground">{je.reference_type || "—"}</td>
                  <td className="p-3 max-w-[300px] truncate">{je.description}</td>
                  <td className="p-3"><Badge variant="secondary" className={STATUS_COLORS[je.status] || ""}>{je.status}</Badge></td>
                  <td className="p-3">{je.is_auto ? "⚙️" : ""}</td>
                  <td className="p-3 text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <Button variant="ghost" size="sm" onClick={() => setViewId(je.id)}><Eye className="w-4 h-4" /></Button>
                      {je.status === "draft" && (
                        <Button variant="ghost" size="sm" onClick={() => postJournal.mutate(je.id)} className="text-emerald-600"><Check className="w-4 h-4" /></Button>
                      )}
                      {je.status === "posted" && !je.reversed_by_id && (
                        <Button variant="ghost" size="sm" onClick={() => reverseJournal.mutate({ id: je.id, reason: "Manual reversal" })} className="text-red-600"><Undo2 className="w-4 h-4" /></Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No journal entries</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {totalCount > 20 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <span className="text-sm text-muted-foreground">Page {page + 1} of {Math.ceil(totalCount / 20)}</span>
          <Button variant="outline" size="sm" disabled={(page + 1) * 20 >= totalCount} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}

      {/* View Lines Dialog */}
      <Dialog open={!!viewId} onOpenChange={() => setViewId(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader><DialogTitle style={heading}>Journal Lines</DialogTitle></DialogHeader>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-2 font-semibold">Account</th>
                <th className="text-right p-2 font-semibold">Debit</th>
                <th className="text-right p-2 font-semibold">Credit</th>
              </tr>
            </thead>
            <tbody>
              {(viewLines || []).map((l: any) => (
                <tr key={l.id} className="border-b border-border">
                  <td className="p-2">{l.chart_of_accounts?.code} — {l.chart_of_accounts?.name}</td>
                  <td className="p-2 text-right font-mono" style={mono}>{l.debit > 0 ? formatBDT(l.debit) : ""}</td>
                  <td className="p-2 text-right font-mono" style={mono}>{l.credit > 0 ? formatBDT(l.credit) : ""}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-bold bg-muted/30">
                <td className="p-2">Total</td>
                <td className="p-2 text-right font-mono" style={mono}>{formatBDT((viewLines || []).reduce((s: number, l: any) => s + Number(l.debit || 0), 0))}</td>
                <td className="p-2 text-right font-mono" style={mono}>{formatBDT((viewLines || []).reduce((s: number, l: any) => s + Number(l.credit || 0), 0))}</td>
              </tr>
            </tfoot>
          </table>
        </DialogContent>
      </Dialog>

      {/* Create Journal Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle style={heading}>New Journal Entry</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Date</Label><Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} /></div>
              <div><Label>Reference Type</Label>
                <Select value={refType} onValueChange={setRefType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="order">Order</SelectItem>
                    <SelectItem value="courier">Courier</SelectItem>
                    <SelectItem value="purchase">Purchase</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="payroll">Payroll</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Description</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Memo" /></div>
            </div>

            <div className="space-y-2">
              <Label>Lines</Label>
              {lines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_100px_100px_30px] gap-2 items-end">
                  <Select value={line.account_id} onValueChange={(v) => updateLine(idx, "account_id", v)}>
                    <SelectTrigger className="text-xs h-9"><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>
                      {(accounts || []).filter(a => a.is_active).map(a =>
                        <SelectItem key={a.id} value={a.id} className="text-xs">{a.code} — {a.name}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <Input type="number" placeholder="Debit" value={line.debit || ""} onChange={(e) => updateLine(idx, "debit", e.target.value)} className="h-9 text-xs" style={mono} />
                  <Input type="number" placeholder="Credit" value={line.credit || ""} onChange={(e) => updateLine(idx, "credit", e.target.value)} className="h-9 text-xs" style={mono} />
                  <Button variant="ghost" size="sm" onClick={() => removeLine(idx)} disabled={lines.length <= 2}><Trash2 className="w-3 h-3" /></Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addLine}>+ Add Line</Button>
            </div>

            <div className={`flex items-center justify-between p-3 rounded-lg ${balanced ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
              <span className="font-mono text-sm" style={mono}>Dr: {formatBDT(totalDr)}</span>
              <span className="font-mono text-sm" style={mono}>Cr: {formatBDT(totalCr)}</span>
              <span className="text-xs font-semibold">{balanced ? "✓ Balanced" : "✗ Imbalanced"}</span>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => handleCreate(false)} disabled={!balanced || createJournal.isPending}>
                Save as Draft
              </Button>
              <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleCreate(true)} disabled={!balanced || createJournal.isPending}>
                Save & Post
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
