import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  MoreVertical, CheckCircle2, X, FileText, Package, ClipboardList,
  FileSpreadsheet, Truck, Rocket, Zap, RefreshCw, Download,
  Copy, Upload, Trash2, StickyNote, Tag, PackageCheck
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BulkActionsDropdownProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselect: () => void;
  onStatusChange: (status: string) => void;
  onPrint: (type: "invoice" | "picking" | "packing" | "barcode") => void;
  onCourier: (courier: string) => void;
  onExport?: () => void;
  changing?: boolean;
}

export function BulkActionsDropdown({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselect,
  onStatusChange,
  onPrint,
  onCourier,
  onExport,
  changing,
}: BulkActionsDropdownProps) {
  const [open, setOpen] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState<string | null>(null);

  const handleStatusClick = (status: string) => {
    if (confirmStatus === status) {
      onStatusChange(status);
      setConfirmStatus(null);
      setOpen(false);
    } else {
      setConfirmStatus(status);
    }
  };

  const statusActions = [
    { key: "packed", label: "Mark as Packed", icon: PackageCheck, color: "text-blue-600" },
    { key: "shipped", label: "Send to Shipping", icon: Truck, color: "text-indigo-600" },
    { key: "delivered", label: "Mark as Delivered", icon: CheckCircle2, color: "text-emerald-600" },
    { key: "returned", label: "Mark as Returned", icon: RefreshCw, color: "text-amber-600" },
    { key: "damage_return", label: "Mark as Damage Return", icon: Trash2, color: "text-orange-600" },
    { key: "cancelled", label: "Cancel Orders", icon: X, color: "text-red-500" },
  ];

  const printActions = [
    { key: "invoice" as const, label: "Invoice", icon: FileText, color: "text-blue-500" },
    { key: "barcode" as const, label: "Sticker", icon: StickyNote, color: "text-purple-500" },
    { key: "picking" as const, label: "Picking", icon: ClipboardList, color: "text-emerald-500" },
    { key: "packing" as const, label: "Packing Slip", icon: Package, color: "text-amber-500" },
  ];

  const couriers = [
    { key: "pathao", name: "Pathao", letter: "P", bg: "bg-red-100 text-red-700" },
    { key: "steadfast", name: "Steadfast", letter: "S", bg: "bg-blue-100 text-blue-700" },
    { key: "redx", name: "RedX", letter: "X", bg: "bg-orange-100 text-orange-700" },
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "gap-1.5 rounded-lg border transition-all",
            selectedCount > 0
              ? "border-primary/40 text-primary hover:bg-primary/5 hover:border-primary"
              : "text-muted-foreground"
          )}
        >
          <MoreVertical className="w-4 h-4" />
          Actions
          {selectedCount > 0 && (
            <span className="ml-1 bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {selectedCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[300px] p-0 rounded-xl shadow-[0_12px_48px_-8px_rgba(0,0,0,0.15)] border bg-white z-50"
      >
        <div className="max-h-[80vh] overflow-y-auto">
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="inline-flex items-center gap-1.5 bg-slate-800 text-white text-xs font-semibold px-3 py-1 rounded-full">
              {selectedCount} selected
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={onSelectAll}
                className="text-xs font-medium text-slate-500 hover:text-slate-800 px-2 py-1 rounded-md hover:bg-slate-100 transition-colors"
              >
                ✓ Select All
              </button>
              {selectedCount > 0 && (
                <button
                  onClick={onDeselect}
                  className="text-xs font-medium text-red-400 hover:text-red-600 px-1.5 py-1 rounded-md hover:bg-red-50 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Section 1: Print */}
          <div className="px-4 pt-3 pb-2">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              🖨️ Print Options
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {printActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.key}
                    onClick={() => { onPrint(action.key); setOpen(false); }}
                    disabled={selectedCount === 0}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Icon className={cn("w-3.5 h-3.5", action.color)} />
                    {action.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mx-4 h-px bg-slate-100" />

          {/* Section 2: Status */}
          <div className="px-4 pt-3 pb-2">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              ↻ Status Update
            </p>
            {selectedCount > 0 && (
              <p className="text-[10px] text-slate-400 mb-2">
                Update status ({selectedCount} selected)
              </p>
            )}
            <div className="space-y-0.5">
              {statusActions.map((action) => {
                const Icon = action.icon;
                const isConfirming = confirmStatus === action.key;
                return (
                  <button
                    key={action.key}
                    onClick={() => handleStatusClick(action.key)}
                    disabled={selectedCount === 0 || changing}
                    className={cn(
                      "flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs font-medium transition-all",
                      isConfirming
                        ? "bg-slate-800 text-white"
                        : "text-slate-700 hover:bg-slate-50",
                      "disabled:opacity-40 disabled:cursor-not-allowed"
                    )}
                  >
                    <Icon className={cn("w-3.5 h-3.5", isConfirming ? "text-white" : action.color)} />
                    <span className="flex-1 text-left">
                      {isConfirming ? `${selectedCount} orders → ${action.label}?` : action.label}
                    </span>
                    {isConfirming && (
                      <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-bold">
                        Confirm ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mx-4 h-px bg-slate-100" />

          {/* Section 3: Courier */}
          <div className="px-4 pt-3 pb-2">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              🚚 Courier Services
            </p>
            <div className="space-y-0.5">
              {couriers.map((c) => (
                <button
                  key={c.key}
                  onClick={() => { onCourier(c.key); setOpen(false); }}
                  disabled={selectedCount === 0}
                  className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span className={cn("w-5 h-5 rounded text-[10px] font-bold inline-flex items-center justify-center", c.bg)}>
                    {c.letter}
                  </span>
                  Send to {c.name}
                </button>
              ))}
              <button
                className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                Refresh Courier Status
              </button>
            </div>
          </div>

          <div className="mx-4 h-px bg-slate-100" />

          {/* Section 4: Tools & Export */}
          <div className="px-4 pt-3 pb-3">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              ⬇️ Tools & Export
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => { onExport?.(); setOpen(false); }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-emerald-500" />
                Excel
              </button>
              <button
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Copy className="w-3.5 h-3.5 text-blue-500" />
                Duplicates
              </button>
              <button
                onClick={() => { onExport?.(); setOpen(false); }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Upload className="w-3.5 h-3.5 text-indigo-500" />
                Export CSV
              </button>
              <button
                disabled={selectedCount === 0}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
