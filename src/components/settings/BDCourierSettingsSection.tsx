import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  Shield, Loader2, Eye, EyeOff, BarChart3,
} from "lucide-react";

interface Props {
  bdCourierApiKey: string;
  setBdCourierApiKey: (v: string) => void;
  showBdKey: boolean;
  setShowBdKey: (v: boolean) => void;
  bdStatus: "unknown" | "connected" | "error";
  testBDCourier: () => void;
  testingBD: boolean;
  saveMutation: { mutate: () => void; isPending: boolean };
}

export default function BDCourierSettingsSection({
  bdCourierApiKey, setBdCourierApiKey, showBdKey, setShowBdKey,
  bdStatus, testBDCourier, testingBD, saveMutation,
}: Props) {
  // Fetch daily API usage
  const { data: dailyUsage } = useQuery({
    queryKey: ["bdcourier-daily-usage"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { count, error } = await supabase
        .from("bdcourier_api_log")
        .select("*", { count: "exact", head: true })
        .eq("call_date", today)
        .eq("success", true);
      if (error) return 0;
      return count || 0;
    },
    staleTime: 30_000,
  });

  const used = dailyUsage ?? 0;
  const limit = 500;
  const pct = Math.min((used / limit) * 100, 100);

  return (
    <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">BD Courier — Customer QC</h2>
              <p className="text-sm text-muted-foreground">Check customer delivery success rate before confirming orders.</p>
            </div>
          </div>
          {bdStatus === "connected" ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              Connected
            </span>
          ) : bdStatus === "error" ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-red-50 text-red-600 border border-red-200">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              Disconnected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-muted text-muted-foreground border border-border">
              Not configured
            </span>
          )}
        </div>
      </div>
      <div className="p-6 space-y-4">
        {/* API Key */}
        <div className="space-y-1.5">
          <Label htmlFor="bd-api-key" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">API Key</Label>
          <div className="relative">
            <Input id="bd-api-key" type={showBdKey ? "text" : "password"} placeholder="Enter your BD Courier API key" value={bdCourierApiKey} onChange={(e) => setBdCourierApiKey(e.target.value)} className="h-11 pr-10" />
            <button type="button" onClick={() => setShowBdKey(!showBdKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
              {showBdKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Get your free API key at{" "}
            <a href="https://app.courier.com.bd" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">
              app.courier.com.bd
            </a>
          </p>
        </div>

        {/* Daily Usage Counter */}
        {bdStatus === "connected" && (
          <div className="rounded-xl border p-4 space-y-2 bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Daily API Calls</span>
              </div>
              <span className={cn(
                "text-sm font-bold",
                pct >= 90 ? "text-destructive" : pct >= 70 ? "text-amber-600" : "text-foreground"
              )}>
                {used} / {limit}
              </span>
            </div>
            <Progress value={pct} className="h-2" />
            {pct >= 90 && (
              <p className="text-xs text-destructive">⚠️ Approaching daily limit. New lookups will be paused at 490.</p>
            )}
          </div>
        )}

        <Separator />
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={testBDCourier} disabled={testingBD} className="h-10">
            {testingBD ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Testing...</> : "Test Connection"}
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="h-10">
            {saveMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : "Save Settings"}
          </Button>
        </div>
      </div>
    </div>
  );
}
