import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAccountingPeriods, useClosePeriod, useReopenPeriod, useDraftCountByPeriod } from "@/hooks/use-accounting";
import { Lock, LockOpen, AlertTriangle } from "lucide-react";
import { format, subMonths, startOfMonth } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const heading = { fontFamily: "'Playfair Display', serif" };

export function PeriodCloseTab() {
  const { data: periods } = useAccountingPeriods();
  const { data: draftCounts } = useDraftCountByPeriod();
  const closePeriod = useClosePeriod();
  const reopenPeriod = useReopenPeriod();
  const [confirmKey, setConfirmKey] = useState<string | null>(null);

  // Generate last 12 months
  const months = useMemo(() => {
    const result = [];
    for (let i = 0; i < 12; i++) {
      const d = startOfMonth(subMonths(new Date(), i));
      const key = format(d, "yyyy-MM");
      const period = (periods || []).find((p: any) => p.period_key === key);
      const drafts = (draftCounts || []).find((d: any) => d.period_key === key);
      result.push({
        period_key: key,
        label: format(d, "MMMM yyyy"),
        status: period?.status || "open",
        closed_at: period?.closed_at,
        draft_count: drafts?.count || 0,
      });
    }
    return result;
  }, [periods, draftCounts]);

  const handleClose = (key: string) => {
    closePeriod.mutate(key, { onSuccess: () => setConfirmKey(null) });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold" style={heading}>Period Close</h3>
      <p className="text-sm text-muted-foreground">
        Close accounting periods to prevent future posting. Closed periods block all journal entry creation and posting for that month.
      </p>

      <Card className="border-border">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left p-3 font-semibold">Period</th>
                <th className="text-left p-3 font-semibold">Status</th>
                <th className="text-left p-3 font-semibold">Draft Journals</th>
                <th className="text-left p-3 font-semibold">Closed At</th>
                <th className="text-right p-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => (
                <tr key={m.period_key} className="border-b border-border hover:bg-muted/30">
                  <td className="p-3 font-medium">{m.label}</td>
                  <td className="p-3">
                    <Badge
                      variant="secondary"
                      className={m.status === "closed" ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}
                    >
                      {m.status === "closed" ? "Closed" : "Open"}
                    </Badge>
                  </td>
                  <td className="p-3">
                    {m.draft_count > 0 ? (
                      <span className="flex items-center gap-1 text-amber-600">
                        <AlertTriangle className="w-3.5 h-3.5" /> {m.draft_count} draft(s)
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-3 text-muted-foreground text-xs">
                    {m.closed_at ? format(new Date(m.closed_at), "dd MMM yyyy HH:mm") : "—"}
                  </td>
                  <td className="p-3 text-right">
                    {m.status === "open" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => setConfirmKey(m.period_key)}
                      >
                        <Lock className="w-3.5 h-3.5 mr-1" /> Close
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                        onClick={() => reopenPeriod.mutate(m.period_key)}
                      >
                        <LockOpen className="w-3.5 h-3.5 mr-1" /> Reopen
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Confirm Close Dialog */}
      <Dialog open={!!confirmKey} onOpenChange={() => setConfirmKey(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle style={heading}>Close Period: {confirmKey}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {(() => {
              const m = months.find((x) => x.period_key === confirmKey);
              return m?.draft_count ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    There are <strong>{m.draft_count}</strong> draft journal(s) in this period.
                    They will remain as drafts but cannot be posted after closing.
                  </div>
                </div>
              ) : null;
            })()}
            <p className="text-sm text-muted-foreground">
              Once closed, no journals can be posted or created for this period. You can reopen it later if needed.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmKey(null)}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                onClick={() => handleClose(confirmKey!)}
                disabled={closePeriod.isPending}
              >
                <Lock className="w-3.5 h-3.5 mr-1" /> Confirm Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
