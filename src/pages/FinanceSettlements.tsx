import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBDT, formatBDT2, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import * as XLSX from "xlsx";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  ArrowLeft, Upload, FileCheck, RefreshCw, Play, AlertTriangle,
  Check, X, Minus, Eye, ChevronRight, Search, CheckCheck,
} from "lucide-react";

/* ── types ─────────────────────────────────── */
interface Batch {
  id: string; courier_id: string; courier_name: string; batch_ref: string | null;
  statement_date: string; file_name: string | null; total_rows: number;
  matched_count: number; unmatched_count: number; mismatch_count: number;
  posted_count: number; total_amount: number; status: string; created_at: string;
}

interface BatchLine {
  id: string; batch_id: string; row_index: number; tracking_id: string | null;
  invoice_id: string | null; courier_order_id: string | null;
  statement_amount: number; courier_delivery_fee: number; courier_cod_fee: number;
  courier_discount: number; courier_additional: number; courier_total_cost: number;
  net_payable_statement: number; order_id: string | null;
  matched_customer_total: number | null; matched_courier_cost: number | null;
  matched_net_payable: number | null; match_status: string;
  mismatch_reason: string | null; mismatch_amount: number | null;
  posted: boolean; journal_id: string | null; posted_at: string | null;
}

interface Courier { id: string; name: string; }
interface AccountOption { id: string; code: string; name: string; }

/* ── hooks ─────────────────────────────────── */
function useBatches() {
  return useQuery<Batch[]>({
    queryKey: ["settlement-batches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("settlement_batches")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as Batch[];
    },
  });
}

function useBatchLines(batchId: string | null) {
  return useQuery<BatchLine[]>({
    queryKey: ["settlement-batch-lines", batchId],
    queryFn: async () => {
      if (!batchId) return [];
      const { data, error } = await supabase
        .from("settlement_batch_lines")
        .select("*")
        .eq("batch_id", batchId)
        .order("row_index");
      if (error) throw error;
      return (data || []) as BatchLine[];
    },
    enabled: !!batchId,
  });
}

function useCouriers() {
  return useQuery<Courier[]>({
    queryKey: ["couriers-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("couriers").select("id, name").eq("is_active", true).order("name");
      if (error) throw error;
      return (data || []) as Courier[];
    },
  });
}

function useReceivingAccounts() {
  return useQuery<AccountOption[]>({
    queryKey: ["receiving-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("id, code, name")
        .in("code", ["1100", "1101", "1102", "1103"])
        .eq("is_active", true)
        .order("code");
      if (error) throw error;
      return (data || []) as AccountOption[];
    },
  });
}

