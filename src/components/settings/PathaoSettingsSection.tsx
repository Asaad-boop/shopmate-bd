import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { usePathaoStores, type PathaoStore } from "@/hooks/use-pathao";
import { cn } from "@/lib/utils";
import {
  CheckCircle2, XCircle, Loader2, Eye, EyeOff, Truck,
  Store, RefreshCw, Zap, Clock, Shield, AlertTriangle,
} from "lucide-react";

function invoke(body: Record<string, unknown>) {
  return supabase.functions.invoke("pathao-proxy", { body });
}

/* ── Connection badge ── */
function ConnectionBadge({ connected }: { connected: boolean }) {
  if (connected) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        Connected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-red-50 text-red-600 border border-red-200">
      <span className="h-2 w-2 rounded-full bg-red-500" />
      Disconnected
    </span>
  );
}

export default function PathaoSettingsSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [tokenExpiry, setTokenExpiry] = useState<string | null>(null);

  const [defaultStore, setDefaultStore] = useState("");
  const [defaultDeliveryType, setDefaultDeliveryType] = useState("48");
  const [defaultWeight, setDefaultWeight] = useState("0.5");
  const [autoSend, setAutoSend] = useState(false);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; time: number; message: string } | null>(null);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("*");
      if (error) throw error;
      const map: Record<string, string> = {};
      data.forEach((s: any) => { map[s.key] = s.value || ""; });
      return map;
    },
  });

  const { data: stores, isLoading: storesLoading } = usePathaoStores();

  useEffect(() => {
    if (settings) {
      setClientId(settings["pathao_client_id"] || "");
      setClientSecret(settings["pathao_client_secret"] || "");
      setUsername(settings["pathao_username"] || "");
      setPassword(settings["pathao_password"] || "");
      setDefaultStore(settings["pathao_default_store"] || "");
      setDefaultDeliveryType(settings["pathao_delivery_type"] || "48");
      setDefaultWeight(settings["pathao_default_weight"] || "0.5");
      setAutoSend(settings["pathao_auto_send"] === "true");
      if (settings["pathao_token"]) {
        try {
          const cached = JSON.parse(settings["pathao_token"]);
          if (cached.expires_at && Date.now() < cached.expires_at) {
            setConnected(true);
            setTokenExpiry(new Date(cached.expires_at).toLocaleString());
          }
        } catch { /* not connected */ }
      }
    }
  }, [settings]);

  const saveSetting = async (key: string, value: string) => {
    const { data: existing } = await supabase.from("settings").select("id").eq("key", key).maybeSingle();
    if (existing) {
      await supabase.from("settings").update({ value, updated_at: new Date().toISOString() }).eq("key", key);
    } else {
      await supabase.from("settings").insert({ key, value });
    }
  };

  const handleConnect = async () => {
    if (!clientId || !clientSecret || !username || !password) {
      toast({ title: "সব ক্রেডেনশিয়াল দিন", description: "সবগুলো ফিল্ড পূরণ করুন", variant: "destructive" });
      return;
    }
    setConnecting(true);
    try {
      await Promise.all([
        saveSetting("pathao_client_id", clientId),
        saveSetting("pathao_client_secret", clientSecret),
        saveSetting("pathao_username", username),
        saveSetting("pathao_password", password),
      ]);
      const { data, error } = await invoke({ action: "test_connection" });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setConnected(true);
      if (data?.expires_at) setTokenExpiry(new Date(data.expires_at).toLocaleString());
      toast({ title: "✅ Pathao সংযুক্ত হয়েছে!" });
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      queryClient.invalidateQueries({ queryKey: ["pathao-stores"] });
    } catch (err: any) {
      toast({ title: "❌ সংযোগ ব্যর্থ", description: err.message, variant: "destructive" });
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    await saveSetting("pathao_token", "");
    setConnected(false);
    setTokenExpiry(null);
    toast({ title: "Pathao সংযোগ বিচ্ছিন্ন হয়েছে" });
    queryClient.invalidateQueries({ queryKey: ["settings"] });
  };

  const handleReauth = async () => {
    await saveSetting("pathao_token", "");
    setConnected(false);
    setTokenExpiry(null);
    handleConnect();
  };

  const saveDefaultsMutation = useMutation({
    mutationFn: async () => {
      await Promise.all([
        saveSetting("pathao_default_store", defaultStore),
        saveSetting("pathao_delivery_type", defaultDeliveryType),
        saveSetting("pathao_default_weight", defaultWeight),
        saveSetting("pathao_auto_send", autoSend ? "true" : "false"),
      ]);
    },
    onSuccess: () => {
      toast({ title: "ডিফল্ট সেটিংস সেভ হয়েছে" });
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    const start = Date.now();
    try {
      const { data, error } = await invoke({ action: "test_connection" });
      const time = Date.now() - start;
      if (error || data?.error) {
        setTestResult({ ok: false, time, message: data?.error || error?.message || "Failed" });
      } else {
        setTestResult({ ok: true, time, message: "Token valid" });
      }
    } catch (err: any) {
      setTestResult({ ok: false, time: Date.now() - start, message: err.message });
    } finally {
      setTesting(false);
    }
  };

  // Check if token is expiring soon (within 24 hours)
  const isExpiringSoon = (() => {
    if (!settings?.["pathao_token"]) return false;
    try {
      const cached = JSON.parse(settings["pathao_token"]);
      if (cached.expires_at) {
        const hoursLeft = (cached.expires_at - Date.now()) / (1000 * 60 * 60);
        return hoursLeft > 0 && hoursLeft < 24;
      }
    } catch { /* ignore */ }
    return false;
  })();

  if (isLoading) return null;

  return (
    <div className="space-y-4">
      {/* Connection Card */}
      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-orange-50 text-orange-600">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Pathao Courier</h2>
                <p className="text-sm text-muted-foreground">Connect Pathao to auto-book deliveries</p>
              </div>
            </div>
            <ConnectionBadge connected={connected} />
          </div>
        </div>
        <div className="p-6">
          {connected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-xl border bg-muted/30">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Token expires: {tokenExpiry || "Unknown"}</span>
                {isExpiringSoon && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full ml-auto">
                    <AlertTriangle className="w-3 h-3" /> Expiring soon
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={handleDisconnect}>
                  Disconnect
                </Button>
                <Button variant="outline" size="sm" onClick={handleReauth}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Re-authenticate
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Client ID</Label>
                  <Input placeholder="Client ID" value={clientId} onChange={(e) => setClientId(e.target.value)} className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Client Secret</Label>
                  <div className="relative">
                    <Input type={showSecret ? "text" : "password"} placeholder="Client Secret" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} className="h-11 pr-10" />
                    <button type="button" onClick={() => setShowSecret(!showSecret)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Username / Email</Label>
                  <Input placeholder="merchant@email.com" value={username} onChange={(e) => setUsername(e.target.value)} className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Password</Label>
                  <div className="relative">
                    <Input type={showPassword ? "text" : "password"} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 pr-10" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
              <Button onClick={handleConnect} disabled={connecting} className="w-full h-11 bg-emerald-600 hover:bg-emerald-700">
                {connecting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Connecting...</> : <><Zap className="w-4 h-4 mr-2" /> Connect Pathao</>}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Default Settings */}
      {connected && (
        <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b bg-muted/20">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Shield className="w-4 h-4 text-muted-foreground" /> Default Settings
            </h3>
          </div>
          <div className="p-6 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Default Store</Label>
              <Select value={defaultStore} onValueChange={setDefaultStore}>
                <SelectTrigger className="h-11"><SelectValue placeholder={storesLoading ? "Loading stores..." : "Select default store"} /></SelectTrigger>
                <SelectContent>
                  {(stores || []).map((s: PathaoStore) => (
                    <SelectItem key={s.store_id} value={String(s.store_id)}>{s.store_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Default Delivery Type</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="delivery-type" value="48" checked={defaultDeliveryType === "48"} onChange={() => setDefaultDeliveryType("48")} className="accent-primary" />
                  <span className="text-sm">Standard (48 hours)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="delivery-type" value="12" checked={defaultDeliveryType === "12"} onChange={() => setDefaultDeliveryType("12")} className="accent-primary" />
                  <span className="text-sm">Express (12 hours)</span>
                </label>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Default Item Weight (kg)</Label>
              <Input type="number" step="0.1" min="0.1" value={defaultWeight} onChange={(e) => setDefaultWeight(e.target.value)} className="max-w-[150px] h-11" />
            </div>
            <div className="flex items-center justify-between rounded-xl border p-4">
              <div>
                <p className="text-sm font-medium">Auto-send to Pathao</p>
                <p className="text-xs text-muted-foreground">Automatically book when order status is Confirmed</p>
              </div>
              <Switch checked={autoSend} onCheckedChange={setAutoSend} />
            </div>
            <Separator />
            <div className="flex justify-end">
              <Button onClick={() => saveDefaultsMutation.mutate()} disabled={saveDefaultsMutation.isPending} className="h-10 px-6">
                {saveDefaultsMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : "Save Defaults"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Stores */}
      {connected && (
        <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b bg-muted/20">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Store className="w-4 h-4 text-muted-foreground" /> Pathao Stores
            </h3>
          </div>
          <div className="p-6">
            {storesLoading ? (
              <p className="text-sm text-muted-foreground">Loading stores...</p>
            ) : !stores?.length ? (
              <p className="text-sm text-muted-foreground">No stores found in your Pathao account.</p>
            ) : (
              <div className="space-y-2">
                {stores.map((s: PathaoStore) => (
                  <div key={s.store_id} className="flex items-center justify-between rounded-xl border p-4">
                    <div>
                      <p className="text-sm font-medium">{s.store_name}</p>
                      <p className="text-xs text-muted-foreground">{s.store_address}</p>
                    </div>
                    {String(s.store_id) === defaultStore && (
                      <Badge variant="secondary" className="text-xs">Default</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Test Connection */}
      {connected && (
        <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b bg-muted/20">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Zap className="w-4 h-4 text-muted-foreground" /> Test Connection
            </h3>
          </div>
          <div className="p-6 space-y-3">
            <Button variant="outline" onClick={handleTestConnection} disabled={testing} className="h-10">
              {testing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Testing...</> : "Send Test Request"}
            </Button>
            {testResult && (
              <div className={cn(
                "rounded-xl border p-4 text-sm",
                testResult.ok ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-700"
              )}>
                <p className="font-medium">{testResult.ok ? "✅ Connection OK" : "❌ Connection Failed"}</p>
                <p className="text-xs mt-1">Response time: {testResult.time}ms • {testResult.message}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
