import { Skeleton } from "@/components/ui/skeleton";
import { formatBDT } from "@/lib/format";
import { TrendingUp, TrendingDown, DollarSign, Wallet } from "lucide-react";

interface Props {
  stats: {
    income: number; expense: number; netProfit: number; profitMargin: number;
    cashInHand: number; incomeChange: number; expenseChange: number;
  } | undefined;
  isLoading: boolean;
}

const mono = { fontFamily: "'DM Mono', monospace" };
const heading = { fontFamily: "'Playfair Display', serif" };

function ChangeBadge({ value, invert }: { value: number; invert?: boolean }) {
  const positive = invert ? value < 0 : value > 0;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${positive ? "bg-white/20 text-white" : "bg-white/20 text-white"}`} style={mono}>
      {value > 0 ? "↑" : "↓"} {Math.abs(value)}%
    </span>
  );
}

export function HeroCards({ stats, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[130px] rounded-2xl" />)}
      </div>
    );
  }

  const cards = [
    {
      label: "Total Income", value: stats?.income || 0, icon: TrendingUp,
      gradient: "from-emerald-500 to-emerald-700", change: stats?.incomeChange || 0, emoji: "💚",
    },
    {
      label: "Total Expenses", value: stats?.expense || 0, icon: TrendingDown,
      gradient: "from-red-500 to-red-700", change: stats?.expenseChange || 0, invert: true, emoji: "❤️",
    },
    {
      label: "Net Profit", value: stats?.netProfit || 0, icon: DollarSign,
      gradient: "from-blue-500 to-blue-700", sub: `${stats?.profitMargin || 0}% margin`, emoji: "💙",
    },
    {
      label: "Cash in Hand", value: stats?.cashInHand || 0, icon: Wallet,
      gradient: "from-purple-500 to-purple-700", sub: "bKash + Bank + Cash", emoji: "💜",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div key={c.label} className={`bg-gradient-to-br ${c.gradient} rounded-2xl p-5 text-white shadow-lg animate-fade-in`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium opacity-90">{c.emoji} {c.label}</span>
            <c.icon className="w-5 h-5 opacity-70" />
          </div>
          <div className="text-2xl font-bold mb-1" style={heading}>{formatBDT(c.value)}</div>
          <div className="flex items-center gap-2">
            {c.change !== undefined && c.sub === undefined && <ChangeBadge value={c.change} invert={c.invert} />}
            {c.sub && <span className="text-xs opacity-80">{c.sub}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
