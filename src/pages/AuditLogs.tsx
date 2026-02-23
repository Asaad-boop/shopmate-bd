import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollText } from "lucide-react";
import { format } from "date-fns";

export default function AuditLogsPage() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
          <ScrollText className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Audit Logs</h1>
          <p className="text-sm text-muted-foreground">Complete trail of all system changes — no deletions, only reversals</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? <Skeleton className="h-[400px]" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(logs || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                      No audit logs yet. All financial changes will be tracked here automatically.
                    </TableCell>
                  </TableRow>
                ) : (
                  (logs || []).map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(log.created_at), "dd MMM yyyy HH:mm")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{log.entity_type}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={
                          log.action === "create" ? "bg-green-100 text-green-700" :
                          log.action === "update" ? "bg-blue-100 text-blue-700" :
                          log.action === "reverse" ? "bg-red-100 text-red-700" :
                          "bg-muted text-muted-foreground"
                        }>{log.action}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{log.user_name || "System"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate">
                        {log.after_json ? JSON.stringify(log.after_json).slice(0, 80) : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
