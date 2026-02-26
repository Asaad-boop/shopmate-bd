import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatBDT, formatDate } from "@/lib/format";
import { ArrowRightLeft, ExternalLink, ChevronRight, PackageCheck, Lock, Loader2 } from "lucide-react";
import { EXCHANGE_STATUS_CONFIG, type ExchangeRequest } from "@/hooks/use-exchanges";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Props {
  exchanges: ExchangeRequest[];
  orderId: string;
}

export function ExchangeSummaryCard({ exchanges, orderId }: Props) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [closeModal, setCloseModal] = useState<string | null>(null);
  const [closeNote, setCloseNote] = useState("");

  // Mark Return Received mutation
  const returnReceivedMut = useMutation({
    mutationFn: async (exchangeId: string) => {
      const { error } = await supabase
        .from("exchange_requests")
        .update({ reverse_received_at: new Date().toISOString(), status: "reverse_received", updated_at: new Date().toISOString() })
        .eq("id", exchangeId);
      if (error) throw error;

      // Stock IN for returned items with condition 'good'
      const { data: items } = await supabase.from("exchange_items").select("*").eq("exchange_id", exchangeId);
      if (items) {
        for (const item of items) {
          if (item.direction === "return" && item.product_id && item.condition === "good") {
            await supabase.from("inventory_ledger").insert({
              product_id: item.product_id,
              sku: item.sku || "",
              txn_type: "return_good",
              qty_in: item.quantity,
              reference_type: "exchange",
              reference_id: exchangeId,
              note: `Exchange return received: ${item.product_name}`,
            });
          }
        }
      }

      await supabase.from("audit_logs").insert({
        entity_type: "exchange",
        entity_id: exchangeId,
        action: "exchange_return_received",
        after_json: { status: "reverse_received" },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order-exchanges"] });
      qc.invalidateQueries({ queryKey: ["exchanges"] });
      qc.invalidateQueries({ queryKey: ["stock-on-hand"] });
      toast({ title: "Return received & stock updated" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  // Close Exchange Case mutation
  const closeCaseMut = useMutation({
    mutationFn: async ({ exchangeId, note }: { exchangeId: string; note: string }) => {
      const { error } = await supabase
        .from("exchange_requests")
        .update({ status: "completed", completed_at: new Date().toISOString(), notes: note, updated_at: new Date().toISOString() })
        .eq("id", exchangeId);
      if (error) throw error;

      await supabase.from("audit_logs").insert({
        entity_type: "exchange",
        entity_id: exchangeId,
        action: "exchange_case_closed",
        after_json: { status: "completed", close_note: note },
      });
    },
    onSuccess: () => {
      setCloseModal(null);
      setCloseNote("");
      qc.invalidateQueries({ queryKey: ["order-exchanges"] });
      qc.invalidateQueries({ queryKey: ["exchanges"] });
      toast({ title: "Exchange case closed" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  if (!exchanges || exchanges.length === 0) return null;

  const totalAdjustment = exchanges.reduce((s, e) => s + (e.price_difference || 0), 0);
  const totalCourierLoss = exchanges.reduce((s, e) => s + (e.courier_cost_total || 0), 0);
  const totalDamageLoss = exchanges.reduce((s, e) => s + (e.damaged_loss || 0), 0);

  const getCaseStatus = (ex: ExchangeRequest) => {
    if (ex.status === "completed" || ex.status === "cancelled") return "CLOSED";
    if (ex.status === "pending") return "OPEN";
    return "IN_PROGRESS";
  };

  const isReturnPending = (ex: ExchangeRequest) => !ex.reverse_received_at && ex.status !== "completed" && ex.status !== "cancelled";

  return (
    <>
      <Card className="border-amber-200/50 dark:border-amber-800/30">
        <CardHeader className="pb-2 px-4 pt-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-amber-600" />
            Exchange Cases
            <Badge variant="outline" className="text-[10px] ml-auto border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:border-amber-700">
              {exchanges.length} case{exchanges.length > 1 ? "s" : ""}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-muted/50 p-2 text-center">
              <p className="text-[10px] text-muted-foreground">Price Adj.</p>
              <p className={cn("text-xs font-bold", totalAdjustment > 0 ? "text-amber-600" : totalAdjustment < 0 ? "text-emerald-600" : "")}>
                {totalAdjustment > 0 ? "+" : ""}{formatBDT(totalAdjustment)}
              </p>
            </div>
            <div className="rounded-lg bg-muted/50 p-2 text-center">
              <p className="text-[10px] text-muted-foreground">Courier Loss</p>
              <p className="text-xs font-bold text-destructive">{formatBDT(totalCourierLoss)}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-2 text-center">
              <p className="text-[10px] text-muted-foreground">Damage Loss</p>
              <p className="text-xs font-bold text-destructive">{formatBDT(totalDamageLoss)}</p>
            </div>
          </div>

          {/* Exchange list */}
          <div className="space-y-2">
            {exchanges.map((ex) => {
              const cfg = EXCHANGE_STATUS_CONFIG[ex.status] || EXCHANGE_STATUS_CONFIG.pending;
              const caseStatus = getCaseStatus(ex);
              const returnPending = isReturnPending(ex);

              return (
                <div key={ex.id} className="rounded-xl border border-border/50 overflow-hidden">
                  <div
                    className="flex items-center gap-2 p-2.5 hover:bg-muted/30 transition-colors cursor-pointer group"
                    onClick={() => navigate("/exchanges")}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-semibold">{ex.exchange_number}</span>
                        <Badge className={cn("text-[9px] px-1.5 py-0", cfg.color)}>{cfg.emoji} {cfg.label}</Badge>
                        <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0",
                          caseStatus === "OPEN" ? "border-amber-300 text-amber-700" :
                          caseStatus === "IN_PROGRESS" ? "border-blue-300 text-blue-700" :
                          "border-emerald-300 text-emerald-700"
                        )}>
                          {caseStatus}
                        </Badge>
                        {returnPending && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-orange-300 bg-orange-50 text-orange-700 dark:bg-orange-950/30">
                            Return Pending
                          </Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {ex.reason} · {formatDate(ex.created_at)}
                        {ex.price_difference !== 0 && (
                          <span className={cn("ml-1 font-medium", ex.price_difference > 0 ? "text-amber-600" : "text-emerald-600")}>
                            ({ex.price_difference > 0 ? "+" : ""}{formatBDT(ex.price_difference)})
                          </span>
                        )}
                      </p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </div>

                  {/* Action buttons */}
                  {caseStatus !== "CLOSED" && (
                    <div className="flex gap-1.5 px-2.5 pb-2.5">
                      {returnPending && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-[10px] h-7 rounded-lg gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                          disabled={returnReceivedMut.isPending}
                          onClick={(e) => { e.stopPropagation(); returnReceivedMut.mutate(ex.id); }}
                        >
                          {returnReceivedMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <PackageCheck className="w-3 h-3" />}
                          Mark Return Received
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-[10px] h-7 rounded-lg gap-1 border-muted-foreground/30 text-muted-foreground"
                        onClick={(e) => { e.stopPropagation(); setCloseModal(ex.id); }}
                      >
                        <Lock className="w-3 h-3" /> Close Case
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <Button variant="outline" size="sm" className="w-full text-xs h-8 rounded-xl gap-1.5"
            onClick={() => navigate("/exchanges")}>
            <ExternalLink className="w-3 h-3" /> View All Exchanges
          </Button>
        </CardContent>
      </Card>

      {/* Close Case Modal */}
      <Dialog open={!!closeModal} onOpenChange={() => { setCloseModal(null); setCloseNote(""); }}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm">Close Exchange Case</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              className="text-sm rounded-xl"
              rows={3}
              value={closeNote}
              onChange={(e) => setCloseNote(e.target.value)}
              placeholder="Closing note (required, min 5 chars)..."
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => { setCloseModal(null); setCloseNote(""); }}>Cancel</Button>
              <Button
                className="flex-1 rounded-xl"
                disabled={closeNote.trim().length < 5 || closeCaseMut.isPending}
                onClick={() => closeModal && closeCaseMut.mutate({ exchangeId: closeModal, note: closeNote })}
              >
                {closeCaseMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Close Case"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
