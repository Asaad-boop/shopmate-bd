import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBDT, formatDate } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ArrowLeft, BookOpen, Search, Download, CalendarIcon,
  RotateCcw, FileText, ChevronLeft, ChevronRight, Eye,
} from "lucide-react";

/* ─── hooks ─── */
function useAccounts() {
  return useQuery({
    queryKey: ["coa-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("id, code, name, account_type, normal_balance")
        .eq("is_active", true)
        .order("code");
      if (error) throw error;
      return data;
    },
  });
}

function useLedgerLines(params: {
  accountId: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  search: string;
  page: number;
  limit: number;
}) {
  return useQuery({
    queryKey: ["general-ledger", params],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("general_ledger_lines", {
        p_account_id: params.accountId || undefined,
        p_date_from: params.dateFrom || undefined,
        p_date_to: params.dateTo || undefined,
        p_search: params.search || undefined,
        p_offset: params.page * params.limit,
        p_limit: params.limit,
      });
      if (error) throw error;
      return data as any;
    },
    placeholderData: (prev) => prev,
  });
}

function useJournalDetail(journalId: string | null) {
  return useQuery({
    queryKey: ["journal-detail", journalId],
    enabled: !!journalId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("journal_entry_detail", { p_journal_id: journalId! });
      if (error) throw error;
      return data as any;
    },
  });
}

function useReverseJournal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ journalId, reason }: { journalId: string; reason: string }) => {
      const { data, error } = await supabase.rpc("reverse_journal_entry", {
        p_journal_id: journalId,
        p_reason: reason,
      });
      if (error) throw error;

      await supabase.from("audit_logs").insert({
        entity_type: "journal_entry",
        entity_id: journalId,
        action: "reverse_journal",
        reason,
        after_json: { reversal_id: data } as any,
      });

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["general-ledger"] });
      qc.invalidateQueries({ queryKey: ["journal-detail"] });
      toast({ title: "Journal reversed successfully" });
    },
    onError: (err: any) => {
      toast({ title: "Reversal failed", description: err.message, variant: "destructive" });
    },
  });
}

const PAGE_SIZE = 50;

