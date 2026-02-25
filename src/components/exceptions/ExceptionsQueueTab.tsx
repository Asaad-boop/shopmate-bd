import { useState } from "react";
import { useExceptions, useUpdateException, useExceptionEvents, EXCEPTION_FIX_ROUTES, type Exception } from "@/hooks/use-exceptions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { AlertTriangle, CheckCircle, Clock, Eye, ExternalLink, XCircle, ArrowRight, Wrench } from "lucide-react";
import { useNavigate } from "react-router-dom";

const SEVERITY_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  critical: { label: "Critical", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300", icon: XCircle },
  high: { label: "High", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300", icon: AlertTriangle },
  medium: { label: "Medium", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300", icon: Clock },
  low: { label: "Low", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300", icon: Eye },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  open: { label: "Open", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  in_progress: { label: "In Progress", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  resolved: { label: "Resolved", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
  ignored: { label: "Ignored", color: "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300" },
};

const MODULE_LABELS: Record<string, string> = {
  orders: "Orders", inventory: "Inventory", courier: "Courier", accounting: "Accounting",
  expenses: "Expenses", purchasing: "Purchasing", import: "Import", hrm: "HRM",
};

const EXCEPTION_CODES: Record<string, string> = {
  NEGATIVE_STOCK: "Negative Stock",
  STOCK_COST_MISSING: "Cost Missing",
  SETTLEMENT_MISMATCH: "Settlement Mismatch",
  SETTLEMENT_DOUBLE_POST: "Double Post",
  DELIVERED_NOT_POSTED_TO_GL: "Unposted Event",
  ADVANCE_NOT_POSTED: "Advance Not Posted",
  COURIER_COST_MISSING: "Courier Cost Missing",
  AD_SPEND_UNMAPPED: "Ad Spend Unmapped",
  ACCOUNT_MAPPING_MISSING: "Mapping Missing",
  UNBALANCED_JOURNAL: "Unbalanced Journal",
  DUPLICATE_JOURNAL_RISK: "Duplicate Journal",
  GRN_NOT_POSTED: "GRN Not Posted",
  LANDED_COST_NOT_ALLOCATED: "Landed Cost",
  RESERVED_EXCEEDS_ONHAND: "Reserved > On-hand",
  STOCK_LEDGER_MISMATCH: "Stock Mismatch",
  DATA_VALIDATION_ERROR: "Data Error",
  PERIOD_LOCK_VIOLATION: "Period Violation",
  COURIER_COST_MISMATCH: "Cost Mismatch",
  SHORT_PAYMENT: "Short Payment",
  UNKNOWN_TRACKING_ID: "Unknown Tracking",
  UNALLOCATED_MARKETING: "Unallocated Marketing",
  COD_RECEIVED_NOT_POSTED: "COD Not Posted",
  STATUS_INCONSISTENT: "Status Mismatch",
  PAYABLE_AGING_HIGH: "High Payable Aging",
  UNPOSTED_EXPENSE_STALE: "Stale Expense",
};

const REFERENCE_TYPES = ["order", "product", "shipment", "settlement", "event", "journal", "grn", "campaign", "account_mapping", "landed_cost"];

export function ExceptionsQueueTab() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState("open");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [codeFilter, setCodeFilter] = useState("all");
  const [refTypeFilter, setRefTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState<Exception | null>(null);
  const [resolveNotes, setResolveNotes] = useState("");

  const { data: exceptions, isLoading } = useExceptions({
    status: statusFilter, severity: severityFilter, module: moduleFilter,
    code: codeFilter, referenceType: refTypeFilter,
    dateFrom: dateFrom || undefined, dateTo: dateTo || undefined,
  });
  const { data: events } = useExceptionEvents(selected?.id);
  const updateMut = useUpdateException();

  const handleResolve = () => {
    if (!selected) return;
    updateMut.mutate({
      id: selected.id,
      updates: { status: "resolved", resolved_at: new Date().toISOString(), resolved_by: "user", resolution_notes: resolveNotes },
      eventMessage: `Resolved: ${resolveNotes || "No notes"}`,
    });
    setSelected(null);
    setResolveNotes("");
  };

  const handleStatusChange = (exc: Exception, status: string) => {
    updateMut.mutate({ id: exc.id, updates: { status } as any, eventMessage: `Status changed to ${status}` });
    if (selected?.id === exc.id) setSelected(null);
  };

  const handleFix = (exc: Exception) => {
    const routeFn = EXCEPTION_FIX_ROUTES[exc.code];
    if (routeFn) navigate(routeFn(exc));
  };

  return (
    <div className="space-y-4 mt-4">
      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="ignored">Ignored</SelectItem>
          </SelectContent>
        </Select>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severity</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={moduleFilter} onValueChange={setModuleFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Modules</SelectItem>
            {Object.entries(MODULE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={codeFilter} onValueChange={setCodeFilter}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(EXCEPTION_CODES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={refTypeFilter} onValueChange={setRefTypeFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Ref Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Refs</SelectItem>
            {REFERENCE_TYPES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[140px]" placeholder="From" />
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[140px]" placeholder="To" />
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Severity</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Module</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Detected</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[160px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : !exceptions?.length ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No exceptions found</TableCell></TableRow>
            ) : exceptions.map((exc) => {
              const sev = SEVERITY_CONFIG[exc.severity] || SEVERITY_CONFIG.medium;
              const st = STATUS_CONFIG[exc.status] || STATUS_CONFIG.open;
              return (
                <TableRow key={exc.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(exc)}>
                  <TableCell>
                    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold", sev.color)}>
                      <sev.icon className="w-3 h-3" />{sev.label}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{EXCEPTION_CODES[exc.code] || exc.code}</TableCell>
                  <TableCell className="font-medium max-w-[250px] truncate">{exc.title}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-xs">{MODULE_LABELS[exc.source_module] || exc.source_module}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{exc.source_entity_type}: {exc.source_entity_id?.slice(0, 8)}…</TableCell>
                  <TableCell className="text-xs">{format(new Date(exc.detected_at), "dd MMM yy HH:mm")}</TableCell>
                  <TableCell><span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold", st.color)}>{st.label}</span></TableCell>
                  <TableCell>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      {exc.status === "open" && <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleStatusChange(exc, "in_progress")}>Start</Button>}
                      {EXCEPTION_FIX_ROUTES[exc.code] && (exc.status === "open" || exc.status === "in_progress") && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleFix(exc)}>
                          <Wrench className="w-3 h-3 mr-1" />Fix
                        </Button>
                      )}
                      {(exc.status === "open" || exc.status === "in_progress") && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelected(exc)}>Resolve</Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">{exceptions?.length || 0} exceptions shown (max 500)</p>

      {/* Detail Drawer */}
      <Sheet open={!!selected} onOpenChange={() => setSelected(null)}>
        <SheetContent className="w-[520px] sm:max-w-[520px] overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="text-lg">{selected.title}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                {/* Info grid */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Code:</span> <span className="font-mono text-xs">{selected.code}</span></div>
                  <div><span className="text-muted-foreground">Severity:</span> <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold", SEVERITY_CONFIG[selected.severity]?.color)}>{selected.severity}</span></div>
                  <div><span className="text-muted-foreground">Module:</span> {MODULE_LABELS[selected.source_module]}</div>
                  <div><span className="text-muted-foreground">Status:</span> <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold", STATUS_CONFIG[selected.status]?.color)}>{selected.status}</span></div>
                  <div><span className="text-muted-foreground">Entity:</span> {selected.source_entity_type}</div>
                  <div><span className="text-muted-foreground">Entity ID:</span> <span className="font-mono text-xs">{selected.source_entity_id?.slice(0, 16)}</span></div>
                  <div><span className="text-muted-foreground">Detected:</span> <span className="text-xs">{format(new Date(selected.detected_at), "dd MMM yy HH:mm")}</span></div>
                  {selected.resolved_at && <div><span className="text-muted-foreground">Resolved:</span> <span className="text-xs">{format(new Date(selected.resolved_at), "dd MMM yy HH:mm")}</span></div>}
                </div>

                {/* Description */}
                <div className="bg-muted/50 rounded-lg p-3 text-sm">{selected.description || "No description"}</div>

                {/* Metadata */}
                {selected.metadata && Object.keys(selected.metadata).length > 0 && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Context Data</p>
                    <pre className="text-xs overflow-x-auto">{JSON.stringify(selected.metadata, null, 2)}</pre>
                  </div>
                )}

                {/* Fix Action */}
                {EXCEPTION_FIX_ROUTES[selected.code] && (selected.status === "open" || selected.status === "in_progress") && (
                  <Button variant="outline" className="w-full" onClick={() => { handleFix(selected); setSelected(null); }}>
                    <Wrench className="w-4 h-4 mr-2" />Go to Fix: {EXCEPTION_CODES[selected.code] || selected.code}
                    <ArrowRight className="w-4 h-4 ml-auto" />
                  </Button>
                )}

                {/* Resolution actions */}
                {(selected.status === "open" || selected.status === "in_progress") && (
                  <div className="space-y-3 border-t border-border pt-3">
                    <Textarea placeholder="Resolution notes (required for resolve)…" value={resolveNotes} onChange={(e) => setResolveNotes(e.target.value)} rows={3} />
                    <div className="flex gap-2">
                      <Button onClick={handleResolve} className="flex-1" disabled={!resolveNotes.trim()}>
                        <CheckCircle className="w-4 h-4 mr-1" />Resolve
                      </Button>
                      <Button variant="outline" onClick={() => handleStatusChange(selected, "ignored")} className="flex-1">Ignore</Button>
                    </div>
                  </div>
                )}

                {/* Resolution info */}
                {selected.resolution_notes && (
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 text-sm">
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Resolution Notes</p>
                    <p>{selected.resolution_notes}</p>
                    {selected.resolved_by && <p className="text-xs text-muted-foreground mt-1">By: {selected.resolved_by}</p>}
                  </div>
                )}

                {/* Timeline */}
                {events && events.length > 0 && (
                  <div className="border-t border-border pt-3">
                    <p className="text-sm font-semibold mb-2">Timeline</p>
                    <div className="space-y-2">
                      {events.map((ev) => (
                        <div key={ev.id} className="flex gap-2 text-xs">
                          <span className="text-muted-foreground whitespace-nowrap">{format(new Date(ev.created_at), "dd MMM HH:mm")}</span>
                          <Badge variant="outline" className="text-[10px] h-5">{ev.event_type}</Badge>
                          <span>{ev.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
