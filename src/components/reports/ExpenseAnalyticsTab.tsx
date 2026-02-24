import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useExpenseAnalytics } from "@/hooks/use-reports-engine";
import { formatBDT } from "@/lib/format";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from "recharts";

const heading: React.CSSProperties = { fontFamily: "'Playfair Display', serif" };
const mono: React.CSSProperties = { fontFamily: "'DM Mono', monospace" };
const PIE_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

export function ExpenseAnalyticsTab() {
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const { data, isLoading } = useExpenseAnalytics(dateFrom, dateTo);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-end">
        <div><Label className="text-xs">From</Label><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[150px] h-8 text-xs" /></div>
        <div><Label className="text-xs">To</Label><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[150px] h-8 text-xs" /></div>
      </div>

      {isLoading ? <Skeleton className="h-[400px]" /> : data && (
        <>
          <Card className="border-border/50">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground uppercase">Total Expenses</p>
              <p className="text-2xl font-bold" style={mono}>{formatBDT(data.total)}</p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Pie Chart */}
            <Card className="border-border/50">
              <CardHeader className="pb-2"><CardTitle className="text-sm" style={heading}>By Category</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <ResponsiveContainer width={200} height={200}>
                    <PieChart>
                      <Pie data={data.byCategory} dataKey="amount" nameKey="category" cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={2}>
                        {data.byCategory.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatBDT(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5">
                    {data.byCategory.map((c: any, i: number) => (
                      <div key={c.category} className="flex items-center gap-2 text-sm">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-muted-foreground">{c.category}</span>
                        <span style={mono}>{formatBDT(c.amount)} ({c.pct}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Monthly Trend */}
            <Card className="border-border/50">
              <CardHeader className="pb-2"><CardTitle className="text-sm" style={heading}>Monthly Trend</CardTitle></CardHeader>
              <CardContent>
                {data.byMonth.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data.byMonth}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number) => formatBDT(v)} />
                      <Bar dataKey="amount" name="Expenses" fill="hsl(var(--destructive))" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No trend data</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
