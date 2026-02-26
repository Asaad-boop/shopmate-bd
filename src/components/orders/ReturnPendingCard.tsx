import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PackageCheck, Clock, Package } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { type ReturnCase } from "@/hooks/use-return-cases";
import { ReturnReceivedModal } from "./ReturnReceivedModal";

interface Props {
  returnCases: ReturnCase[];
}

export function ReturnPendingCard({ returnCases }: Props) {
  const [receiveModal, setReceiveModal] = useState<ReturnCase | null>(null);

  const pending = returnCases.filter((rc) => rc.status === "pending_return");
  const received = returnCases.filter((rc) => rc.status === "received");

  if (returnCases.length === 0) return null;

  return (
    <>
      <Card className="border-orange-200/50 dark:border-orange-800/30">
        <CardHeader className="pb-2 px-4 pt-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Package className="w-4 h-4 text-orange-600" />
            Return Cases
            {pending.length > 0 && (
              <Badge className="text-[9px] px-1.5 py-0 ml-auto bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950/40 dark:border-orange-700">
                {pending.length} pending
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          {returnCases.map((rc) => {
            const isPending = rc.status === "pending_return";
            const totalExpected = rc.expected_items.reduce((s, i) => s + i.quantity, 0);
            const totalReceived = rc.received_items.reduce((s, i) => s + i.quantity, 0);
            const timePending = isPending
              ? Math.round((Date.now() - new Date(rc.created_at).getTime()) / (1000 * 60 * 60))
              : 0;

            return (
              <div key={rc.id} className={cn(
                "rounded-xl border p-3 space-y-2",
                isPending ? "border-orange-200 bg-orange-50/50 dark:bg-orange-950/20 dark:border-orange-800" : "border-border/50"
              )}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={cn("text-[9px] px-1.5 py-0",
                      isPending ? "bg-orange-100 text-orange-700" : "bg-emerald-100 text-emerald-700"
                    )}>
                      {isPending ? "⏳ Pending Return" : "✅ Received"}
                    </Badge>
                    {rc.exchange_case_id && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-amber-300 text-amber-700">
                        Exchange
                      </Badge>
                    )}
                  </div>
                  {isPending && timePending > 0 && (
                    <Tooltip>
                      <TooltipTrigger>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {timePending}h ago
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="text-xs">
                        Created: {formatDateTime(rc.created_at)}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>

                {/* Expected items */}
                <div className="space-y-1">
                  {rc.expected_items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground truncate flex-1">{item.product_name}</span>
                      <span className="font-mono shrink-0 ml-2">
                        {isPending ? `${item.quantity} expected` : `${rc.received_items[i]?.quantity || 0}/${item.quantity}`}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Action */}
                {isPending && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-[10px] h-7 rounded-lg gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                    onClick={() => setReceiveModal(rc)}
                  >
                    <PackageCheck className="w-3 h-3" />
                    Mark Return Received
                  </Button>
                )}

                {!isPending && rc.condition && (
                  <p className="text-[10px] text-muted-foreground">
                    Condition: <span className="font-medium capitalize">{rc.condition}</span>
                    {rc.received_at && ` · Received ${formatDateTime(rc.received_at)}`}
                  </p>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {receiveModal && (
        <ReturnReceivedModal
          open={!!receiveModal}
          onOpenChange={(open) => !open && setReceiveModal(null)}
          returnCase={receiveModal}
        />
      )}
    </>
  );
}
