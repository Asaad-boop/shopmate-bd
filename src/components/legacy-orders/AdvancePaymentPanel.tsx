import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ConfirmCriticalAction } from "@/components/security/ConfirmCriticalAction";
import { usePostAdvance, useReverseAndRepostAdvance } from "@/hooks/use-advance-posting";
import { formatBDT2 } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Wallet, CheckCircle, AlertTriangle, RotateCcw, ArrowRight } from "lucide-react";

const ADVANCE_METHODS = ["BKASH", "NAGAD", "BANK", "CASH"] as const;

interface AdvancePaymentPanelProps {
  order: any;
}

export function AdvancePaymentPanel({ order }: AdvancePaymentPanelProps) {
  const o = order;
  const customerTotal = o?.total_amount || 0;
  const [amount, setAmount] = useState<string>(String(o?.advance_amount || ""));
  const [method, setMethod] = useState<string>(o?.advance_method || "");
  const [showReverseDialog, setShowReverseDialog] = useState(false);

  const postAdvance = usePostAdvance();
  const reverseAndRepost = useReverseAndRepostAdvance();

  const numAmount = parseFloat(amount) || 0;
  const remaining = Math.max(0, customerTotal - numAmount);
  const isPosted = !!o?.advance_posted;
  const hasChanged = isPosted && (numAmount !== (o?.advance_amount || 0) || method !== (o?.advance_method || ""));

  const validationError = (() => {
    if (numAmount < 0) return "Amount cannot be negative";
    if (numAmount > customerTotal) return `Amount exceeds customer total (${formatBDT2(customerTotal)})`;
    if (numAmount > 0 && !method) return "Payment method required when advance > 0";
    return null;
  })();

  const handlePost = () => {
    if (validationError || numAmount <= 0) return;
    postAdvance.mutate({ orderId: o.id, advanceAmount: numAmount, advanceMethod: method });
  };

  const handleReverseAndRepost = (reason: string) => {
    if (!o.advance_journal_id) return;
    reverseAndRepost.mutate({
      orderId: o.id,
      currentJournalId: o.advance_journal_id,
      reason,
      newAmount: numAmount > 0 ? numAmount : undefined,
      newMethod: numAmount > 0 ? method : undefined,
    });
    setShowReverseDialog(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Wallet className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">Advance Payment</h3>
        {isPosted && (
          <Badge className="text-[10px] bg-emerald-100 text-emerald-800 ml-auto">
            <CheckCircle className="w-3 h-3 mr-1" /> Posted
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-[10px] text-muted-foreground">Advance Amount</Label>
          <Input
            type="number"
            className="h-8 text-sm mt-1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            min={0}
            max={customerTotal}
            step="0.01"
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Payment Method</Label>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>
              {ADVANCE_METHODS.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {validationError && (
        <p className="text-[11px] text-destructive flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> {validationError}
        </p>
      )}

      {/* Remaining collectable */}
      <div className="flex items-center justify-between bg-muted/40 rounded-lg px-3 py-2">
        <span className="text-xs text-muted-foreground">Remaining Collectable</span>
        <span className={cn("text-sm font-bold", remaining === 0 ? "text-emerald-600" : "text-primary")}>
          {formatBDT2(remaining)}
        </span>
      </div>

      {/* Breakdown */}
      {numAmount > 0 && (
        <div className="text-[11px] text-muted-foreground space-y-0.5 bg-muted/20 rounded-md p-2 border">
          <p>Customer Total: {formatBDT2(customerTotal)}</p>
          <p>− Advance ({method || "?"}): {formatBDT2(numAmount)}</p>
          <Separator className="my-1" />
          <p className="font-semibold text-foreground">= Remaining: {formatBDT2(remaining)}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {!isPosted ? (
          <Button
            size="sm"
            className="flex-1 h-8 text-xs gap-1"
            disabled={!!validationError || numAmount <= 0 || postAdvance.isPending}
            onClick={handlePost}
          >
            <ArrowRight className="w-3 h-3" />
            {postAdvance.isPending ? "Posting..." : "Post to GL"}
          </Button>
        ) : hasChanged ? (
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-8 text-xs gap-1 border-amber-300 text-amber-700"
            onClick={() => setShowReverseDialog(true)}
            disabled={!!validationError || reverseAndRepost.isPending}
          >
            <RotateCcw className="w-3 h-3" />
            {reverseAndRepost.isPending ? "Processing..." : "Reverse & Repost"}
          </Button>
        ) : (
          <p className="text-[11px] text-emerald-600 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> Advance GL entry posted
          </p>
        )}
      </div>

      <ConfirmCriticalAction
        open={showReverseDialog}
        onOpenChange={setShowReverseDialog}
        title="Reverse & Repost Advance"
        description={`This will reverse the existing advance journal and post a new one with ৳${numAmount.toFixed(2)} via ${method}. A mandatory reason is required for audit.`}
        confirmLabel="Reverse & Repost"
        destructive={false}
        requireReason
        onConfirm={handleReverseAndRepost}
        isPending={reverseAndRepost.isPending}
      />
    </div>
  );
}
