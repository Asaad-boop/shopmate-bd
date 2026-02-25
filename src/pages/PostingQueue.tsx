import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBDT, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, ClipboardList, RefreshCw, Play, RotateCcw, Eye, AlertTriangle,
  CreditCard, Truck, FileCheck, Receipt, Package, Search, CheckCheck,
  RotateCw, Ban, Calendar, ChevronDown, ArrowUpDown, ExternalLink,
} from "lucide-react";

/* ── types ───────────────────────────────────────── */
interface PostingEvent {
  id: string; event_type: string; reference_type: string; reference_id: string;
  reference_label: string | null; event_date: string; amount: number;
  debit_label: string | null; credit_label: string | null;
  debit_account_id: string | null; credit_account_id: string | null;
  status: string; journal_id: string | null; reversal_journal_id: string | null;
  posted_at: string | null; reversed_at: string | null; reversed_reason: string | null;
  blocked_reason: string | null;
  metadata: any; created_at: string; exception_count: number;
}

interface QueueCounts {
  ADVANCE_RECEIVED: number; ORDER_DELIVERED: number; ORDER_RETURNED: number;
  SETTLEMENT_READY: number; EXPENSE_RECORDED: number; STOCK_ADJUSTMENT: number;
  total_pending: number; total_posted: number; total_reversed: number; total_blocked: number;
}

interface JournalLine {
  account: string; debit: number; credit: number; description: string;
}

const TABS = [
  { id: "all", label: "All", icon: ClipboardList },
  { id: "ADVANCE_RECEIVED", label: "Advances", icon: CreditCard },
  { id: "ORDER_DELIVERED", label: "Delivered", icon: Truck },
  { id: "ORDER_RETURNED", label: "Returns / Exchanges", icon: RotateCw },
  { id: "SETTLEMENT_READY", label: "Settlements", icon: FileCheck },
  { id: "EXPENSE_RECORDED", label: "Expenses", icon: Receipt },
  { id: "STOCK_ADJUSTMENT", label: "Stock Adj.", icon: Package },
];

const STATUS_FILTERS = [
  { id: "pending", label: "Pending" },
  { id: "posted", label: "Posted" },
  { id: "reversed", label: "Reversed" },
  { id: "blocked", label: "Blocked" },
];

const DATE_PRESETS = [
  { label: "Today", from: () => format(new Date(), "yyyy-MM-dd"), to: () => format(new Date(), "yyyy-MM-dd") },
  { label: "Last 7d", from: () => { const d = new Date(); d.setDate(d.getDate() - 7); return format(d, "yyyy-MM-dd"); }, to: () => format(new Date(), "yyyy-MM-dd") },
  { label: "This Month", from: () => { const d = new Date(); return format(new Date(d.getFullYear(), d.getMonth(), 1), "yyyy-MM-dd"); }, to: () => format(new Date(), "yyyy-MM-dd") },
];

