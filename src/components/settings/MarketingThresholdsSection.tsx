import { useState, useEffect } from "react";
import { useThresholds, useSaveThresholds, type Thresholds } from "@/hooks/use-campaign-decisions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function MarketingThresholdsSection() {
  const { data: thresholds, isLoading } = useThresholds();
  const saveMut = useSaveThresholds();
  const [form, setForm] = useState<Thresholds>({
    scale_roas: 3.0, hold_roas_min: 1.5, kill_min_orders: 3, kill_spend_threshold: 5000,
  });

  useEffect(() => {
    if (thresholds) setForm(thresholds);
  }, [thresholds]);

  const handleSave = () => {
    saveMut.mutate(form, { onSuccess: () => toast.success("Thresholds saved") });
  };

  if (isLoading) return <div className="animate-pulse h-32 bg-muted rounded-xl" />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Scale ROAS Threshold</Label>
          <Input type="number" step="0.1" value={form.scale_roas}
            onChange={e => setForm(f => ({ ...f, scale_roas: parseFloat(e.target.value) || 0 }))} className="h-10" />
          <p className="text-[10px] text-muted-foreground">ROAS ≥ this + 10 orders → SCALE</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Hold ROAS Minimum</Label>
          <Input type="number" step="0.1" value={form.hold_roas_min}
            onChange={e => setForm(f => ({ ...f, hold_roas_min: parseFloat(e.target.value) || 0 }))} className="h-10" />
          <p className="text-[10px] text-muted-foreground">ROAS ≥ this but &lt; Scale → HOLD</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Kill Minimum Orders</Label>
          <Input type="number" value={form.kill_min_orders}
            onChange={e => setForm(f => ({ ...f, kill_min_orders: parseInt(e.target.value) || 0 }))} className="h-10" />
          <p className="text-[10px] text-muted-foreground">Orders &lt; this with high spend → KILL</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Kill Spend Threshold (৳)</Label>
          <Input type="number" value={form.kill_spend_threshold}
            onChange={e => setForm(f => ({ ...f, kill_spend_threshold: parseFloat(e.target.value) || 0 }))} className="h-10" />
          <p className="text-[10px] text-muted-foreground">Spend &gt; this with low orders → KILL</p>
        </div>
      </div>
      <Button onClick={handleSave} disabled={saveMut.isPending} className="h-10">
        {saveMut.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : "Save Thresholds"}
      </Button>
    </div>
  );
}
