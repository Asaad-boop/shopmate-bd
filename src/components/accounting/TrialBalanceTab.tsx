import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useTrialBalance } from "@/hooks/use-accounting";
import { formatBDT } from "@/lib/format";
import { format, startOfMonth } from "date-fns";

const heading = { fontFamily: "'Playfair Display', serif" };
const mono = { fontFamily: "'DM Mono', monospace" };

const TYPE_COLORS: Record<string, string> = {
  asset: "bg-blue-100 text-blue-800",
  liability: "bg-amber-100 text-amber-800",
  income: "bg-emerald-100 text-emerald-800",
  expense: "bg-red-100 text-red-800",
  cogs: "bg-orange-100 text-orange-800",
  equity: "bg-purple-100 text-purple-800",
};

export function TrialBalanceTab() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const { data: rows, isLoading } = useTrialBalance(dateFrom || undefined, dateTo);

  const totalDr = (rows || []).reduce((s, r) => s + r.total_debit, 0);
  const totalCr = (rows || []).reduce((s, r) => s + r.total_credit, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-lg font-bold" style={heading}>Trial Balance</h3>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Label className="text-xs">From:</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[150px] h-8 text-xs" />
          </div>
          <div className="flex items-center gap-1.5">
            <Label className="text-xs">To:</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[150px] h-8 text-xs" />
          </div>
        </div>
      </div>

      <Card className="border-border">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left p-3 font-semibold">Code</th>
                <th className="text-left p-3 font-semibold">Account</th>
                <th className="text-left p-3 font-semibold">Type</th>
                <th className="text-right p-3 font-semibold">Total Debit</th>
                <th className="text-right p-3 font-semibold">Total Credit</th>
                <th className="text-right p-3 font-semibold">Balance</th>
              </tr>
            </thead>
            <tbody>
              {(rows || []).map((row) => (
                <tr key={row.id} className="border-b border-border hover:bg-muted/30">
                  <td className="p-3 font-mono" style={mono}>{row.code}</td>
                  <td className="p-3">{row.name}</td>
                  <td className="p-3"><Badge variant="secondary" className={TYPE_COLORS[row.account_type] || ""}>{row.account_type}</Badge></td>
                  <td className="p-3 text-right font-mono" style={mono}>{formatBDT(row.total_debit)}</td>
                  <td className="p-3 text-right font-mono" style={mono}>{formatBDT(row.total_credit)}</td>
                  <td className={`p-3 text-right font-mono font-bold ${row.balance >= 0 ? "text-emerald-600" : "text-red-600"}`} style={mono}>
                    {formatBDT(Math.abs(row.balance))} {row.balance < 0 ? "Cr" : "Dr"}
                  </td>
                </tr>
              ))}
              {(rows || []).length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No posted journal entries found</td></tr>
              )}
            </tbody>
            {(rows || []).length > 0 && (
              <tfoot>
                <tr className="bg-muted/50 font-bold">
                  <td className="p-3" colSpan={3}>Total</td>
                  <td className="p-3 text-right font-mono" style={mono}>{formatBDT(totalDr)}</td>
                  <td className="p-3 text-right font-mono" style={mono}>{formatBDT(totalCr)}</td>
                  <td className={`p-3 text-right font-mono ${Math.abs(totalDr - totalCr) < 0.01 ? "text-emerald-600" : "text-red-600"}`} style={mono}>
                    {Math.abs(totalDr - totalCr) < 0.01 ? "✓ Balanced" : `⚠ Off by ${formatBDT(Math.abs(totalDr - totalCr))}`}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
