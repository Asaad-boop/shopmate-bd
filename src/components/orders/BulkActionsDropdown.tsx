import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  CheckCircle2, X, FileText, Package, ClipboardList,
  Truck, RefreshCw, Download,
  Copy, Upload, Trash2, StickyNote, PackageCheck, MoreVertical
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
  const [manuallyDismissed, setManuallyDismissed] = useState(false);

  // Auto-open when orders are selected, auto-close when deselected
  useState;
  const prevCount = useRef(selectedCount);
  if (selectedCount > 0 && prevCount.current === 0) {
    // Selection just started — reset dismiss flag
    if (manuallyDismissed) setManuallyDismissed(false);
  }
  prevCount.current = selectedCount;

  const effectiveOpen = selectedCount > 0 && !manuallyDismissed ? true : open;

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
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
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

      <Dialog open={effectiveOpen} onOpenChange={(v) => { if (!v) { setManuallyDismissed(true); setOpen(false); } else { setOpen(true); } setConfirmStatus(null); }}>
        <DialogContent className="max-w-md p-0">
          <DialogHeader className="px-6 py-4 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-base">Bulk Actions</DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  {selectedCount} orders selected
                </DialogDescription>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={onSelectAll}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted transition-colors"
                >
                  ✓ Select All
                </button>
                {selectedCount > 0 && (
                  <button
                    onClick={onDeselect}
                    className="text-xs font-medium text-destructive/60 hover:text-destructive px-1.5 py-1 rounded-md hover:bg-destructive/10 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto">
            {/* Section 1: Print */}
            <div className="px-6 pt-4 pb-3">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
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
                      className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Icon className={cn("w-3.5 h-3.5", action.color)} />
                      {action.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mx-6 h-px bg-border" />

            {/* Section 2: Status */}
            <div className="px-6 pt-4 pb-3">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                ↻ Status Update
              </p>
              {selectedCount > 0 && (
                <p className="text-[10px] text-muted-foreground mb-2">
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
                        "flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-xs font-medium transition-all",
                        isConfirming
                          ? "bg-foreground text-background"
                          : "text-foreground hover:bg-muted",
                        "disabled:opacity-40 disabled:cursor-not-allowed"
                      )}
                    >
                      <Icon className={cn("w-3.5 h-3.5", isConfirming ? "text-background" : action.color)} />
                      <span className="flex-1 text-left">
                        {isConfirming ? `${selectedCount} orders → ${action.label}?` : action.label}
                      </span>
                      {isConfirming && (
                        <span className="text-[10px] bg-background/20 px-1.5 py-0.5 rounded font-bold">
                          Confirm ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mx-6 h-px bg-border" />

            {/* Section 3: Courier */}
            <div className="px-6 pt-4 pb-3">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                🚚 Courier Services
              </p>
              <div className="space-y-0.5">
                {couriers.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => { onCourier(c.key); setOpen(false); }}
                    disabled={selectedCount === 0}
                    className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span className={cn("w-5 h-5 rounded text-[10px] font-bold inline-flex items-center justify-center", c.bg)}>
                      {c.letter}
                    </span>
                    Send to {c.name}
                  </button>
                ))}
                <button
                  className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Refresh Courier Status
                </button>
              </div>
            </div>

            <div className="mx-6 h-px bg-border" />

            {/* Section 4: Tools & Export */}
            <div className="px-6 pt-4 pb-4">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                ⬇️ Tools & Export
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => { onExport?.(); setOpen(false); }}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium text-foreground hover:bg-muted transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-500" />
                  Excel
                </button>
                <button
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium text-foreground hover:bg-muted transition-colors"
                >
                  <Copy className="w-3.5 h-3.5 text-blue-500" />
                  Duplicates
                </button>
                <button
                  onClick={() => { onExport?.(); setOpen(false); }}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium text-foreground hover:bg-muted transition-colors"
                >
                  <Upload className="w-3.5 h-3.5 text-indigo-500" />
                  Export CSV
                </button>
                <button
                  disabled={selectedCount === 0}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
