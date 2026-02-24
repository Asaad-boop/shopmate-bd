import { useState } from "react";
import { useCouriers, useReconciliationExceptions, useResolveException } from "@/hooks/use-courier";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, CheckCircle, ShieldAlert } from "lucide-react";
import { formatDateTime } from "@/lib/format";

const TYPES = ["all", "cost_missing", "cost_mismatch", "short_payment", "unknown_tracking", "status_mismatch"];
const SEVERITIES = ["all", "low", "medium", "high"];

export function ReconciliationTab() {
  const { data: couriers } = useCouriers();
  const [filters, setFilters] = useState({ type: "all", severity: "all", status: "open", courierId: "all" });
  const { data: exceptions, isLoading } = useReconciliationExceptions(filters);
  const resolve = useResolveException();
  const [resolving, setResolving] = useState<any>(null);
  const [note, setNote] = useState("");

  const handleResolve = () => {
    if (!resolving) return;
    resolve.mutate({ id: resolving.id, note });
    setResolving(null);
    setNote("");
  };

  const sevColor = (s: string) => {
    if (s === "high") return "bg-red-100 text-red-800";
    if (s === "medium") return "bg-orange-100 text-orange-800";
    return "bg-blue-100 text-blue-800";
  };

  const openCount = (exceptions || []).filter((e: any) => e.status === "open").length;

  return (
    <>
      <div className="grid grid-cols-3 gap-4 mb-4">
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4 flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-orange-500" />
            <div>
              <div className="text-2xl font-bold">{openCount}</div>
              <div className="text-xs text-muted-foreground">Open Exceptions</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-red-500" />
            <div>
              <div className="text-2xl font-bold">{(exceptions || []).filter((e: any) => e.severity === "high" && e.status === "open").length}</div>
              <div className="text-xs text-muted-foreground">High Severity</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-emerald-500" />
            <div>
              <div className="text-2xl font-bold">{(exceptions || []).filter((e: any) => e.status === "resolved").length}</div>
              <div className="text-xs text-muted-foreground">Resolved</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reconciliation Exceptions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.type} onValueChange={(v) => setFilters({ ...filters, type: v })}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => <SelectItem key={t} value={t}>{t === "all" ? "All Types" : t.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.severity} onValueChange={(v) => setFilters({ ...filters, severity: v })}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SEVERITIES.map((s) => <SelectItem key={s} value={s}>{s === "all" ? "All Severity" : s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.courierId} onValueChange={(v) => setFilters({ ...filters, courierId: v })}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Couriers</SelectItem>
                {(couriers || []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? <Skeleton className="h-40 w-full" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs">Courier</TableHead>
                  <TableHead className="text-xs">Severity</TableHead>
                  <TableHead className="text-xs">Message</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Created</TableHead>
                  <TableHead className="text-xs w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(exceptions || []).map((ex: any) => (
                  <TableRow key={ex.id}>
                    <TableCell><Badge variant="outline" className="text-[10px]">{ex.type?.replace(/_/g, " ")}</Badge></TableCell>
                    <TableCell className="text-xs">{ex.couriers?.name || "-"}</TableCell>
                    <TableCell><Badge className={`${sevColor(ex.severity)} text-[10px]`}>{ex.severity}</Badge></TableCell>
                    <TableCell className="text-xs max-w-[300px] truncate">{ex.message}</TableCell>
                    <TableCell><Badge variant={ex.status === "open" ? "destructive" : "default"} className="text-[10px]">{ex.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDateTime(ex.created_at)}</TableCell>
                    <TableCell>
                      {ex.status === "open" && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setResolving(ex)}>
                          Resolve
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {(exceptions || []).length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8 text-sm">No exceptions 🎉</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!resolving} onOpenChange={() => setResolving(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Resolve Exception</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-sm bg-muted/50 p-3 rounded-lg">{resolving?.message}</div>
            <div>
              <label className="text-xs font-medium">Resolution Note</label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was done to resolve this..." />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleResolve} disabled={resolve.isPending}>
              <CheckCircle className="w-3.5 h-3.5 mr-1" /> Mark Resolved
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