/* ── page ────────────────────────────────────────── */
export default function PostingQueuePage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("all");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewEvent, setPreviewEvent] = useState<PostingEvent | null>(null);
  const [reverseTarget, setReverseTarget] = useState<PostingEvent | null>(null);
  const [reverseReason, setReverseReason] = useState("");
  const [bulkProgress, setBulkProgress] = useState<{ total: number; done: number; failed: number } | null>(null);
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
    queryKey: ["posting-events", activeTab, statusFilter, search, page, dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_posting_events", {
        p_event_type: activeTab === "all" ? undefined : activeTab,
        p_status: statusFilter || undefined,
        p_search: search || undefined,
        p_offset: page * PAGE_SIZE,
        p_limit: PAGE_SIZE,
        p_date_from: dateFrom || undefined,
        p_date_to: dateTo || undefined,
      });
      if (error) throw error;
      return data as unknown as { total: number; rows: PostingEvent[] };
    },
    refetchInterval: 30_000,
  });

  // Preview journal lines
  const { data: previewLines, isLoading: previewLoading } = useQuery<{ lines: JournalLine[]; journal_id?: string; metadata?: any }>({
    queryKey: ["preview-event-journal", previewEvent?.id],
    enabled: !!previewEvent,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("preview_event_journal", { p_event_id: previewEvent!.id });
      if (error) throw error;
      return data as unknown as { lines: JournalLine[]; journal_id?: string; metadata?: any };
    },
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

  // Bulk post with progress
  const bulkPost = useCallback(async (ids: string[]) => {
    const batch = ids.slice(0, 200);
    setBulkProgress({ total: batch.length, done: 0, failed: 0 });
    let done = 0, failed = 0;
    for (const id of batch) {
      const { error } = await supabase.rpc("post_event", { p_event_id: id });
      if (error) failed++; else done++;
      setBulkProgress({ total: batch.length, done: done + failed, failed });
    }
    toast.success(`Bulk post complete: ${done} posted, ${failed} failed`);
    setSelected(new Set());
    setBulkProgress(null);
    refresh();
  }, []);

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
  const pendingSelected = events.filter(e => selected.has(e.id) && (e.status === "pending" || e.status === "blocked"));

  const statusBadge = (s: string, reason?: string | null) => {
    if (s === "posted") return <Badge className="bg-success/15 text-success border-success/30 text-[10px]">Posted</Badge>;
    if (s === "reversed") return <Badge variant="destructive" className="text-[10px]">Reversed</Badge>;
    if (s === "blocked") return (
      <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 text-[10px]" title={reason || ""}>
        <Ban className="w-2.5 h-2.5 mr-0.5" />Blocked
      </Badge>
    );
    return <Badge variant="outline" className="text-[10px]">Pending</Badge>;
  };

  const eventTypeLabel = (t: string) => {
    const map: Record<string, string> = {
      ADVANCE_RECEIVED: "Advance",
      ORDER_DELIVERED: "Delivered",
      ORDER_RETURNED: "Return",
      ORDER_EXCHANGED: "Exchange",
      SETTLEMENT_READY: "Settlement",
      EXPENSE_RECORDED: "Expense",
      STOCK_OPENING: "Stock Opening",
      STOCK_ADJUSTMENT: "Stock Adj.",
    };
    return map[t] || t.replace(/_/g, " ");
  };

  const applyDatePreset = (preset: typeof DATE_PRESETS[0]) => {
    setDateFrom(preset.from());
    setDateTo(preset.to());
    setPage(0);
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
              <p className="text-[11px] text-muted-foreground -mt-0.5">Review, preview, and post business events to the ledger</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {pendingSelected.length > 0 && !bulkProgress && (
              <Button size="sm" className="text-xs gap-1.5" onClick={() => bulkPost(pendingSelected.map(e => e.id))}>
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
        {/* Bulk progress */}
        {bulkProgress && (
          <div className="bg-card border border-border rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Bulk Posting…</span>
              <span className="text-muted-foreground">{bulkProgress.done} / {bulkProgress.total}</span>
            </div>
            <Progress value={(bulkProgress.done / bulkProgress.total) * 100} className="h-2" />
            {bulkProgress.failed > 0 && (
              <p className="text-xs text-destructive">{bulkProgress.failed} failed</p>
            )}
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-card border border-border rounded-lg px-4 py-3">
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="text-xl font-bold text-foreground">{counts?.total_pending ?? 0}</p>
          </div>
          <div className="bg-card border border-border rounded-lg px-4 py-3">
            <p className="text-xs text-muted-foreground">Posted</p>
            <p className="text-xl font-bold text-success">{counts?.total_posted ?? 0}</p>
          </div>
          <div className="bg-card border border-border rounded-lg px-4 py-3">
            <p className="text-xs text-muted-foreground">Blocked</p>
            <p className="text-xl font-bold text-amber-600">{counts?.total_blocked ?? 0}</p>
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
            <Input className="pl-9 h-9 text-xs" placeholder="Search by invoice / reference…" value={search}
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
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            <Input type="date" className="h-8 text-xs w-32" value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setPage(0); }} />
            <span className="text-xs text-muted-foreground">–</span>
            <Input type="date" className="h-8 text-xs w-32" value={dateTo}
              onChange={e => { setDateTo(e.target.value); setPage(0); }} />
            {DATE_PRESETS.map(p => (
              <Button key={p.label} size="sm" variant="ghost" className="text-[10px] h-7 px-2"
                onClick={() => applyDatePreset(p)}>
                {p.label}
              </Button>
            ))}
            {(dateFrom || dateTo) && (
              <Button size="sm" variant="ghost" className="text-[10px] h-7 px-2 text-destructive"
                onClick={() => { setDateFrom(""); setDateTo(""); setPage(0); }}>
                Clear
              </Button>
            )}
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
                          <span className="truncate max-w-[180px]">{ev.reference_label || ev.reference_id.slice(0, 8)}</span>
                          {ev.exception_count > 0 && (
                            <Badge variant="destructive" className="text-[9px] h-4 px-1">
                              <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />{ev.exception_count}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px]">
                          {eventTypeLabel(ev.event_type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(ev.event_date)}</TableCell>
                      <TableCell className="text-xs text-right font-mono font-medium">{formatBDT(ev.amount)}</TableCell>
                      <TableCell className="text-[11px]">
                        {ev.debit_label && ev.credit_label ? (
                          <span className="text-muted-foreground">Dr {ev.debit_label} / Cr {ev.credit_label}</span>
                        ) : ev.event_type === "ORDER_DELIVERED" || ev.event_type === "ORDER_RETURNED" ? (
                          <span className="text-muted-foreground italic">Multi-line journal</span>
                        ) : (
                          <span className="text-destructive">Unmapped</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          {statusBadge(ev.status, ev.blocked_reason)}
                          {ev.blocked_reason && (
                            <span className="text-[9px] text-amber-600 truncate max-w-[120px]" title={ev.blocked_reason}>
                              {ev.blocked_reason}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreviewEvent(ev)} title="Preview">
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          {(ev.status === "pending" || ev.status === "blocked") && (
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
                  <p className="text-sm font-medium">{eventTypeLabel(previewEvent.event_type)}</p>
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
                  <div className="mt-0.5">{statusBadge(previewEvent.status, previewEvent.blocked_reason)}</div>
                </div>
              </div>

              {/* Blocked reason */}
              {previewEvent.blocked_reason && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                  <p className="text-xs font-medium text-amber-600 flex items-center gap-1.5">
                    <Ban className="w-3.5 h-3.5" /> Blocked Reason
                  </p>
                  <p className="text-sm mt-1">{previewEvent.blocked_reason}</p>
                </div>
              )}

              {/* Metadata (COGS, shipping etc for ORDER_DELIVERED) */}
              {previewEvent.metadata && Object.keys(previewEvent.metadata).length > 0 && (
                <div className="border border-border rounded-lg p-3">
                  <p className="text-xs font-semibold mb-2">Event Metadata</p>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(previewEvent.metadata).map(([k, v]) => (
                      <div key={k} className="text-xs">
                        <span className="text-muted-foreground">{k.replace(/_/g, " ")}:</span>{" "}
                        <span className="font-mono font-medium">{typeof v === "number" ? formatBDT(v) : String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Journal lines preview */}
              <div className="border border-border rounded-lg">
                <div className="px-4 py-2 bg-muted/50 border-b border-border flex items-center justify-between">
                  <p className="text-xs font-semibold">
                    {previewEvent.status === "posted" ? "Posted Journal Lines" : "Journal Entry Preview"}
                  </p>
                  {previewLines?.journal_id && (
                    <span className="text-[10px] text-muted-foreground font-mono">{previewLines.journal_id.slice(0, 8)}</span>
                  )}
                </div>
                {previewLoading ? (
                  <div className="p-4"><Skeleton className="h-20 w-full" /></div>
                ) : previewLines?.lines && previewLines.lines.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Account</TableHead>
                        <TableHead className="text-xs text-right">Debit</TableHead>
                        <TableHead className="text-xs text-right">Credit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewLines.lines.map((line, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs">
                            <div>
                              <p className="font-medium">{line.account}</p>
                              {line.description && <p className="text-[10px] text-muted-foreground">{line.description}</p>}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-right font-mono">{line.debit > 0 ? formatBDT(line.debit) : "—"}</TableCell>
                          <TableCell className="text-xs text-right font-mono">{line.credit > 0 ? formatBDT(line.credit) : "—"}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/30">
                        <TableCell className="text-xs font-bold">Total</TableCell>
                        <TableCell className="text-xs text-right font-mono font-bold">
                          {formatBDT(previewLines.lines.reduce((s, l) => s + l.debit, 0))}
                        </TableCell>
                        <TableCell className="text-xs text-right font-mono font-bold">
                          {formatBDT(previewLines.lines.reduce((s, l) => s + l.credit, 0))}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                ) : (
                  /* Fallback to simple 2-line from event fields */
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Account</TableHead>
                        <TableHead className="text-xs text-right">Debit</TableHead>
                        <TableHead className="text-xs text-right">Credit</TableHead>
                      </TableRow>
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
                )}
              </div>

              {/* Explanation */}
              <div className="bg-muted/50 border border-border rounded-lg p-3">
                <p className="text-xs font-semibold mb-1">Posting Explanation</p>
                <p className="text-xs text-muted-foreground">
                  {previewEvent.event_type === "ADVANCE_RECEIVED" && "Customer paid an advance. Debit the receiving payment account, credit customer advance liability."}
                  {previewEvent.event_type === "ORDER_DELIVERED" && "Order delivered by courier. Debit courier receivable for the collectable amount, credit product sales and shipping income. Additionally, COGS is debited and inventory credited for the cost of goods."}
                  {previewEvent.event_type === "ORDER_RETURNED" && "Order returned by customer. Reverses the original revenue recognition—debit sales/shipping, credit courier receivable. Restocks inventory by debiting inventory and crediting COGS."}
                  {previewEvent.event_type === "ORDER_EXCHANGED" && "Exchange processed. Stock in/out adjustments applied with corresponding inventory journal."}
                  {previewEvent.event_type === "SETTLEMENT_READY" && "Courier COD settlement received. Debit the receiving bank/wallet account, credit courier receivable to clear the outstanding balance."}
                  {previewEvent.event_type === "EXPENSE_RECORDED" && "Business expense recorded. Debit the expense category account, credit the payment source (cash/bank/wallet)."}
                  {(previewEvent.event_type === "STOCK_OPENING" || previewEvent.event_type === "STOCK_ADJUSTMENT") && "Inventory adjustment. Debit inventory asset, credit opening equity or adjustment account."}
                </p>
              </div>

              {previewEvent.reversed_reason && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                  <p className="text-xs font-medium text-destructive">Reversal Reason</p>
                  <p className="text-sm mt-1">{previewEvent.reversed_reason}</p>
                </div>
              )}

              {previewEvent.posted_at && (
                <p className="text-xs text-muted-foreground">
                  Posted at: {formatDate(previewEvent.posted_at)}
                  {previewEvent.journal_id && <> · Journal: <code className="font-mono">{previewEvent.journal_id.slice(0, 8)}</code></>}
                </p>
              )}

              <div className="flex gap-2 pt-2">
                {(previewEvent.status === "pending" || previewEvent.status === "blocked") && (
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
              This will create a reversal journal for {reverseTarget?.reference_label}. This action is audited and irreversible.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="bg-muted rounded-lg p-3">
              <div className="flex justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Event</p>
                  <p className="text-sm font-medium">{eventTypeLabel(reverseTarget?.event_type || "")}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Amount</p>
                  <p className="text-lg font-bold">{formatBDT(reverseTarget?.amount ?? 0)}</p>
                </div>
              </div>
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
