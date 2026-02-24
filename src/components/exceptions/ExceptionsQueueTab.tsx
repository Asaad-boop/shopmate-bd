import { useState } from "react";
import { useExceptions, useUpdateException, useExceptionEvents, type Exception } from "@/hooks/use-exceptions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { AlertTriangle, CheckCircle, Clock, Eye, ExternalLink, XCircle } from "lucide-react";

const SEVERITY_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  critical: { label: "Critical", color: "bg-red-100 text-red-800", icon: XCircle },
  high: { label: "High", color: "bg-orange-100 text-orange-800", icon: AlertTriangle },
  medium: { label: "Medium", color: "bg-amber-100 text-amber-800", icon: Clock },
  low: { label: "Low", color: "bg-blue-100 text-blue-800", icon: Eye },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  open: { label: "Open", color: "bg-red-100 text-red-800" },
  in_progress: { label: "In Progress", color: "bg-amber-100 text-amber-800" },
  resolved: { label: "Resolved", color: "bg-emerald-100 text-emerald-800" },
  ignored: { label: "Ignored", color: "bg-gray-100 text-gray-800" },
};

const MODULE_LABELS: Record<string, string> = {
  orders: "Orders", inventory: "Inventory", courier: "Courier", accounting: "Accounting",
  expenses: "Expenses", purchasing: "Purchasing", import: "Import", hrm: "HRM",
};

export function ExceptionsQueueTab() {
  const [statusFilter, setStatusFilter] = useState("open");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [selected, setSelected] = useState<Exception | null>(null);
  const [resolveNotes, setResolveNotes] = useState("");

  const { data: exceptions, isLoading } = useExceptions({ status: statusFilter, severity: severityFilter, module: moduleFilter });
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

  return (
    <div className="space-y-4 mt-4">
      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="ignored">Ignored</SelectItem>
          </SelectContent>
        </Select>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severity</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={moduleFilter} onValueChange={setModuleFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Modules</SelectItem>
            {Object.entries(MODULE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Severity</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Module</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Detected</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[140px]">Actions</TableHead>
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
                  <TableCell className="font-mono text-xs">{exc.code}</TableCell>
                  <TableCell className="font-medium max-w-[250px] truncate">{exc.title}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-xs">{MODULE_LABELS[exc.source_module] || exc.source_module}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{exc.source_entity_type}: {exc.source_entity_id?.slice(0, 8)}…</TableCell>
                  <TableCell className="text-xs">{format(new Date(exc.detected_at), "dd MMM yy HH:mm")}</TableCell>
                  <TableCell><span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold", st.color)}>{st.label}</span></TableCell>
                  <TableCell>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      {exc.status === "open" && <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleStatusChange(exc, "in_progress")}>Start</Button>}
                      {(exc.status === "open" || exc.status === "in_progress") && <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelected(exc)}>Resolve</Button>}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Detail Drawer */}
      <Sheet open={!!selected} onOpenChange={() => setSelected(null)}>
        <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="text-lg">{selected.title}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Code:</span> <span className="font-mono">{selected.code}</span></div>
                  <div><span className="text-muted-foreground">Severity:</span> <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold", SEVERITY_CONFIG[selected.severity]?.color)}>{selected.severity}</span></div>
                  <div><span className="text-muted-foreground">Module:</span> {MODULE_LABELS[selected.source_module]}</div>
                  <div><span className="text-muted-foreground">Status:</span> <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold", STATUS_CONFIG[selected.status]?.color)}>{selected.status}</span></div>
                  <div><span className="text-muted-foreground">Entity:</span> {selected.source_entity_type}</div>
                  <div><span className="text-muted-foreground">Entity ID:</span> <span className="font-mono text-xs">{selected.source_entity_id?.slice(0, 12)}</span></div>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-sm">{selected.description || "No description"}</div>
                {selected.metadata && Object.keys(selected.metadata).length > 0 && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Metadata</p>
                    <pre className="text-xs overflow-x-auto">{JSON.stringify(selected.metadata, null, 2)}</pre>
                  </div>
                )}

                {/* Quick actions */}
                {(selected.status === "open" || selected.status === "in_progress") && (
                  <div className="space-y-3 border-t border-border pt-3">
                    <Textarea placeholder="Resolution notes…" value={resolveNotes} onChange={(e) => setResolveNotes(e.target.value)} rows={3} />
                    <div className="flex gap-2">
                      <Button onClick={handleResolve} className="flex-1"><CheckCircle className="w-4 h-4 mr-1" />Resolve</Button>
                      <Button variant="outline" onClick={() => handleStatusChange(selected, "ignored")} className="flex-1">Ignore</Button>
                    </div>
                  </div>
                )}

                {/* Events timeline */}
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
