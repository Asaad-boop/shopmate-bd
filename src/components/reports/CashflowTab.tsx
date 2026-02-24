import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useCashflowStatement } from "@/hooks/use-reports-engine";
import { formatBDT } from "@/lib/format";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

const heading: React.CSSProperties = { fontFamily: "'Playfair Display', serif" };
const mono: React.CSSProperties = { fontFamily: "'DM Mono', monospace" };

export function CashflowTab() {
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const { data, isLoading } = useCashflowStatement(dateFrom, dateTo);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-end">
        <div><Label className="text-xs">From</Label><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[150px] h-8 text-xs" /></div>
        <div><Label className="text-xs">To</Label><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[150px] h-8 text-xs" /></div>
      </div>

      {isLoading ? <Skeleton className="h-[300px]" /> : data && (
        <Card className="border-border/50">
          <CardHeader><CardTitle style={heading}>Cashflow Statement (Direct Method)</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 max-w-2xl">
              {data.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-2.5 rounded-lg border border-border/30">
                  <div className="flex items-center gap-2">
                    {item.amount >= 0 ? (
                      <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4 text-red-500" />
                    )}
                    <span className="text-sm">{item.label}</span>
                  </div>
                  <span className={cn("font-medium text-sm", item.amount >= 0 ? "text-emerald-600" : "text-red-500")} style={mono}>
                    {formatBDT(item.amount)}
                  </span>
                </div>
              ))}
              {data.items.length === 0 && (
                <p className="text-center text-muted-foreground py-8">No cash movements in this period</p>
              )}
              <div className="flex justify-between px-4 py-3 mt-4 rounded-xl bg-foreground text-background font-bold">
                <span style={heading}>Net Cashflow</span>
                <span className={data.netCashflow >= 0 ? "text-emerald-400" : "text-red-400"} style={mono}>
                  {formatBDT(data.netCashflow)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
