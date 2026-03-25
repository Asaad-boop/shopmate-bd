import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function FxRateSection() {
  const qc = useQueryClient();
  const [rate, setRate] = useState(110);
  const [lastUpdated, setLastUpdated] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["fx-rate"],
    queryFn: async () => {
      const { data } = await supabase.from("settings").select("value, updated_at").eq("key", "usd_bdt_rate").maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (data) {
      setRate(parseFloat(data.value) || 110);
      setLastUpdated(data.updated_at || "");
    }
  }, [data]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const { data: existing } = await supabase.from("settings").select("id").eq("key", "usd_bdt_rate").maybeSingle();
      if (existing) {
        await supabase.from("settings").update({ value: String(rate), updated_at: new Date().toISOString() }).eq("key", "usd_bdt_rate");
      } else {
        await supabase.from("settings").insert({ key: "usd_bdt_rate", value: String(rate) });
      }
    },
    onSuccess: () => {
      toast.success("Exchange rate updated");
      qc.invalidateQueries({ queryKey: ["fx-rate"] });
    },
  });

  if (isLoading) return <div className="animate-pulse h-20 bg-muted rounded-xl" />;

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">1 USD = ৳</Label>
        <div className="flex gap-3 items-end">
          <Input type="number" step="0.5" value={rate} onChange={e => setRate(parseFloat(e.target.value) || 0)} className="h-10 w-40" />
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="h-10">
            {saveMut.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : "Update Rate"}
          </Button>
        </div>
        {lastUpdated && <p className="text-[10px] text-muted-foreground">Last updated: {new Date(lastUpdated).toLocaleString()}</p>}
      </div>
      <p className="text-xs text-muted-foreground">Used to convert Meta Ads spend from USD to BDT in reports and campaign decisions.</p>
    </div>
  );
}
