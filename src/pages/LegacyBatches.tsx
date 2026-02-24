import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Trash2, Loader2 } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { useState } from "react";

export default function LegacyBatches() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rolling, setRolling] = useState<string | null>(null);

  const { data: batches, isLoading } = useQuery({
    queryKey: ["legacy-import-batches"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("legacy_import_batches" as any)
        .select("*") as any)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const handleRollback = async (batchId: string) => {
    // Check if any order in this batch has been finalized
    const { data: finalized } = await (supabase
      .from("orders")
      .select("id") as any)
      .eq("legacy_import_batch_id", batchId)
      .eq("legacy_finalized", true)
      .limit(1);

    if (finalized && finalized.length > 0) {
      toast({ title: "Cannot rollback", description: "Some orders in this batch have been finalized with GL postings.", variant: "destructive" });
      return;
    }

    setRolling(batchId);

    // Get order IDs
    const { data: orders } = await (supabase
      .from("orders")
      .select("id") as any)
      .eq("legacy_import_batch_id", batchId);

    if (orders && orders.length > 0) {
      const ids = orders.map((o) => o.id);
      // Delete order items first
      for (const id of ids) {
        await supabase.from("order_items").delete().eq("order_id", id);
      }
      // Delete orders
      for (const id of ids) {
        await supabase.from("orders").delete().eq("id", id);
      }
    }

    // Update batch status
    await supabase
      .from("legacy_import_batches" as any)
      .update({ status: "rolled_back" })
      .eq("id", batchId);

    queryClient.invalidateQueries({ queryKey: ["legacy-import-batches"] });
    toast({ title: "✅ Batch rolled back", description: `${orders?.length || 0} orders removed` });
    setRolling(null);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/orders")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Legacy Import Batches</h1>
          <p className="text-sm text-muted-foreground">View and manage imported legacy order batches</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Imported</TableHead>
                <TableHead>Duplicates</TableHead>
                <TableHead>Failed</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading…</TableCell>
                </TableRow>
              ) : !batches?.length ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No import batches found</TableCell>
                </TableRow>
              ) : batches.map((b: any) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium text-sm">{b.file_name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDateTime(b.created_at)}</TableCell>
                  <TableCell>{b.total_rows}</TableCell>
                  <TableCell><Badge variant="default" className="text-xs">{b.imported_count}</Badge></TableCell>
                  <TableCell><Badge variant="secondary" className="text-xs">{b.duplicate_count}</Badge></TableCell>
                  <TableCell>
                    {b.failed_count > 0 ? (
                      <Badge variant="destructive" className="text-xs">{b.failed_count}</Badge>
                    ) : "0"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={b.status === "rolled_back" ? "destructive" : "secondary"} className="text-xs capitalize">
                      {b.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {b.status !== "rolled_back" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        disabled={rolling === b.id}
                        onClick={() => handleRollback(b.id)}
                      >
                        {rolling === b.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        Rollback
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
