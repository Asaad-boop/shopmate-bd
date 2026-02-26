import { cn } from "@/lib/utils";
import {
  Clock, Package, Truck, CheckCircle, RotateCcw, ArrowLeftRight,
  XCircle, AlertTriangle, Send
} from "lucide-react";

interface OrdersQuickStatsProps {
  counts: Record<string, number>;
  activeStatus: string;
  onStatusClick: (status: string) => void;
}

const STAT_ITEMS = [
  { key: "pending", label: "Pending", icon: Clock, bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", activeBg: "bg-blue-600", activeText: "text-white" },
  { key: "packed", label: "Packed", icon: Package, bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200", activeBg: "bg-indigo-600", activeText: "text-white" },
  { key: "ready_to_ship", label: "RTS", icon: Send, bg: "bg-cyan-50", text: "text-cyan-700", border: "border-cyan-200", activeBg: "bg-cyan-600", activeText: "text-white" },
  { key: "shipped", label: "Shipped", icon: Truck, bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", activeBg: "bg-purple-600", activeText: "text-white" },
  { key: "delivered", label: "Delivered", icon: CheckCircle, bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", activeBg: "bg-emerald-600", activeText: "text-white" },
  { key: "returned", label: "Returned", icon: RotateCcw, bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-300", activeBg: "bg-slate-700", activeText: "text-white" },
  { key: "exchanged", label: "Exchanged", icon: ArrowLeftRight, bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", activeBg: "bg-orange-600", activeText: "text-white" },
  { key: "cancelled", label: "Cancelled", icon: XCircle, bg: "bg-red-50", text: "text-red-700", border: "border-red-200", activeBg: "bg-red-600", activeText: "text-white" },
  { key: "damage_return", label: "Damage", icon: AlertTriangle, bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200", activeBg: "bg-rose-600", activeText: "text-white" },
];

export function OrdersQuickStats({ counts, activeStatus, onStatusClick }: OrdersQuickStatsProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto px-6 py-3 border-b bg-card" style={{ scrollbarWidth: "none" }}>
      {/* All pill */}
      <button
        onClick={() => onStatusClick("all")}
        className={cn(
          "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all duration-200 whitespace-nowrap shrink-0",
          activeStatus === "all"
            ? "bg-foreground text-background border-foreground shadow-md"
            : "bg-muted/50 text-foreground border-border hover:bg-muted hover:shadow-sm"
        )}
      >
        <span className="text-sm">📋</span>
        All
        <span className={cn(
          "min-w-[22px] h-5 px-1.5 rounded-md text-[11px] font-bold flex items-center justify-center",
          activeStatus === "all" ? "bg-white/20" : "bg-foreground/10"
        )}>
          {counts.all || 0}
        </span>
      </button>

      <div className="w-px h-7 bg-border shrink-0" />

      {STAT_ITEMS.map((item) => {
        const Icon = item.icon;
        const count = counts[item.key] || 0;
        const isActive = activeStatus === item.key;

        return (
          <button
            key={item.key}
            onClick={() => onStatusClick(item.key)}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all duration-200 whitespace-nowrap shrink-0",
              isActive
                ? `${item.activeBg} ${item.activeText} border-transparent shadow-md scale-[1.02]`
                : `${item.bg} ${item.text} ${item.border} hover:shadow-sm hover:scale-[1.01]`
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {item.label}
            <span className={cn(
              "min-w-[22px] h-5 px-1.5 rounded-md text-[11px] font-bold flex items-center justify-center",
              isActive ? "bg-white/25" : "bg-black/[0.06]"
            )}>
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
