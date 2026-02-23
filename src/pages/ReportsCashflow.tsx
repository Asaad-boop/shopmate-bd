import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign } from "lucide-react";
import { formatBDT } from "@/lib/format";

export default function ReportsCashflowPage() {
  const { data: cashflow, isLoading } = useQuery({
    queryKey: ["daily-cashflow"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_daily_cashflow" as any)
        .select("*")
        .limit(200);
      if (error) throw error;
      return data as any[];
    },
  });

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
          <DollarSign className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Cashflow Report</h1>
          <p className="text-sm text-muted-foreground">Daily cash movement per account — derived from account ledger</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Daily Cashflow</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-[300px]" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Cash In</TableHead>
                  <TableHead className="text-right">Cash Out</TableHead>
                  <TableHead className="text-right">Net Flow</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(cashflow || []).length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No cashflow data yet</TableCell></TableRow>
                ) : (
                  (cashflow || []).map((c: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm">{c.ledger_date}</TableCell>
                      <TableCell className="font-medium text-sm">{c.account_name}</TableCell>
                      <TableCell className="text-sm capitalize">{c.account_type}</TableCell>
                      <TableCell className="text-right font-mono text-sm text-green-600">{formatBDT(c.cash_in)}</TableCell>
                      <TableCell className="text-right font-mono text-sm text-red-600">{formatBDT(c.cash_out)}</TableCell>
                      <TableCell className={`text-right font-mono text-sm font-bold ${c.net_flow >= 0 ? "text-green-600" : "text-red-600"}`}>{formatBDT(c.net_flow)}</TableCell>
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
