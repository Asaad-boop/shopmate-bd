import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp } from "lucide-react";
import { formatBDT } from "@/lib/format";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";

export default function ReportsPnLPage() {
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const start = format(startOfMonth(selectedMonth), "yyyy-MM-dd");
  const end = format(endOfMonth(selectedMonth), "yyyy-MM-dd");

  const { data: dailyPnl, isLoading } = useQuery({
    queryKey: ["daily-pnl", start, end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_daily_pnl" as any)
        .select("*")
        .gte("pnl_date", start)
        .lte("pnl_date", end)
        .order("pnl_date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: expenses } = useQuery({
    queryKey: ["month-expenses", start, end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("category, amount")
        .eq("type", "expense")
        .gte("transaction_date", start)
        .lte("transaction_date", end);
      if (error) throw error;
      return data;
    },
  });

  const totals = (dailyPnl || []).reduce(
    (acc: any, d: any) => ({
      orders: acc.orders + (d.delivered_orders || 0),
      revenue: acc.revenue + (d.revenue || 0),
      cogs: acc.cogs + (d.cogs || 0),
      courier: acc.courier + (d.courier_cost || 0),
      gross_profit: acc.gross_profit + (d.gross_profit || 0),
    }),
    { orders: 0, revenue: 0, cogs: 0, courier: 0, gross_profit: 0 }
  );

  const totalExpenses = (expenses || []).reduce((s, e) => s + (e.amount || 0), 0);
  const netProfit = totals.gross_profit - totalExpenses;

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">P&L Report</h1>
          <p className="text-sm text-muted-foreground">Delivered-based profit — {format(selectedMonth, "MMMM yyyy")}</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Revenue", value: totals.revenue, color: "text-green-600" },
          { label: "COGS", value: totals.cogs, color: "text-red-600" },
          { label: "Courier", value: totals.courier, color: "text-orange-600" },
          { label: "Operating Exp", value: totalExpenses, color: "text-red-600" },
          { label: "Net Profit", value: netProfit, color: netProfit >= 0 ? "text-green-600" : "text-red-600" },
        ].map((m) => (
          <Card key={m.label}>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{m.label}</p>
              <p className={`text-xl font-bold font-mono mt-1 ${m.color}`}>
                {isLoading ? <Skeleton className="h-7 w-24" /> : formatBDT(m.value)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Daily Breakdown */}
      <Card>
        <CardHeader><CardTitle className="text-base">Daily Breakdown</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-[300px]" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">COGS</TableHead>
                  <TableHead className="text-right">Courier</TableHead>
                  <TableHead className="text-right">Gross Profit</TableHead>
                  <TableHead className="text-right">Subsidy</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(dailyPnl || []).length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No delivered orders for this period</TableCell></TableRow>
                ) : (
                  (dailyPnl || []).map((d: any) => (
                    <TableRow key={d.pnl_date}>
                      <TableCell className="text-sm">{d.pnl_date}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{d.delivered_orders}</TableCell>
                      <TableCell className="text-right font-mono text-sm text-green-600">{formatBDT(d.revenue)}</TableCell>
                      <TableCell className="text-right font-mono text-sm text-red-600">{formatBDT(d.cogs)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{formatBDT(d.courier_cost)}</TableCell>
                      <TableCell className={`text-right font-mono text-sm font-bold ${d.gross_profit >= 0 ? "text-green-600" : "text-red-600"}`}>{formatBDT(d.gross_profit)}</TableCell>
                      <TableCell className="text-right font-mono text-sm text-orange-600">{formatBDT(d.courier_subsidy)}</TableCell>
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
