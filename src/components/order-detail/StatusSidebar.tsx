import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2, PhoneOff, Pause, Wallet, XCircle, CircleCheck, Zap, Save } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatusSidebarProps {
  currentStatus: string;
  onStatusChange: (status: string) => void;
  onSave: () => void;
  isSaving: boolean;
}

const STATUS_BUTTONS = [
  { key: "processing", label: "Processing", icon: Clock, theme: "amber" },
  { key: "confirm", label: "Good", icon: CircleCheck, theme: "emerald" },
  { key: "good_but_no_response", label: "Good But No Response", icon: CheckCircle2, theme: "slate" },
  { key: "no_response", label: "No Response", icon: PhoneOff, theme: "slate" },
  { key: "on_hold", label: "On Hold", icon: Pause, theme: "yellow" },
  { key: "advance_payment", label: "Advance Payment", icon: Wallet, theme: "blue" },
] as const;

const themeMap: Record<string, { bg: string; border: string; ring: string; dot: string }> = {
  amber: { bg: "bg-amber-50", border: "border-amber-300", ring: "ring-amber-200", dot: "bg-amber-500" },
  emerald: { bg: "bg-emerald-50", border: "border-emerald-300", ring: "ring-emerald-200", dot: "bg-emerald-500" },
  slate: { bg: "bg-slate-100", border: "border-slate-300", ring: "ring-slate-200", dot: "bg-slate-500" },
  yellow: { bg: "bg-yellow-50", border: "border-yellow-300", ring: "ring-yellow-200", dot: "bg-yellow-500" },
  blue: { bg: "bg-blue-50", border: "border-blue-300", ring: "ring-blue-200", dot: "bg-blue-500" },
  red: { bg: "bg-red-50", border: "border-red-300", ring: "ring-red-200", dot: "bg-red-500" },
};

export function StatusSidebar({ currentStatus, onStatusChange, onSave, isSaving }: StatusSidebarProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="w-4 h-4 text-[#6c63ff]" /> Order Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 2x2 grid */}
        <div className="grid grid-cols-2 gap-2">
          {STATUS_BUTTONS.map((s) => {
            const isActive = currentStatus === s.key;
            const t = themeMap[s.theme];
            return (
              <button
                key={s.key}
                onClick={() => onStatusChange(s.key)}
                className={cn(
                  "relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-xs font-medium transition-all",
                  isActive
                    ? `${t.bg} ${t.border} ring-2 ${t.ring}`
                    : "border-border bg-background hover:border-muted-foreground/20 hover:bg-muted/30"
                )}
              >
                {isActive && (
                  <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#6c63ff] flex items-center justify-center">
                    <CheckCircle2 className="w-3 h-3 text-white" />
                  </div>
                )}
                <div className={cn("w-2.5 h-2.5 rounded-full", t.dot)} />
                <s.icon className="w-4 h-4" />
                <span className="text-center leading-tight">{s.label}</span>
              </button>
            );
          })}
        </div>

        {/* Cancel button full width */}
        <button
          onClick={() => onStatusChange("cancel")}
          className={cn(
            "w-full flex items-center justify-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-all",
            currentStatus === "cancel"
              ? "bg-red-50 border-red-300 ring-2 ring-red-200 text-red-700"
              : "border-border hover:border-red-200 hover:bg-red-50/50 text-red-600"
          )}
        >
          <XCircle className="w-4 h-4" />
          🚫 Cancel Order
        </button>

        {/* Save button */}
        <Button
          onClick={onSave}
          disabled={isSaving}
          className="w-full h-11 rounded-xl bg-gradient-to-r from-[#6c63ff] to-[#5a52d5] hover:from-[#5a52d5] hover:to-[#4a42c5] text-white font-semibold shadow-lg shadow-[#6c63ff]/20 hover:shadow-xl hover:shadow-[#6c63ff]/30 transition-all hover:-translate-y-0.5"
        >
          <Save className="w-4 h-4 mr-2" /> Save Order
        </Button>
      </CardContent>
    </Card>
  );
}
