import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuditLogs } from "@/hooks/use-rbac";
import { format, subDays } from "date-fns";
import { Eye, Shield } from "lucide-react";

const MODULES = ["all", "orders", "journal_entries", "courier_shipments", "goods_receipts", "supplier_payments", "expenses", "employees", "settings", "security_roles"];
const ACTIONS = ["all", "INSERT", "UPDATE", "DELETE", "POST", "REVERSE"];

const ACTION_COLORS: Record<string, string> = {
  INSERT: "bg-emerald-100 text-emerald-800",
  UPDATE: "bg-blue-100 text-blue-800",
  DELETE: "bg-red-100 text-red-800",
  POST: "bg-violet-100 text-violet-800",
  REVERSE: "bg-amber-100 text-amber-800",
};

export default function AuditLogsPage() {
  const [moduleFilter, setModuleFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [entityId, setEntityId] = useState("");
  const [viewLog, setViewLog] = useState<any>(null);

  const { data: logs, isLoading } = useAuditLogs({
    module: moduleFilter,
    action: actionFilter,
    dateFrom,
    dateTo,
    entityId: entityId || undefined,
  });

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-primary/10">
          <Shield className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Audit Logs</h1>
          <p className="text-sm text-muted-foreground">Immutable record of all system changes</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <Label className="text-xs">From</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[140px] h-8 text-xs" />
        </div>
        <div>
          <Label className="text-xs">To</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[140px] h-8 text-xs" />
        </div>
        <Select value={moduleFilter} onValueChange={setModuleFilter}>
          <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MODULES.map((m) => <SelectItem key={m} value={m}>{m === "all" ? "All Modules" : m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ACTIONS.map((a) => <SelectItem key={a} value={a}>{a === "all" ? "All Actions" : a}</SelectItem>)}
          </SelectContent>
        </Select>
        <div>
          <Label className="text-xs">Entity ID</Label>
          <Input value={entityId} onChange={(e) => setEntityId(e.target.value)} placeholder="Search by ID..." className="w-[180px] h-8 text-xs" />
        </div>
      </div>

      <Card className="border-border">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left p-3 font-semibold">Time</th>
                <th className="text-left p-3 font-semibold">User</th>
                <th className="text-left p-3 font-semibold">Module</th>
                <th className="text-left p-3 font-semibold">Action</th>
                <th className="text-left p-3 font-semibold">Entity</th>
                <th className="text-left p-3 font-semibold">Reason</th>
                <th className="text-right p-3 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : (logs || []).length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No audit logs found</td></tr>
              ) : (
                (logs || []).map((log: any) => (
                  <tr key={log.id} className="border-b border-border hover:bg-muted/30">
                    <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.created_at), "dd MMM yyyy HH:mm:ss")}
                    </td>
                    <td className="p-3 text-xs">{log.user_name || log.performed_by || log.user_id?.slice(0, 8) || "system"}</td>
                    <td className="p-3">
                      <Badge variant="outline" className="text-[10px]">{log.entity_type}</Badge>
                    </td>
                    <td className="p-3">
                      <Badge variant="secondary" className={`text-[10px] ${ACTION_COLORS[log.action] || ""}`}>
                        {log.action}
                      </Badge>
                    </td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">{log.entity_id?.slice(0, 12)}...</td>
                    <td className="p-3 text-xs max-w-[200px] truncate">{log.reason || "—"}</td>
                    <td className="p-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => setViewLog(log)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!viewLog} onOpenChange={() => setViewLog(null)}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Audit Log Detail</DialogTitle>
          </DialogHeader>
          {viewLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Time:</span> {format(new Date(viewLog.created_at), "dd MMM yyyy HH:mm:ss")}</div>
                <div><span className="text-muted-foreground">User:</span> {viewLog.user_name || viewLog.performed_by || viewLog.user_id || "system"}</div>
                <div><span className="text-muted-foreground">Module:</span> {viewLog.entity_type}</div>
                <div><span className="text-muted-foreground">Action:</span> {viewLog.action}</div>
                <div><span className="text-muted-foreground">Entity ID:</span> <code className="text-xs bg-muted px-1 rounded">{viewLog.entity_id}</code></div>
                <div><span className="text-muted-foreground">IP:</span> {viewLog.ip_address || "—"}</div>
              </div>
              {viewLog.reason && (
                <div>
                  <Label className="text-xs text-muted-foreground">Reason</Label>
                  <p className="text-sm mt-1 p-2 bg-muted rounded">{viewLog.reason}</p>
                </div>
              )}
              {viewLog.before_json && (
                <div>
                  <Label className="text-xs text-muted-foreground">Before</Label>
                  <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto mt-1 max-h-48">
                    {JSON.stringify(viewLog.before_json, null, 2)}
                  </pre>
                </div>
              )}
              {viewLog.after_json && (
                <div>
                  <Label className="text-xs text-muted-foreground">After</Label>
                  <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto mt-1 max-h-48">
                    {JSON.stringify(viewLog.after_json, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
