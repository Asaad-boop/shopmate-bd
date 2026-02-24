import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useGLProfitLoss } from "@/hooks/use-reports-engine";
import { formatBDT } from "@/lib/format";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";

const heading: React.CSSProperties = { fontFamily: "'Playfair Display', serif" };
const mono: React.CSSProperties = { fontFamily: "'DM Mono', monospace" };

export function GLProfitLossTab() {
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const { data: pnl, isLoading } = useGLProfitLoss(dateFrom, dateTo);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-end">
        <div><Label className="text-xs">From</Label><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[150px] h-8 text-xs" /></div>
        <div><Label className="text-xs">To</Label><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[150px] h-8 text-xs" /></div>
      </div>

      {isLoading ? <Skeleton className="h-[400px]" /> : pnl && (
        <Card className="border-border/50">
          <CardHeader><CardTitle style={heading}>Profit & Loss Statement (GL-Based)</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1 max-w-2xl">
              <SectionHeader label="REVENUE" bg="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300" />
              {pnl.income.map((a) => <Row key={a.code} label={`${a.code} — ${a.name}`} amount={a.net} />)}
              <Subtotal label="Total Revenue" amount={pnl.totalRevenue} className="text-emerald-700" />

              <SectionHeader label="COST OF GOODS SOLD" bg="bg-orange-50 dark:bg-orange-950/30 text-orange-800 dark:text-orange-300" />
              {pnl.cogs.map((a) => <Row key={a.code} label={`${a.code} — ${a.name}`} amount={a.net} negative />)}
              <Subtotal label="Gross Profit" amount={pnl.grossProfit} className={pnl.grossProfit >= 0 ? "text-emerald-700" : "text-destructive"} />

              <SectionHeader label="OPERATING EXPENSES" bg="bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300" />
              {pnl.expense.map((a) => <Row key={a.code} label={`${a.code} — ${a.name}`} amount={a.net} negative />)}
              <Subtotal label="Total Expenses" amount={pnl.totalExpenses} className="text-red-700" />

              <div className="flex justify-between px-4 py-3 mt-4 rounded-xl bg-foreground text-background font-bold text-base">
                <span style={heading}>NET PROFIT</span>
                <span className={pnl.netProfit >= 0 ? "text-emerald-400" : "text-red-400"} style={mono}>{formatBDT(pnl.netProfit)}</span>
              </div>
              <p className="text-center text-sm text-muted-foreground mt-1">Net Margin: <span className="font-semibold" style={mono}>{pnl.netMargin}%</span></p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SectionHeader({ label, bg }: { label: string; bg: string }) {
  return <div className={cn("rounded-lg px-4 py-2 font-semibold text-sm flex justify-between mt-4", bg)}><span>{label}</span><span>Amount</span></div>;
}

function Row({ label, amount, negative }: { label: string; amount: number; negative?: boolean }) {
  return (
    <div className="flex justify-between px-4 py-2 text-sm border-b border-border/30">
      <span>{label}</span>
      <span className={negative ? "text-red-600" : ""} style={mono}>{negative ? "-" : ""}{formatBDT(Math.abs(amount))}</span>
    </div>
  );
}

function Subtotal({ label, amount, className }: { label: string; amount: number; className?: string }) {
  return (
    <div className="flex justify-between px-4 py-2 text-sm font-bold bg-muted/50 rounded">
      <span>{label}</span><span className={className} style={mono}>{formatBDT(amount)}</span>
    </div>
  );
}
