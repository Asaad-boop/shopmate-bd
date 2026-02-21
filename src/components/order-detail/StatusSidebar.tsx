import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Clock, CheckCircle2, PhoneOff, Pause, Wallet, XCircle, CircleCheck, Zap } from "lucide-react";

const WEB_STATUSES = [
  { key: "processing", label: "Processing", icon: Clock, dotColor: "bg-orange-500" },
  { key: "good_but_no_response", label: "Good", icon: CheckCircle2, dotColor: "bg-emerald-500" },
  { key: "good_no_response", label: "Good But No Response", icon: CheckCircle2, dotColor: "bg-slate-600" },
  { key: "no_response", label: "No Response", icon: PhoneOff, dotColor: "bg-slate-500" },
  { key: "on_hold", label: "On Hold", icon: Pause, dotColor: "bg-amber-500" },
  { key: "advance_payment", label: "Advance Payment", icon: Wallet, dotColor: "bg-blue-500" },
  { key: "cancel", label: "Cancel", icon: XCircle, dotColor: "bg-red-500" },
];

interface StatusSidebarProps {
  orderId: string;
  currentStatus: string | null;
  onSave: () => void;
  isSaving: boolean;
}

export function StatusSidebar({ orderId, currentStatus, onSave, isSaving }: StatusSidebarProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const statusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const oldStatus = currentStatus;
      // Update order
      const { error } = await supabase
        .from("orders")
        .update({ web_order_status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", orderId);
      if (error) throw error;

      // Log activity
      await supabase.from("order_activity_log" as any).insert({
        order_id: orderId,
        action: "status_change",
        old_status: oldStatus,
        new_status: newStatus,
        done_by: "admin",
      });
    },
    onSuccess: () => {
      toast({ title: "Status updated" });
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["order-activity", orderId] });
    },
    onError: (err: any) =>
      toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="w-4 h-4 text-muted-foreground" />
          Order Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {WEB_STATUSES.map((s) => {
          const Icon = s.icon;
          const isActive = currentStatus === s.key;
          return (
            <button
              key={s.key}
              onClick={() => !isActive && statusMutation.mutate(s.key)}
              disabled={statusMutation.isPending}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left",
                isActive
                  ? "bg-foreground text-background shadow-sm"
                  : "hover:bg-muted/80 text-foreground"
              )}
            >
              <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", s.dotColor)} />
              <Icon className="w-4 h-4 shrink-0" />
              <span>{s.label}</span>
            </button>
          );
        })}

        <Button
          onClick={onSave}
          disabled={isSaving}
          className="w-full mt-4 bg-foreground text-background hover:bg-foreground/90"
        >
          {isSaving ? "Saving..." : "Save Order"}
        </Button>
      </CardContent>
    </Card>
  );
}
