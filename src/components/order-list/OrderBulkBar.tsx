import { X, Package, Truck, Send, CheckCircle2, RotateCcw, XCircle, Printer, FileText, Barcode, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  selectedCount: number;
  onClear: () => void;
  onAction: (action: string) => void;
}

const STATUS_PILLS = [
  { key: "packed", label: "Packed", icon: Package, cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 hover:bg-blue-500/20" },
  { key: "rts", label: "RTS", icon: Send, cls: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20 hover:bg-cyan-500/20" },
  { key: "shipped", label: "Shipped", icon: Truck, cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/20" },
  { key: "delivered", label: "Delivered", icon: CheckCircle2, cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20" },
  { key: "returned", label: "Returned", icon: RotateCcw, cls: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 hover:bg-red-500/20" },
  { key: "cancel", label: "Cancel", icon: XCircle, cls: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20 hover:bg-slate-500/20" },
];

const PRINT_PILLS = [
  { key: "print_invoice", label: "Invoice", icon: FileText },
  { key: "print_picking", label: "Picking", icon: ClipboardList },
  { key: "print_packing", label: "Packing", icon: Printer },
  { key: "print_barcode", label: "Barcode", icon: Barcode },
];

export function OrderBulkBar({ selectedCount, onClear, onAction }: Props) {
  if (selectedCount === 0) return null;

  return (
    <div
      className={cn(
        "fixed bottom-4 left-1/2 -translate-x-1/2 z-50",
        "bg-card border border-border rounded-2xl",
        "shadow-[0_8px_40px_-8px_hsl(var(--foreground)/0.15)]",
        "dark:shadow-[0_8px_40px_-8px_hsl(0_0%_0%/0.5)]",
        "px-3 py-2.5 flex items-center gap-2 flex-wrap max-w-[95vw]",
        "animate-[slide-up_0.25s_cubic-bezier(0.34,1.56,0.64,1)]"
      )}
    >
      {/* Selected count */}
      <div className="flex items-center gap-1.5 pr-2.5 border-r border-border">
        <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-md bg-primary text-primary-foreground text-[11px] font-bold">
          {selectedCount}
        </span>
        <span className="text-xs font-medium text-foreground whitespace-nowrap">selected</span>
        <button
          onClick={onClear}
          className="w-5 h-5 rounded-full bg-muted hover:bg-destructive/10 hover:text-destructive flex items-center justify-center transition-colors ml-0.5"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Quick status pills */}
      <div className="flex items-center gap-1 pr-2.5 border-r border-border">
        {STATUS_PILLS.map(pill => {
          const Icon = pill.icon;
          return (
            <button
              key={pill.key}
              onClick={() => onAction(pill.key)}
              className={cn(
                "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all duration-150",
                pill.cls
              )}
            >
              <Icon className="w-3 h-3" />
              {pill.label}
            </button>
          );
        })}
      </div>

      {/* Print pills */}
      <div className="flex items-center gap-1 pr-2.5 border-r border-border">
        {PRINT_PILLS.map(pill => {
          const Icon = pill.icon;
          return (
            <button
              key={pill.key}
              onClick={() => onAction(pill.key)}
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted border border-transparent hover:border-border transition-all duration-150"
            >
              <Icon className="w-3 h-3" />
              {pill.label}
            </button>
          );
        })}
      </div>

      {/* Send to Courier */}
      <Button
        size="sm"
        className="h-8 text-[11px] gap-1.5 rounded-lg font-semibold"
        onClick={() => onAction("send_courier")}
      >
        <Truck className="w-3.5 h-3.5" />
        Send to Courier
      </Button>
    </div>
  );
}