/* ── page ──────────────────────────────────── */
export default function FinanceSettlementsPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: batches, isLoading: batchesLoading } = useBatches();
  const { data: couriers } = useCouriers();
  const { data: accounts } = useReceivingAccounts();

  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const { data: lines, isLoading: linesLoading } = useBatchLines(selectedBatchId);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [postOpen, setPostOpen] = useState(false);
  const [lineFilter, setLineFilter] = useState<string>("all");
  const [lineSearch, setLineSearch] = useState("");
  const [selectedLines, setSelectedLines] = useState<Set<string>>(new Set());
  const [receivingAccountId, setReceivingAccountId] = useState("");

  // Upload form
  const [uploadCourier, setUploadCourier] = useState("");
  const [uploadDate, setUploadDate] = useState(new Date().toISOString().split("T")[0]);
  const [uploadRef, setUploadRef] = useState("");
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [fileName, setFileName] = useState("");

  const selectedBatch = batches?.find(b => b.id === selectedBatchId);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["settlement-batches"] });
    if (selectedBatchId) qc.invalidateQueries({ queryKey: ["settlement-batch-lines", selectedBatchId] });
  };

  /* ── file parse ──────────────────────────── */
  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });
        setParsedRows(json);
        toast.success(`Parsed ${json.length} rows from ${file.name}`);
      } catch {
        toast.error("Failed to parse file. Ensure it's a valid CSV/XLS/XLSX.");
      }
    };
    reader.readAsBinaryString(file);
  }, []);

  /* ── create batch mutation ───────────────── */
  const createBatchMut = useMutation({
    mutationFn: async () => {
      if (!uploadCourier || parsedRows.length === 0) throw new Error("Select courier and upload file");

      const courier = couriers?.find(c => c.id === uploadCourier);

      // Insert batch
      const { data: batch, error: bErr } = await supabase.from("settlement_batches").insert({
        courier_id: uploadCourier,
        courier_name: courier?.name || "Unknown",
        batch_ref: uploadRef || null,
        statement_date: uploadDate,
        file_name: fileName,
        total_rows: parsedRows.length,
        total_amount: parsedRows.reduce((s, r) => s + (parseFloat(r.net_payable || r.amount || r.total || r.payout || 0) || 0), 0),
      }).select("id").single();
      if (bErr) throw bErr;

      // Insert lines - map common column names
      const lineInserts = parsedRows.map((row, idx) => ({
        batch_id: batch.id,
        row_index: idx + 1,
        tracking_id: (row.tracking_id || row.consignment_id || row.tracking || row.awb || "").toString().trim() || null,
        invoice_id: (row.invoice_id || row.invoice || row.order_ref || "").toString().trim() || null,
        courier_order_id: (row.courier_order_id || row.order_id || "").toString().trim() || null,
        statement_amount: parseFloat(row.total_amount || row.amount || row.collectable || 0) || 0,
        courier_delivery_fee: parseFloat(row.delivery_fee || row.delivery_charge || 0) || 0,
        courier_cod_fee: parseFloat(row.cod_fee || row.cod_charge || 0) || 0,
        courier_discount: parseFloat(row.discount || 0) || 0,
        courier_additional: parseFloat(row.additional_charge || row.additional || 0) || 0,
        courier_total_cost: parseFloat(row.total_cost || row.courier_cost || 0) || 0,
        net_payable_statement: parseFloat(row.net_payable || row.payout || row.receivable || 0) || 0,
      }));

      // Insert in chunks of 200
      for (let i = 0; i < lineInserts.length; i += 200) {
        const chunk = lineInserts.slice(i, i + 200);
        const { error: lErr } = await supabase.from("settlement_batch_lines").insert(chunk);
        if (lErr) throw lErr;
      }

      return batch.id;
    },
    onSuccess: (batchId) => {
      toast.success("Batch created, starting auto-match…");
      setUploadOpen(false);
      setParsedRows([]);
      setFileName("");
      setUploadRef("");
      refresh();
      // Auto-match
      matchMut.mutate(batchId);
    },
    onError: (e: any) => toast.error(e.message),
  });

  /* ── auto-match mutation ─────────────────── */
  const matchMut = useMutation({
    mutationFn: async (batchId: string) => {
      const { data, error } = await supabase.rpc("settlement_auto_match", { p_batch_id: batchId });
      if (error) throw error;
      return data as unknown as { matched: number; unmatched: number; mismatch: number };
    },
    onSuccess: (result) => {
      toast.success(`Matched: ${result.matched}, Unmatched: ${result.unmatched}, Mismatch: ${result.mismatch}`);
      refresh();
    },
    onError: (e: any) => toast.error(e.message),
  });

  /* ── post single line ────────────────────── */
  const postLineMut = useMutation({
    mutationFn: async (lineId: string) => {
      if (!receivingAccountId) throw new Error("Select receiving account first");
      const { error } = await supabase.rpc("post_settlement_line", {
        p_line_id: lineId, p_receiving_account_id: receivingAccountId,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Settlement posted"); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });

  /* ── bulk post ───────────────────────────── */
  const bulkPostMut = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!receivingAccountId) throw new Error("Select receiving account first");
      let posted = 0;
      const batch = ids.slice(0, 200);
      for (const id of batch) {
        const { error } = await supabase.rpc("post_settlement_line", {
          p_line_id: id, p_receiving_account_id: receivingAccountId,
        });
        if (!error) posted++;
      }
      return posted;
    },
    onSuccess: (count) => { toast.success(`${count} lines posted`); setSelectedLines(new Set()); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });

  // Filter lines
  const filteredLines = (lines || []).filter(l => {
    if (lineFilter !== "all" && l.match_status !== lineFilter) return false;
    if (lineSearch) {
      const q = lineSearch.toLowerCase();
      return (l.tracking_id || "").toLowerCase().includes(q) ||
             (l.invoice_id || "").toLowerCase().includes(q);
    }
    return true;
  });

  const postableSelected = filteredLines.filter(l => selectedLines.has(l.id) && !l.posted && l.match_status !== "unmatched");

  const toggleLine = (id: string) => {
    const n = new Set(selectedLines);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelectedLines(n);
  };

  const matchBadge = (s: string) => {
    if (s === "matched") return <Badge className="bg-success/15 text-success border-success/30 text-[10px]"><Check className="w-2.5 h-2.5 mr-0.5" />Matched</Badge>;
    if (s === "mismatch") return <Badge variant="outline" className="text-warning border-warning/30 text-[10px]"><AlertTriangle className="w-2.5 h-2.5 mr-0.5" />Mismatch</Badge>;
    if (s === "unmatched") return <Badge variant="destructive" className="text-[10px]"><X className="w-2.5 h-2.5 mr-0.5" />Unmatched</Badge>;
    return <Badge variant="secondary" className="text-[10px]"><Minus className="w-2.5 h-2.5 mr-0.5" />Pending</Badge>;
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
              <h1 className="text-lg font-bold text-foreground">Courier Settlements</h1>
              <p className="text-[11px] text-muted-foreground -mt-0.5">Upload, match, and post courier statement batches</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" className="text-xs gap-1.5" onClick={() => setUploadOpen(true)}>
              <Upload className="w-3.5 h-3.5" /> Upload Statement
            </Button>
            <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={refresh}>
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-[1400px] mx-auto">
        {!selectedBatchId ? (
          /* ── BATCH LIST ──────────────────────── */
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Settlement Batches</h2>
            {batchesLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
            ) : !batches?.length ? (
              <div className="bg-card border border-dashed border-border rounded-xl p-16 text-center">
                <FileCheck className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
                <p className="text-sm text-muted-foreground">No settlement batches yet. Upload a courier statement to begin.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {batches.map(b => {
                  const matchPct = b.total_rows > 0 ? Math.round((b.matched_count / b.total_rows) * 100) : 0;
                  const postPct = b.total_rows > 0 ? Math.round((b.posted_count / b.total_rows) * 100) : 0;
                  return (
                    <button key={b.id} onClick={() => { setSelectedBatchId(b.id); setSelectedLines(new Set()); }}
                      className="w-full bg-card border border-border rounded-xl p-4 text-left hover:shadow-md hover:border-primary/30 transition-all group">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10 text-primary">
                            <FileCheck className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{b.courier_name} — {formatDate(b.statement_date)}</p>
                            <p className="text-[11px] text-muted-foreground">{b.file_name || b.batch_ref || "No ref"} · {b.total_rows} rows · {formatBDT(b.total_amount)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-success">{b.matched_count} matched</span>
                              {b.mismatch_count > 0 && <span className="text-warning">{b.mismatch_count} mismatch</span>}
                              {b.unmatched_count > 0 && <span className="text-destructive">{b.unmatched_count} unmatched</span>}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              {/* Progress bars */}
                              <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-success rounded-full" style={{ width: `${matchPct}%` }} />
                              </div>
                              <span className="text-[10px] text-muted-foreground">{matchPct}% matched</span>
                              <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-primary rounded-full" style={{ width: `${postPct}%` }} />
                              </div>
                              <span className="text-[10px] text-muted-foreground">{postPct}% posted</span>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* ── BATCH DETAIL ────────────────────── */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" className="h-8" onClick={() => { setSelectedBatchId(null); setSelectedLines(new Set()); }}>
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
                </Button>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">{selectedBatch?.courier_name} — {formatDate(selectedBatch?.statement_date)}</h2>
                  <p className="text-[11px] text-muted-foreground">{selectedBatch?.file_name} · {selectedBatch?.total_rows} rows</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedBatch?.status === "draft" && (
                  <Button size="sm" className="text-xs gap-1.5" onClick={() => matchMut.mutate(selectedBatchId!)} disabled={matchMut.isPending}>
                    <FileCheck className="w-3.5 h-3.5" /> Run Auto-Match
                  </Button>
                )}
                <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => { if (postableSelected.length > 0) setPostOpen(true); else toast.error("Select matched lines first"); }}>
                  <CheckCheck className="w-3.5 h-3.5" /> Post Selected ({postableSelected.length})
                </Button>
              </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {[
                { label: "Total", value: selectedBatch?.total_rows ?? 0, accent: "" },
                { label: "Matched", value: selectedBatch?.matched_count ?? 0, accent: "text-success" },
                { label: "Mismatch", value: selectedBatch?.mismatch_count ?? 0, accent: "text-warning" },
                { label: "Unmatched", value: selectedBatch?.unmatched_count ?? 0, accent: "text-destructive" },
                { label: "Posted", value: selectedBatch?.posted_count ?? 0, accent: "text-primary" },
              ].map(c => (
                <div key={c.label} className="bg-card border border-border rounded-lg px-3 py-2">
                  <p className="text-[11px] text-muted-foreground">{c.label}</p>
                  <p className={cn("text-lg font-bold", c.accent)}>{c.value}</p>
                </div>
              ))}
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input className="pl-9 h-8 text-xs" placeholder="Search tracking/invoice…" value={lineSearch}
                  onChange={e => setLineSearch(e.target.value)} />
              </div>
              {["all", "matched", "mismatch", "unmatched", "pending"].map(f => (
                <Button key={f} size="sm" variant={lineFilter === f ? "default" : "outline"} className="text-xs h-7 capitalize"
                  onClick={() => setLineFilter(f)}>{f}</Button>
              ))}
              {/* Receiving account selector */}
              <div className="ml-auto flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap">Receiving Account:</Label>
                <Select value={receivingAccountId} onValueChange={setReceivingAccountId}>
                  <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {accounts?.map(a => <SelectItem key={a.id} value={a.id}>{a.name} ({a.code})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Lines table */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              {linesLoading ? (
                <div className="p-4 space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox checked={selectedLines.size === filteredLines.length && filteredLines.length > 0}
                            onCheckedChange={() => {
                              if (selectedLines.size === filteredLines.length) setSelectedLines(new Set());
                              else setSelectedLines(new Set(filteredLines.map(l => l.id)));
                            }} />
                        </TableHead>
                        <TableHead className="text-xs">#</TableHead>
                        <TableHead className="text-xs">Tracking</TableHead>
                        <TableHead className="text-xs">Invoice</TableHead>
                        <TableHead className="text-xs text-right">Statement Amt</TableHead>
                        <TableHead className="text-xs text-right">Courier Cost</TableHead>
                        <TableHead className="text-xs text-right">Net Payable (Stmt)</TableHead>
                        <TableHead className="text-xs text-right">Net Payable (Sys)</TableHead>
                        <TableHead className="text-xs">Match</TableHead>
                        <TableHead className="text-xs">Posted</TableHead>
                        <TableHead className="text-xs text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLines.map(l => (
                        <TableRow key={l.id} className={cn(
                          selectedLines.has(l.id) && "bg-primary/5",
                          l.posted && "opacity-60",
                        )}>
                          <TableCell><Checkbox checked={selectedLines.has(l.id)} onCheckedChange={() => toggleLine(l.id)} /></TableCell>
                          <TableCell className="text-xs text-muted-foreground">{l.row_index}</TableCell>
                          <TableCell className="text-xs font-mono">{l.tracking_id || "—"}</TableCell>
                          <TableCell className="text-xs font-mono">{l.invoice_id || "—"}</TableCell>
                          <TableCell className="text-xs text-right font-mono">{formatBDT2(l.statement_amount)}</TableCell>
                          <TableCell className="text-xs text-right font-mono">{formatBDT2(l.courier_total_cost)}</TableCell>
                          <TableCell className="text-xs text-right font-mono">{formatBDT2(l.net_payable_statement)}</TableCell>
                          <TableCell className="text-xs text-right font-mono">
                            {l.matched_net_payable != null ? formatBDT2(l.matched_net_payable) : "—"}
                          </TableCell>
                          <TableCell>{matchBadge(l.match_status)}</TableCell>
                          <TableCell>
                            {l.posted ? (
                              <Badge className="bg-success/15 text-success border-success/30 text-[10px]">Posted</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px]">Pending</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {!l.posted && l.match_status !== "unmatched" && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-success hover:text-success"
                                onClick={() => {
                                  if (!receivingAccountId) { toast.error("Select receiving account first"); return; }
                                  postLineMut.mutate(l.id);
                                }} disabled={postLineMut.isPending} title="Post">
                                <Play className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredLines.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={11} className="text-center py-8 text-muted-foreground text-sm">
                            No lines matching filter
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Upload Dialog ──────────────────────── */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Courier Statement</DialogTitle>
            <DialogDescription>Upload a CSV/XLS file with courier settlement data. Columns should include tracking_id, amount, delivery_fee, cod_fee, net_payable.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Courier *</Label>
              <Select value={uploadCourier} onValueChange={setUploadCourier}>
                <SelectTrigger><SelectValue placeholder="Select courier" /></SelectTrigger>
                <SelectContent>
                  {couriers?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Statement Date</Label>
              <Input type="date" value={uploadDate} onChange={e => setUploadDate(e.target.value)} />
            </div>
            <div>
              <Label>Reference (optional)</Label>
              <Input value={uploadRef} onChange={e => setUploadRef(e.target.value)} placeholder="e.g. Pathao Week 23" />
            </div>
            <div>
              <Label>Statement File (CSV/XLS/XLSX) *</Label>
              <Input type="file" accept=".csv,.xls,.xlsx" onChange={handleFile} />
              {parsedRows.length > 0 && (
                <p className="text-xs text-success mt-1">✓ {parsedRows.length} rows parsed from {fileName}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
            <Button onClick={() => createBatchMut.mutate()} disabled={!uploadCourier || parsedRows.length === 0 || createBatchMut.isPending}>
              Create Batch & Match
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Bulk Post Confirmation ─────────────── */}
      <Dialog open={postOpen} onOpenChange={setPostOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Post {postableSelected.length} Settlement Lines</DialogTitle>
            <DialogDescription>
              Each line will create a 3-line journal entry (Dr Receiving Account, Dr Courier Expense, Cr Courier Receivable) and mark orders as settlement_posted.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="bg-muted rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Total Net Payable</p>
              <p className="text-lg font-bold">{formatBDT(postableSelected.reduce((s, l) => s + (l.matched_net_payable ?? l.net_payable_statement), 0))}</p>
            </div>
            <div>
              <Label>Receiving Account *</Label>
              <Select value={receivingAccountId} onValueChange={setReceivingAccountId}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {accounts?.map(a => <SelectItem key={a.id} value={a.id}>{a.name} ({a.code})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPostOpen(false)}>Cancel</Button>
            <Button onClick={() => { setPostOpen(false); bulkPostMut.mutate(postableSelected.map(l => l.id)); }}
              disabled={!receivingAccountId || bulkPostMut.isPending}>
              Confirm & Post
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
