import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFinanceStats, useExpenseBreakdown, CATEGORY_LABELS } from "@/hooks/use-finance";
import { formatBDT } from "@/lib/format";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { useDailyChart } from "@/hooks/use-finance";
import { Skeleton } from "@/components/ui/skeleton";

const mono = { fontFamily: "'DM Mono', monospace" };
const heading = { fontFamily: "'Playfair Display', serif" };

interface Props { dateRange: { start: Date; end: Date }; prevRange: { start: Date; end: Date }; }

export function PLStatementTab({ dateRange, prevRange }: Props) {
  const { data: stats, isLoading } = useFinanceStats(dateRange, prevRange);
  const { data: breakdown } = useExpenseBreakdown(dateRange);
  const { data: chartData } = useDailyChart(dateRange);

  const totalExpense = (breakdown || []).reduce((s, b) => s + b.total, 0);

  const incomeRows = [
    { label: "Sales Revenue", key: "sales_revenue" },
    { label: "Advance Payments", key: "advance_payment" },
    { label: "Delivery Charge Collected", key: "delivery_charge_collected" },
    { label: "Other Income", key: "other_income" },
  ];

  // Build income breakdown from breakdown data (we'd need income breakdown too, but approximate)
  const expenseRows = (breakdown || []).map(b => ({
    label: CATEGORY_LABELS[b.category] || b.category,
    amount: b.total,
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* P&L Table */}
      <Card className="lg:col-span-2 border-[#e4e6ef]">
        <CardHeader>
          <CardTitle style={heading}>Profit & Loss Statement</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-[400px]" /> : (
            <div className="space-y-1">
              {/* Income Section */}
              <div className="bg-emerald-50 rounded-lg px-4 py-2 font-semibold text-emerald-800 text-sm flex justify-between">
                <span>INCOME</span><span>Amount</span>
              </div>
              {incomeRows.map(r => (
                <div key={r.key} className="flex justify-between px-4 py-2 text-sm border-b border-[#e4e6ef]">
                  <span>{r.label}</span>
                  <span style={mono}>-</span>
                </div>
              ))}
              <div className="flex justify-between px-4 py-2 text-sm font-bold bg-emerald-50/50 rounded">
                <span>Subtotal Income</span>
                <span className="text-emerald-700" style={mono}>{formatBDT(stats?.income || 0)}</span>
              </div>

              {/* Expense Section */}
              <div className="bg-red-50 rounded-lg px-4 py-2 font-semibold text-red-800 text-sm flex justify-between mt-4">
                <span>EXPENSES</span><span>Amount</span>
              </div>
              {expenseRows.map((r, i) => (
                <div key={i} className="flex justify-between px-4 py-2 text-sm border-b border-[#e4e6ef]">
                  <span>{r.label}</span>
                  <span className="text-red-600" style={mono}>{formatBDT(r.amount)}</span>
                </div>
              ))}
              {expenseRows.length === 0 && (
                <div className="px-4 py-2 text-sm text-muted-foreground">No expenses recorded</div>
              )}
              <div className="flex justify-between px-4 py-2 text-sm font-bold bg-red-50/50 rounded">
                <span>Subtotal Expenses</span>
                <span className="text-red-700" style={mono}>{formatBDT(totalExpense)}</span>
              </div>

              {/* Net Profit */}
              <div className="flex justify-between px-4 py-3 mt-4 rounded-lg bg-[#0f172a] text-white font-bold">
                <span style={heading}>NET PROFIT</span>
                <span className={(stats?.netProfit || 0) >= 0 ? "text-emerald-400" : "text-red-400"} style={mono}>
                  {formatBDT(stats?.netProfit || 0)}
                </span>
              </div>
              <div className="text-center text-sm text-muted-foreground mt-1">
                Profit Margin: <span className="font-semibold" style={mono}>{stats?.profitMargin || 0}%</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Metrics + Chart */}
      <div className="space-y-4">
        <Card className="border-[#e4e6ef]">
          <CardHeader className="pb-2"><CardTitle className="text-sm" style={heading}>Key Metrics</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "Profit Margin", value: `${stats?.profitMargin || 0}%` },
              { label: "Income Change", value: `${stats?.incomeChange || 0}%` },
              { label: "Expense Change", value: `${stats?.expenseChange || 0}%` },
            ].map(m => (
              <div key={m.label} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{m.label}</span>
                <span className="font-semibold" style={mono}>{m.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-[#e4e6ef]">
          <CardHeader className="pb-2"><CardTitle className="text-sm" style={heading}>Trend</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e6ef" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(8)} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