/* ─── main page ─── */
export default function FinanceLedger() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const initialAccount = searchParams.get("account_id");

  const { data: accounts } = useAccounts();
  const [accountId, setAccountId] = useState<string | null>(initialAccount);
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(0);
  const [selectedJournal, setSelectedJournal] = useState<string | null>(null);

  const { data: ledger, isLoading } = useLedgerLines({
    accountId,
    dateFrom: dateFrom ? format(dateFrom, "yyyy-MM-dd") : null,
    dateTo: dateTo ? format(dateTo, "yyyy-MM-dd") : null,
    search,
    page,
    limit: PAGE_SIZE,
  });

  const rows: any[] = ledger?.rows || [];
  const total: number = ledger?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(0);
  };

  const exportCSV = useCallback(() => {
    if (!rows.length) return;
    const headers = ["Date", "Journal", "Reference", "Account", "Description", "Debit", "Credit", "Balance"];
    const csvRows = rows.map((r: any) => [
      r.entry_date,
      r.journal_id,
      r.reference_type + (r.reference_id ? `:${r.reference_id}` : ""),
      `${r.account_code} ${r.account_name}`,
      `"${(r.line_description || r.journal_description || "").replace(/"/g, '""')}"`,
      r.debit || 0,
      r.credit || 0,
      r.running_balance || 0,
    ]);
    const csv = [headers.join(","), ...csvRows.map((r: any) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ledger-${format(new Date(), "yyyyMMdd-HHmm")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [rows]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card sticky top-0 z-20">
        <div className="flex items-center justify-between px-6 h-14 max-w-[1400px] mx-auto">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => nav("/finance")} className="h-8 w-8">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">General Ledger</h1>
                <p className="text-[11px] text-muted-foreground -mt-0.5">Read-only journal line viewer</p>
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={!rows.length} className="gap-1.5 text-xs">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="p-6 max-w-[1400px] mx-auto space-y-4">
        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3 items-end">
              {/* Account */}
              <div className="w-64">
                <Label className="text-xs mb-1 block">Account</Label>
                <Select value={accountId || "all"} onValueChange={(v) => { setAccountId(v === "all" ? null : v); setPage(0); }}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="All accounts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Accounts</SelectItem>
                    {(accounts || []).map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.code} — {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date From */}
              <div>
                <Label className="text-xs mb-1 block">From</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("h-9 w-36 text-xs justify-start", !dateFrom && "text-muted-foreground")}>
                      <CalendarIcon className="w-3.5 h-3.5 mr-1" />
                      {dateFrom ? format(dateFrom, "dd MMM yy") : "Start"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateFrom} onSelect={(d) => { setDateFrom(d); setPage(0); }} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Date To */}
              <div>
                <Label className="text-xs mb-1 block">To</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("h-9 w-36 text-xs justify-start", !dateTo && "text-muted-foreground")}>
                      <CalendarIcon className="w-3.5 h-3.5 mr-1" />
                      {dateTo ? format(dateTo, "dd MMM yy") : "End"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateTo} onSelect={(d) => { setDateTo(d); setPage(0); }} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Search */}
              <div className="flex-1 min-w-[200px]">
                <Label className="text-xs mb-1 block">Search</Label>
                <div className="flex gap-1.5">
                  <Input
                    className="h-9 text-xs"
                    placeholder="Invoice, settlement, expense ref…"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  />
                  <Button size="sm" className="h-9 px-3" onClick={handleSearch}>
                    <Search className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Clear */}
              <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => {
                setAccountId(null); setDateFrom(undefined); setDateTo(undefined);
                setSearch(""); setSearchInput(""); setPage(0);
              }}>
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results info */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{total.toLocaleString()} entries{accountId ? " (filtered)" : ""}</span>
          <span>Page {page + 1} of {Math.max(1, totalPages)}</span>
        </div>

        {/* Ledger Table */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center py-16">
              <BookOpen className="w-10 h-10 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No ledger entries found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[90px]">Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead className="w-[80px]">Ref</TableHead>
                  <TableHead className="text-right w-[100px]">Debit</TableHead>
                  <TableHead className="text-right w-[100px]">Credit</TableHead>
                  <TableHead className="text-right w-[110px]">Balance</TableHead>
                  <TableHead className="w-[80px]">Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r: any, i: number) => (
                  <TableRow key={r.line_id} className="group">
                    <TableCell className="text-xs font-mono">{formatDate(r.entry_date)}</TableCell>
                    <TableCell className="text-sm max-w-[250px] truncate">
                      {r.line_description || r.journal_description}
                    </TableCell>
                    <TableCell className="text-xs">
                      <span className="font-mono text-primary">{r.account_code}</span>{" "}
                      <span className="text-muted-foreground">{r.account_name}</span>
                    </TableCell>
                    <TableCell>
                      {r.reference_type && (
                        <Badge variant="secondary" className="text-[9px]">{r.reference_type}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono">
                      {r.debit > 0 ? <span className="text-success">{formatBDT(r.debit)}</span> : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono">
                      {r.credit > 0 ? <span className="text-destructive">{formatBDT(r.credit)}</span> : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono font-semibold">
                      {formatBDT(r.running_balance)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={r.journal_status === "reversed" ? "destructive" : "default"}
                        className="text-[9px]"
                      >
                        {r.journal_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setSelectedJournal(r.journal_id)}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              {page + 1} / {totalPages}
            </span>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Journal Detail Drawer */}
      {selectedJournal && (
        <JournalDrawer
          journalId={selectedJournal}
          open={!!selectedJournal}
          onClose={() => setSelectedJournal(null)}
        />
      )}
    </div>
  );
}

/* ─── Journal Entry Drawer ─── */
function JournalDrawer({ journalId, open, onClose }: { journalId: string; open: boolean; onClose: () => void }) {
  const { data: journal, isLoading } = useJournalDetail(journalId);
  const reverseJournal = useReverseJournal();
  const [reverseOpen, setReverseOpen] = useState(false);
  const [reason, setReason] = useState("");

  const canReverse = journal?.status === "posted" && !journal?.reversed_by_id;

  const handleReverse = () => {
    if (!reason.trim()) {
      toast({ title: "Reason required", variant: "destructive" });
      return;
    }
    reverseJournal.mutate(
      { journalId, reason },
      {
        onSuccess: () => {
          setReverseOpen(false);
          setReason("");
        },
      }
    );
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent className="sm:max-w-[550px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Journal Entry
            </SheetTitle>
          </SheetHeader>

          {isLoading ? (
            <div className="space-y-3 mt-4">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
            </div>
          ) : !journal ? (
            <p className="text-sm text-muted-foreground mt-4">Journal not found</p>
          ) : (
            <div className="space-y-5 mt-4">
              {/* Header info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground">Date</p>
                  <p className="text-sm font-semibold">{formatDate(journal.entry_date)}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground">Period</p>
                  <p className="text-sm font-semibold">{journal.period_key}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3 col-span-2">
                  <p className="text-[10px] text-muted-foreground">Description</p>
                  <p className="text-sm">{journal.description}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground">Type</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Badge variant="secondary" className="text-[9px]">{journal.reference_type}</Badge>
                    {journal.is_auto && <Badge className="text-[9px] bg-info/10 text-info">Auto</Badge>}
                  </div>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground">Status</p>
                  <Badge variant={journal.status === "reversed" ? "destructive" : "default"} className="text-[10px] mt-0.5">
                    {journal.status}
                  </Badge>
                </div>
              </div>

              {/* Journal Lines */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Journal Lines</h3>
                <div className="rounded-xl border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Account</TableHead>
                        <TableHead className="text-xs">Description</TableHead>
                        <TableHead className="text-xs text-right">Debit</TableHead>
                        <TableHead className="text-xs text-right">Credit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(journal.lines || []).map((l: any) => (
                        <TableRow key={l.id}>
                          <TableCell className="text-xs">
                            <span className="font-mono text-primary">{l.code}</span>{" "}
                            <span className="text-muted-foreground">{l.account_name}</span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{l.description}</TableCell>
                          <TableCell className="text-xs text-right font-mono">
                            {l.debit > 0 ? <span className="text-success font-semibold">{formatBDT(l.debit)}</span> : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-right font-mono">
                            {l.credit > 0 ? <span className="text-destructive font-semibold">{formatBDT(l.credit)}</span> : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Totals */}
                      <TableRow className="bg-muted/30 font-semibold">
                        <TableCell colSpan={2} className="text-xs text-right">Totals</TableCell>
                        <TableCell className="text-xs text-right font-mono text-success">{formatBDT(journal.total_debit)}</TableCell>
                        <TableCell className="text-xs text-right font-mono text-destructive">{formatBDT(journal.total_credit)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Reversal info */}
              {journal.reversal_of_id && (
                <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-xs text-warning">
                  This is a reversal of journal {journal.reversal_of_id.slice(0, 8)}…
                </div>
              )}
              {journal.reversed_by_id && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-xs text-destructive">
                  Reversed by journal {journal.reversed_by_id.slice(0, 8)}…
                </div>
              )}

              {/* Reverse action */}
              {canReverse && (
                <Button
                  variant="destructive"
                  className="w-full gap-1.5"
                  onClick={() => setReverseOpen(true)}
                >
                  <RotateCcw className="w-4 h-4" /> Reverse This Entry
                </Button>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Reverse Dialog */}
      <Dialog open={reverseOpen} onOpenChange={setReverseOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <RotateCcw className="w-5 h-5" /> Reverse Journal Entry
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This will create a new reversal journal with opposite Dr/Cr entries. This action is permanent and will be recorded in the audit log.
            </p>
            <div>
              <Label>Reason (required)</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Explain why this entry needs to be reversed…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReverseOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleReverse}
              disabled={reverseJournal.isPending || !reason.trim()}
            >
              {reverseJournal.isPending ? "Reversing…" : "Confirm Reversal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
