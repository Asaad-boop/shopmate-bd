import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDailyChart, useExpenseBreakdown, useRecentTransactions, usePayables, useReceivables, useAccounts, CATEGORY_LABELS, CATEGORY_ICONS, CATEGORY_COLORS } from "@/hooks/use-finance";
import { formatBDT } from "@/lib/format";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from "recharts";
import { format, formatDistanceToNow, parseISO, isBefore } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";

const mono = { fontFamily: "'DM Mono', monospace" };
const heading = { fontFamily: "'Playfair Display', serif" };

interface Props { dateRange: { start: Date; end: Date }; onSwitchTab: (tab: string) => void; }

export function OverviewTab({ dateRange, onSwitchTab }: Props) {
  const { data: chartData, isLoading: chartLoading } = useDailyChart(dateRange);
  const { data: breakdown, isLoading: breakdownLoading } = useExpenseBreakdown(dateRange);
  const { data: recentTxns, isLoading: txnLoading } = useRecentTransactions(15);
  const { data: payables } = usePayables();
  const { data: receivables } = useReceivables();
  const { data: accounts } = useAccounts();
  const [txnFilter, setTxnFilter] = useState<"all" | "income" | "expense">("all");

  const filteredTxns = (recentTxns || []).filter(t => txnFilter === "all" || t.type === txnFilter);
  const totalExpense = (breakdown || []).reduce((s, b) => s + b.total, 0);
  const totalPayable = (payables || []).reduce((s, p) => s + Math.max(0, Number(p.total_amount) - Number(p.paid_amount)), 0);
  const totalReceivable = (receivables || []).filter(r => r.status !== "received").reduce((s, r) => s + Number(r.amount), 0);
  const totalCash = (accounts || []).reduce((s, a) => s + Number(a.balance || 0), 0);

  return (
    <div className="space-y-6">
      {/* Row 1: Chart + Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income vs Expense Chart */}
        <Card className="border-[#e4e6ef]">
          <CardHeader className="pb-2"><CardTitle className="text-base" style={heading}>Income vs Expense</CardTitle></CardHeader>
          <CardContent>
            {chartLoading ? <Skeleton className="h-[250px]" /> : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData || []} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e6ef" />
                  <XAxis dataKey="date" tickFormatter={(v) => format(parseISO(v), "dd MMM")} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatBDT(v)} labelFormatter={(l) => format(parseISO(l as string), "dd MMM yyyy")} />
                  <Legend />
                  <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" name="Expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        {/* Expense Breakdown */}
        <Card className="border-[#e4e6ef]">
          <CardHeader className="pb-2"><CardTitle className="text-base" style={heading}>Expense Breakdown</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {breakdownLoading ? <Skeleton className="h-[250px]" /> : (breakdown || []).map((b) => (
              <div key={b.category} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{CATEGORY_ICONS[b.category] || "📋"} {CATEGORY_LABELS[b.category] || b.category}</span>
                  <span style={mono} className="text-red-600">{formatBDT(b.total)}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-red-400 rounded-full transition-all" style={{ width: `${totalExpense > 0 ? (b.total / totalExpense) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
            {(breakdown || []).length > 0 && (
              <div className="pt-2 border-t flex justify-between text-sm font-semibold">
                <span>Total Expenses</span>
                <span style={mono} className="text-red-600">{formatBDT(totalExpense)}</span>
              </div>
            )}
            {(breakdown || []).length === 0 && !breakdownLoading && <p className="text-muted-foreground text-sm text-center py-8">No expenses in this period</p>}
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Recent Transactions + Payable + Receivable */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ gridTemplateColumns: "2fr 1fr 1fr" }}>
        {/* Recent Transactions */}
        <Card className="border-[#e4e6ef]">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base" style={heading}>Recent Transactions</CardTitle>
              <button onClick={() => onSwitchTab("transactions")} className="text-xs text-emerald-600 font-medium hover:underline">View All →</button>
            </div>
            <div className="flex gap-1 mt-2">
              {(["all", "income", "expense"] as const).map((f) => (
                <button key={f} onClick={() => setTxnFilter(f)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition ${txnFilter === f ? "bg-[#0f172a] text-white" : "bg-muted text-muted-foreground"}`}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-1 max-h-[400px] overflow-y-auto">
            {txnLoading ? <Skeleton className="h-[200px]" /> : filteredTxns.slice(0, 15).map((t) => (
              <div key={t.id} className="flex items-center gap-3 py-2 border-b border-[#e4e6ef] last:border-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${CATEGORY_COLORS[t.category || ""] || "bg-gray-100"}`}>
                  {CATEGORY_ICONS[t.category || ""] || "📋"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{t.description || CATEGORY_LABELS[t.category || ""] || t.category}</p>
                  <p className="text-xs text-muted-foreground">{t.transaction_date ? formatDistanceToNow(parseISO(t.transaction_date), { addSuffix: true }) : ""}</p>
                </div>
                <span className={`text-sm font-semibold ${t.type === "income" ? "text-emerald-600" : "text-red-600"}`} style={mono}>
                  {t.type === "income" ? "+" : "−"}{formatBDT(Number(t.amount))}
                </span>
              </div>
            ))}
            {filteredTxns.length === 0 && !txnLoading && <p className="text-sm text-muted-foreground text-center py-8">No transactions</p>}
          </CardContent>
        </Card>

        {/* Payable */}
        <Card className="border-[#e4e6ef]">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base" style={heading}>Payable</CardTitle>
              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium" style={mono}>{formatBDT(totalPayable)}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[350px] overflow-y-auto">
            {(payables || []).filter(p => Number(p.total_amount) - Number(p.paid_amount) > 0).slice(0, 8).map((p) => {
              const remaining = Number(p.total_amount) - Number(p.paid_amount);
              const overdue = p.due_date && isBefore(parseISO(p.due_date), new Date());
              return (
                <div key={p.id} className="py-2 border-b border-[#e4e6ef] last:border-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{p.party_name}</span>
                    <span className="text-sm font-semibold text-red-600" style={mono}>{formatBDT(remaining)}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-muted-foreground">{p.description || p.category}</span>
                    {overdue && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">⚠️ Overdue</span>}
                  </div>
                </div>
              );
            })}
            {(payables || []).filter(p => Number(p.total_amount) - Number(p.paid_amount) > 0).length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No payables</p>}
          </CardContent>
        </Card>

        {/* Receivable + Accounts */}
        <div className="space-y-4">
          <Card className="border-[#e4e6ef]">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm" style={heading}>Receivable</CardTitle>
                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium" style={mono}>{formatBDT(totalReceivable)}</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {(receivables || []).filter(r => r.status !== "received").slice(0, 4).map((r) => (
                <div key={r.id} className="flex justify-between items-center text-sm py-1">
                  <span className="truncate">{r.description || r.source}</span>
                  <span className="text-emerald-600 font-medium" style={mono}>{formatBDT(Number(r.amount))}</span>
                </div>
              ))}
              {(receivables || []).filter(r => r.status !== "received").length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No pending receivables</p>}
            </CardContent>
          </Card>
          <Card className="border-[#e4e6ef]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm" style={heading}>Cash Accounts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {(accounts || []).slice(0, 4).map((a) => (
                  <div key={a.id} className="bg-[#f4f5f9] rounded-lg p-2.5 text-center">
                    <p className="text-xs text-muted-foreground capitalize">{a.name}</p>
                    <p className="text-sm font-semibold mt-0.5" style={mono}>{formatBDT(Number(a.balance || 0))}</p>
                  </div>
                ))}
              </div>
              {(accounts || []).length > 0 && (
                <div className="mt-2 pt-2 border-t text-center">
                  <span className="text-xs text-muted-foreground">Total: </span>
                  <span className="text-sm font-bold" style={mono}>{formatBDT(totalCash)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
