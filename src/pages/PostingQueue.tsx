import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBDT, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft, ClipboardList, RefreshCw, Play, RotateCcw, Eye, AlertTriangle,
  CreditCard, Truck, FileCheck, Receipt, Package, Search, CheckCheck,
} from "lucide-react";

/* ── types ───────────────────────────────────────── */
interface PostingEvent {
  id: string; event_type: string; reference_type: string; reference_id: string;
  reference_label: string | null; event_date: string; amount: number;
  debit_label: string | null; credit_label: string | null;
  debit_account_id: string | null; credit_account_id: string | null;
  status: string; journal_id: string | null; reversal_journal_id: string | null;
  posted_at: string | null; reversed_at: string | null; reversed_reason: string | null;
  metadata: any; created_at: string; exception_count: number;
}

interface QueueCounts {
  ADVANCE_RECEIVED: number; ORDER_DELIVERED: number; SETTLEMENT_READY: number;
  EXPENSE_RECORDED: number; STOCK_ADJUSTMENT: number;
  total_pending: number; total_posted: number; total_reversed: number;
}

const TABS = [
  { id: "all", label: "All", icon: ClipboardList },
  { id: "ADVANCE_RECEIVED", label: "Advances", icon: CreditCard },
  { id: "ORDER_DELIVERED", label: "Delivered", icon: Truck },
  { id: "SETTLEMENT_READY", label: "Settlements", icon: FileCheck },
  { id: "EXPENSE_RECORDED", label: "Expenses", icon: Receipt },
  { id: "STOCK_ADJUSTMENT", label: "Stock Adj.", icon: Package },
];

const STATUS_FILTERS = [
  { id: "pending", label: "Pending" },
  { id: "posted", label: "Posted" },
  { id: "reversed", label: "Reversed" },
];

