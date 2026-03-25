import { useState } from "react";
import { usePageTitle } from "@/hooks/use-page-title";
import { useCampaignDecisions, useOverrideDecision } from "@/hooks/use-campaign-decisions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Megaphone, TrendingUp, TrendingDown, Minus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const fmt = (n: number) => `৳${Number(n || 0).toLocaleString("en-BD")}`;

const DECISION_CONFIG = {
  kill: { label: "KILL", emoji: "🔴", color: "bg-destructive/10 text-destructive border-destructive/30", badgeVariant: "destructive" as const },
  hold: { label: "HOLD", emoji: "🟡", color: "bg-yellow-50 text-yellow-700 border-yellow-300 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-700", badgeVariant: "secondary" as const },
  scale: { label: "SCALE", emoji: "🟢", color: "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-700", badgeVariant: "default" as const },
};

export default function CampaignDecisionsPage() {
  usePageTitle("Campaign Decisions");
  const { data: campaigns, isLoading, refetch } = useCampaignDecisions();
  const overrideMut = useOverrideDecision();
  const [overrideModal, setOverrideModal] = useState<any>(null);
  const [overrideDecision, setOverrideDecision] = useState("hold");
  const [overrideNote, setOverrideNote] = useState("");

  const grouped = {
    kill: (campaigns || []).filter(c => c.decision === "kill"),
    hold: (campaigns || []).filter(c => c.decision === "hold"),
    scale: (campaigns || []).filter(c => c.decision === "scale"),
  };

  const handleOverride = () => {
    if (!overrideModal) return;
    overrideMut.mutate({
      campaignId: overrideModal.id,
      decision: overrideDecision,
      note: overrideNote,
      roas: overrideModal.roas,
      spend: overrideModal.amount_spent,
      revenue: overrideModal.revenue_attributed,
      orders: overrideModal.orders_attributed,
    }, {
      onSuccess: () => {
        toast.success("Decision overridden");
        setOverrideModal(null);
        setOverrideNote("");
      },
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Megaphone className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Campaign Decisions</h1>
            <p className="text-sm text-muted-foreground">Automated kill / hold / scale recommendations</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {/* Summary counts */}
      <div className="grid grid-cols-3 gap-4">
        {(["kill", "hold", "scale"] as const).map(key => {
          const cfg = DECISION_CONFIG[key];
          return (
            <div key={key} className={`rounded-xl border p-4 ${cfg.color}`}>
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold">{cfg.emoji} {cfg.label}</span>
                <span className="text-2xl font-black tabular-nums">{grouped[key].length}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {(["kill", "hold", "scale"] as const).map(key => {
          const cfg = DECISION_CONFIG[key];
          const items = grouped[key];
          return (
            <div key={key} className="space-y-3">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                {cfg.emoji} {cfg.label} <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
              </h2>
              {items.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-xl">
                  No campaigns in {cfg.label}
                </div>
              )}
              {items.map(c => (
                <Card key={c.id} className={`border ${cfg.color} transition-shadow hover:shadow-md`}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <h3 className="font-semibold text-sm truncate flex-1 mr-2">{c.campaign_name}</h3>
                      <Badge variant={cfg.badgeVariant} className="text-[10px] shrink-0">{cfg.label}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">Spend</p>
                        <p className="font-semibold tabular-nums">{fmt(c.amount_spent)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Revenue</p>
                        <p className="font-semibold tabular-nums">{fmt(c.revenue_attributed)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">ROAS</p>
                        <p className="font-semibold tabular-nums flex items-center gap-1">
                          {c.roas.toFixed(2)}x
                          {c.roas >= 3 ? <TrendingUp className="w-3 h-3 text-emerald-500" /> :
                           c.roas < 1.5 ? <TrendingDown className="w-3 h-3 text-destructive" /> :
                           <Minus className="w-3 h-3 text-yellow-500" />}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Orders</p>
                        <p className="font-semibold tabular-nums">{c.orders_attributed}</p>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground italic leading-snug">{c.reason}</p>
                    {c.override_decision && (
                      <Badge variant="outline" className="text-[9px]">🔄 Overridden</Badge>
                    )}
                    <Button
                      variant="ghost" size="sm"
                      className="w-full h-7 text-[10px] text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setOverrideModal(c);
                        setOverrideDecision(c.decision);
                        setOverrideNote("");
                      }}
                    >
                      Override Decision
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          );
        })}
      </div>

      {/* Override Modal */}
      <Dialog open={!!overrideModal} onOpenChange={(o) => !o && setOverrideModal(null)}>
        <DialogContent className="max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle>Override Decision — {overrideModal?.campaign_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">New Decision</label>
              <Select value={overrideDecision} onValueChange={setOverrideDecision}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="kill">🔴 KILL</SelectItem>
                  <SelectItem value="hold">🟡 HOLD</SelectItem>
                  <SelectItem value="scale">🟢 SCALE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Note</label>
              <Textarea value={overrideNote} onChange={e => setOverrideNote(e.target.value)} placeholder="Reason for override..." rows={3} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOverrideModal(null)}>Cancel</Button>
            <Button onClick={handleOverride} disabled={overrideMut.isPending}>
              {overrideMut.isPending ? "Saving..." : "Save Override"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
