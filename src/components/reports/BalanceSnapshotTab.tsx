import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useBalanceSnapshot } from "@/hooks/use-reports-engine";
import { formatBDT } from "@/lib/format";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const heading: React.CSSProperties = { fontFamily: "'Playfair Display', serif" };
const mono: React.CSSProperties = { fontFamily: "'DM Mono', monospace" };

export function BalanceSnapshotTab() {
  const [asOf, setAsOf] = useState(format(new Date(), "yyyy-MM-dd"));
  const { data, isLoading } = useBalanceSnapshot(asOf);

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2">
        <div><Label className="text-xs">As of Date</Label><Input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="w-[150px] h-8 text-xs" /></div>
      </div>

      {isLoading ? <Skeleton className="h-[300px]" /> : data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Assets */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm" style={heading}>Assets</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {data.assets.map((a) => (
                <div key={a.code} className="flex justify-between text-sm py-1 border-b border-border/30">
                  <span className="text-muted-foreground">{a.code} — {a.name}</span>
                  <span style={mono}>{formatBDT(a.balance)}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold text-sm pt-2">
                <span>Total Assets</span><span style={mono}>{formatBDT(data.totalAssets)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Liabilities */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm" style={heading}>Liabilities</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {data.liabilities.map((a) => (
                <div key={a.code} className="flex justify-between text-sm py-1 border-b border-border/30">
                  <span className="text-muted-foreground">{a.code} — {a.name}</span>
                  <span style={mono}>{formatBDT(a.balance)}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold text-sm pt-2">
                <span>Total Liabilities</span><span style={mono}>{formatBDT(data.totalLiabilities)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Equity */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm" style={heading}>Equity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="flex justify-between text-sm py-1 border-b border-border/30">
                <span className="text-muted-foreground">Retained Earnings</span>
                <span style={mono}>{formatBDT(data.retainedEarnings)}</span>
              </div>
              <div className="flex justify-between font-bold text-sm pt-2">
                <span>Total Equity</span><span style={mono}>{formatBDT(data.equity)}</span>
              </div>
              <div className="mt-3">
                <Badge variant={data.balanced ? "secondary" : "destructive"} className={cn("text-xs", data.balanced ? "bg-emerald-100 text-emerald-800" : "")}>
                  {data.balanced ? "✓ A = L + E" : "✗ Imbalanced"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
