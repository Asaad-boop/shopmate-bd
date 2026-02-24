import { useState, useMemo } from "react";
import { useSupplierPayables } from "@/hooks/use-purchasing";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { Clock, AlertTriangle } from "lucide-react";

const BUCKETS = ["0-7", "8-15", "16-30", "31-60", "60+"] as const;
const bucketColors: Record<string, string> = {
  "0-7": "bg-success/10 text-success",
  "8-15": "bg-info/10 text-info",
  "16-30": "bg-warning/10 text-warning",
  "31-60": "bg-destructive/10 text-destructive",
  "60+": "bg-destructive/20 text-destructive",
};

export function PayablesAgingTab() {
  const { data: payables, isLoading } = useSupplierPayables();
  const [bucketFilter, setBucketFilter] = useState("all");

  const filtered = useMemo(() => {
    if (!payables) return [];
    if (bucketFilter === "all") return payables;
    return payables.filter((p) => p.bucket === bucketFilter);
  }, [payables, bucketFilter]);

  const bucketSummary = useMemo(() => {
    if (!payables) return {};
    const summary: Record<string, { count: number; total: number }> = {};
    BUCKETS.forEach((b) => (summary[b] = { count: 0, total: 0 }));
    payables.forEach((p) => {
      if (summary[p.bucket]) {
        summary[p.bucket].count++;
        summary[p.bucket].total += p.outstanding;
      }
    });
    return summary;
  }, [payables]);

  const totalOutstanding = payables?.reduce((s, p) => s + p.outstanding, 0) || 0;

  if (isLoading) return <div className="p-6 space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>;

  return (
    <div className="space-y-4 mt-4">
      {/* Aging buckets */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setBucketFilter("all")}>
          <CardContent className="p-4 text-center">
            <p className="text-xs font-medium text-muted-foreground">Total Outstanding</p>
            <p className="text-xl font-bold text-foreground mt-1">৳{totalOutstanding.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">{payables?.length || 0} items</p>
          </CardContent>
        </Card>
        {BUCKETS.map((b) => (
          <Card key={b} className={`cursor-pointer hover:shadow-lg transition-shadow ${bucketFilter === b ? "ring-2 ring-primary" : ""}`} onClick={() => setBucketFilter(b)}>
            <CardContent className="p-4 text-center">
              <p className="text-xs font-medium text-muted-foreground">{b} days</p>
              <p className="text-lg font-bold text-foreground mt-1">৳{(bucketSummary[b]?.total || 0).toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">{bucketSummary[b]?.count || 0} items</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Payables table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16">
            <Clock className="w-10 h-10 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No outstanding payables</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>GRN</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Outstanding</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Bucket</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p, i) => (
                <TableRow key={p.id} className="animate-row-in" style={{ animationDelay: `${i * 30}ms` }}>
                  <TableCell className="font-bold text-primary">{p.grn_number}</TableCell>
                  <TableCell className="text-sm">{(p.suppliers as any)?.name || "—"}</TableCell>
                  <TableCell className="text-sm">{format(new Date(p.receipt_date), "dd MMM yyyy")}</TableCell>
                  <TableCell className="text-sm">৳{(p.total_product_cost || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-sm text-success">৳{p.paid.toLocaleString()}</TableCell>
                  <TableCell className="text-sm font-bold text-destructive">৳{p.outstanding.toLocaleString()}</TableCell>
                  <TableCell className="text-sm">{p.daysSince}d</TableCell>
                  <TableCell>
                    <Badge className={`text-[10px] ${bucketColors[p.bucket] || ""}`}>
                      {p.daysSince > 30 && <AlertTriangle className="w-3 h-3 mr-0.5" />}
                      {p.bucket}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