/* ── page ────────────────────────────────────────── */
export default function PostingQueuePage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("all");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewEvent, setPreviewEvent] = useState<PostingEvent | null>(null);
  const [reverseTarget, setReverseTarget] = useState<PostingEvent | null>(null);
  const [reverseReason, setReverseReason] = useState("");
  const PAGE_SIZE = 50;

  // Counts
  const { data: counts } = useQuery<QueueCounts>({
    queryKey: ["posting-queue-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("posting_queue_counts");
      if (error) throw error;
      return data as unknown as QueueCounts;
    },
    refetchInterval: 30_000,
  });

  // Events list
  const { data: eventsData, isLoading } = useQuery<{ total: number; rows: PostingEvent[] }>({
    queryKey: ["posting-events", activeTab, statusFilter, search, page],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_posting_events", {
        p_event_type: activeTab === "all" ? null : activeTab,
        p_status: statusFilter || null,
        p_search: search || null,
        p_offset: page * PAGE_SIZE,
        p_limit: PAGE_SIZE,
      });
      if (error) throw error;
      return data as unknown as { total: number; rows: PostingEvent[] };
    },
    refetchInterval: 30_000,
  });

  const events = eventsData?.rows || [];
  const totalCount = eventsData?.total || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["posting-events"] });
    qc.invalidateQueries({ queryKey: ["posting-queue-counts"] });
  };

  // Post single
  const postMut = useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase.rpc("post_event", { p_event_id: eventId });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Event posted to journal"); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });

  // Reverse single
  const reverseMut = useMutation({
    mutationFn: async ({ eventId, reason }: { eventId: string; reason: string }) => {
      const { error } = await supabase.rpc("reverse_event", { p_event_id: eventId, p_reason: reason });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Reversal posted"); setReverseTarget(null); setReverseReason(""); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });

  // Bulk post
  const bulkPostMut = useMutation({
    mutationFn: async (ids: string[]) => {
      let posted = 0;
      const batch = ids.slice(0, 200);
      for (const id of batch) {
        const { error } = await supabase.rpc("post_event", { p_event_id: id });
        if (!error) posted++;
      }
      return posted;
    },
    onSuccess: (count) => { toast.success(`${count} events posted`); setSelected(new Set()); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });

  // Selection
  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };
  const toggleAll = () => {
    if (selected.size === events.length) setSelected(new Set());
    else setSelected(new Set(events.map(e => e.id)));
  };
  const pendingSelected = events.filter(e => selected.has(e.id) && e.status === "pending");

  const statusBadge = (s: string) => {
    if (s === "posted") return <Badge className="bg-success/15 text-success border-success/30 text-[10px]">Posted</Badge>;
    if (s === "reversed") return <Badge variant="destructive" className="text-[10px]">Reversed</Badge>;
    return <Badge variant="outline" className="text-[10px]">Pending</Badge>;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card sticky top-0 z-20">
        <div className="flex items-center justify-between px-6 h-14 max-w-[1400px] mx-auto">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => nav("/finance")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-lg font-bold text-foreground">Posting Queue</h1>
              <p className="text-[11px] text-muted-foreground -mt-0.5">Review and post business events to the ledger</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {pendingSelected.length > 0 && (
              <Button size="sm" className="text-xs gap-1.5" onClick={() => bulkPostMut.mutate(pendingSelected.map(e => e.id))} disabled={bulkPostMut.isPending}>
                <CheckCheck className="w-3.5 h-3.5" /> Post Selected ({pendingSelected.length})
              </Button>
            )}
            <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={refresh}>
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-0 px-6 border-t border-border overflow-x-auto scrollbar-none max-w-[1400px] mx-auto">
          {TABS.map((tab) => {
            const count = tab.id === "all" ? (counts?.total_pending ?? 0) : (counts?.[tab.id as keyof QueueCounts] ?? 0);
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setPage(0); setSelected(new Set()); }}
                className={cn(
                  "px-4 py-2.5 text-xs font-medium transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap",
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
                {typeof count === "number" && count > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ml-1">{count}</Badge>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-6 max-w-[1400px] mx-auto space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border border-border rounded-lg px-4 py-3">
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="text-xl font-bold text-foreground">{counts?.total_pending ?? 0}</p>
          </div>
          <div className="bg-card border border-border rounded-lg px-4 py-3">
            <p className="text-xs text-muted-foreground">Posted</p>
            <p className="text-xl font-bold text-success">{counts?.total_posted ?? 0}</p>
          </div>
          <div className="bg-card border border-border rounded-lg px-4 py-3">
            <p className="text-xs text-muted-foreground">Reversed</p>
            <p className="text-xl font-bold text-destructive">{counts?.total_reversed ?? 0}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input className="pl-9 h-9 text-xs" placeholder="Search by reference…" value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }} />
          </div>
          <div className="flex items-center gap-1">
            {STATUS_FILTERS.map(f => (
              <Button key={f.id} size="sm" variant={statusFilter === f.id ? "default" : "outline"}
                className="text-xs h-8" onClick={() => { setStatusFilter(f.id); setPage(0); setSelected(new Set()); }}>
                {f.label}
              </Button>
            ))}
            <Button size="sm" variant={!statusFilter ? "default" : "outline"}
              className="text-xs h-8" onClick={() => { setStatusFilter(""); setPage(0); }}>
              All
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="p-4 space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : events.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No events in queue</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox checked={selected.size === events.length && events.length > 0} onCheckedChange={toggleAll} />
                    </TableHead>
                    <TableHead className="text-xs">Reference</TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs text-right">Amount</TableHead>
                    <TableHead className="text-xs">Impact</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((ev) => (
                    <TableRow key={ev.id} className={cn(selected.has(ev.id) && "bg-primary/5")}>
                      <TableCell>
                        <Checkbox checked={selected.has(ev.id)} onCheckedChange={() => toggleSelect(ev.id)} />
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        <div className="flex items-center gap-1.5">
                          {ev.reference_label || ev.reference_id.slice(0, 8)}
                          {ev.exception_count > 0 && (
                            <Badge variant="destructive" className="text-[9px] h-4 px-1">
                              <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />{ev.exception_count}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px]">
                          {ev.event_type.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(ev.event_date)}</TableCell>
                      <TableCell className="text-xs text-right font-mono font-medium">{formatBDT(ev.amount)}</TableCell>
                      <TableCell className="text-[11px]">
                        {ev.debit_label && ev.credit_label ? (
                          <span className="text-muted-foreground">Dr {ev.debit_label} / Cr {ev.credit_label}</span>
                        ) : (
                          <span className="text-destructive">Unmapped</span>
                        )}
                      </TableCell>
                      <TableCell>{statusBadge(ev.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreviewEvent(ev)} title="Preview">
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          {ev.status === "pending" && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-success hover:text-success"
                              onClick={() => postMut.mutate(ev.id)} disabled={postMut.isPending} title="Post">
                              <Play className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {ev.status === "posted" && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => setReverseTarget(ev)} title="Reverse">
                              <RotateCcw className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount}
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="text-xs h-7" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prev</Button>
                <Button variant="outline" size="sm" className="text-xs h-7" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Preview Drawer ───────────────────────── */}
      <Sheet open={!!previewEvent} onOpenChange={(o) => !o && setPreviewEvent(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Event Preview</SheetTitle>
            <SheetDescription>{previewEvent?.reference_label || previewEvent?.reference_id}</SheetDescription>
          </SheetHeader>
          {previewEvent && (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-[11px] text-muted-foreground">Type</p>
                  <p className="text-sm font-medium">{previewEvent.event_type.replace(/_/g, " ")}</p>
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-[11px] text-muted-foreground">Date</p>
                  <p className="text-sm font-medium">{formatDate(previewEvent.event_date)}</p>
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-[11px] text-muted-foreground">Amount</p>
                  <p className="text-sm font-bold">{formatBDT(previewEvent.amount)}</p>
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-[11px] text-muted-foreground">Status</p>
                  <div className="mt-0.5">{statusBadge(previewEvent.status)}</div>
                </div>
              </div>

              {/* Journal lines preview */}
              <div className="border border-border rounded-lg">
                <div className="px-4 py-2 bg-muted/50 border-b border-border">
                  <p className="text-xs font-semibold">Journal Entry Preview</p>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow><TableHead className="text-xs">Account</TableHead><TableHead className="text-xs text-right">Debit</TableHead><TableHead className="text-xs text-right">Credit</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="text-xs">{previewEvent.debit_label || "Unmapped"}</TableCell>
                      <TableCell className="text-xs text-right font-mono">{formatBDT(previewEvent.amount)}</TableCell>
                      <TableCell className="text-xs text-right font-mono">—</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-xs">{previewEvent.credit_label || "Unmapped"}</TableCell>
                      <TableCell className="text-xs text-right font-mono">—</TableCell>
                      <TableCell className="text-xs text-right font-mono">{formatBDT(previewEvent.amount)}</TableCell>
                    </TableRow>
                    <TableRow className="bg-muted/30">
                      <TableCell className="text-xs font-bold">Total</TableCell>
                      <TableCell className="text-xs text-right font-mono font-bold">{formatBDT(previewEvent.amount)}</TableCell>
                      <TableCell className="text-xs text-right font-mono font-bold">{formatBDT(previewEvent.amount)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {previewEvent.reversed_reason && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                  <p className="text-xs font-medium text-destructive">Reversal Reason</p>
                  <p className="text-sm mt-1">{previewEvent.reversed_reason}</p>
                </div>
              )}

              {previewEvent.journal_id && (
                <p className="text-xs text-muted-foreground">Journal ID: <code className="font-mono">{previewEvent.journal_id.slice(0, 8)}</code></p>
              )}

              <div className="flex gap-2 pt-2">
                {previewEvent.status === "pending" && (
                  <Button className="flex-1" onClick={() => { postMut.mutate(previewEvent.id); setPreviewEvent(null); }}>
                    <Play className="w-3.5 h-3.5 mr-1.5" /> Post to Ledger
                  </Button>
                )}
                {previewEvent.status === "posted" && (
                  <Button variant="destructive" className="flex-1" onClick={() => { setPreviewEvent(null); setReverseTarget(previewEvent); }}>
                    <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Reverse
                  </Button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Reverse Dialog ───────────────────────── */}
      <Dialog open={!!reverseTarget} onOpenChange={(o) => !o && setReverseTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Reverse Posting</DialogTitle>
            <DialogDescription>
              This will create a reversal journal for {reverseTarget?.reference_label}. This action is audited.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="bg-muted rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Amount</p>
              <p className="text-lg font-bold">{formatBDT(reverseTarget?.amount ?? 0)}</p>
            </div>
            <div>
              <Label>Reason for Reversal *</Label>
              <Textarea value={reverseReason} onChange={e => setReverseReason(e.target.value)}
                placeholder="e.g. Duplicate posting, incorrect amount, period correction" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReverseTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={!reverseReason.trim() || reverseMut.isPending}
              onClick={() => reverseTarget && reverseMut.mutate({ eventId: reverseTarget.id, reason: reverseReason })}>
              Confirm Reversal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
