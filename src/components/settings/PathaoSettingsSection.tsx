import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { usePathaoStores, type PathaoStore } from "@/hooks/use-pathao";
import {
  CheckCircle2, XCircle, Loader2, Eye, EyeOff, Truck,
  Store, RefreshCw, Zap, Clock, Shield,
} from "lucide-react";

function invoke(body: Record<string, unknown>) {
  return supabase.functions.invoke("pathao-proxy", { body });
}

export default function PathaoSettingsSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Credential fields
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Connection state
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [tokenExpiry, setTokenExpiry] = useState<string | null>(null);

  // Default settings
  const [defaultStore, setDefaultStore] = useState("");
  const [defaultDeliveryType, setDefaultDeliveryType] = useState("48");
  const [defaultWeight, setDefaultWeight] = useState("0.5");
  const [autoSend, setAutoSend] = useState(false);

  // Test
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; time: number; message: string } | null>(null);

  // Load saved settings
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

  // Load stores only when connected
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

      // Check if we have a cached token
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
      // Save credentials first
      await Promise.all([
        saveSetting("pathao_client_id", clientId),
        saveSetting("pathao_client_secret", clientSecret),
        saveSetting("pathao_username", username),
        saveSetting("pathao_password", password),
      ]);

      // Try to get token via edge function
      const { data, error } = await invoke({ action: "test_connection" });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setConnected(true);
      if (data?.expires_at) {
        setTokenExpiry(new Date(data.expires_at).toLocaleString());
      }
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

  if (isLoading) return null;

  return (
    <div className="space-y-6">
      {/* Connection Card */}
      <Card className="max-w-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100 text-orange-700">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base">Pathao Courier Integration</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Connect Pathao to auto-book deliveries</p>
              </div>
            </div>
            {connected ? (
              <Badge variant="default" className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Connected
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                <XCircle className="w-3.5 h-3.5 mr-1" /> Not Connected
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {connected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>Token expires: {tokenExpiry || "Unknown"}</span>
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
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pathao-client-id">Client ID</Label>
                  <Input id="pathao-client-id" placeholder="Client ID" value={clientId} onChange={(e) => setClientId(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pathao-client-secret">Client Secret</Label>
                  <div className="relative">
                    <Input id="pathao-client-secret" type={showSecret ? "text" : "password"} placeholder="Client Secret" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} className="pr-10" />
                    <button type="button" onClick={() => setShowSecret(!showSecret)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pathao-username">Username / Email</Label>
                  <Input id="pathao-username" placeholder="merchant@email.com" value={username} onChange={(e) => setUsername(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pathao-password">Password</Label>
                  <div className="relative">
                    <Input id="pathao-password" type={showPassword ? "text" : "password"} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="pr-10" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
              <Button onClick={handleConnect} disabled={connecting} className="w-full bg-green-600 hover:bg-green-700">
                {connecting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Connecting...</> : <><Zap className="w-4 h-4 mr-2" /> Connect Pathao</>}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Default Settings — only show when connected */}
      {connected && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-4 h-4 text-muted-foreground" /> Default Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Default Store</Label>
              <Select value={defaultStore} onValueChange={setDefaultStore}>
                <SelectTrigger>
                  <SelectValue placeholder={storesLoading ? "Loading stores..." : "Select default store"} />
                </SelectTrigger>
                <SelectContent>
                  {(stores || []).map((s: PathaoStore) => (
                    <SelectItem key={s.store_id} value={String(s.store_id)}>
                      {s.store_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Default Delivery Type</Label>
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

            <div className="space-y-2">
              <Label htmlFor="default-weight">Default Item Weight (kg)</Label>
              <Input id="default-weight" type="number" step="0.1" min="0.1" value={defaultWeight} onChange={(e) => setDefaultWeight(e.target.value)} className="max-w-[150px]" />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Auto-send to Pathao</p>
                <p className="text-xs text-muted-foreground">Automatically book when order status is Confirmed</p>
              </div>
              <Switch checked={autoSend} onCheckedChange={setAutoSend} />
            </div>

            <Button onClick={() => saveDefaultsMutation.mutate()} disabled={saveDefaultsMutation.isPending}>
              {saveDefaultsMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : "Save Defaults"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Store Management — only show when connected */}
      {connected && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Store className="w-4 h-4 text-muted-foreground" /> Pathao Stores
            </CardTitle>
          </CardHeader>
          <CardContent>
            {storesLoading ? (
              <p className="text-sm text-muted-foreground">Loading stores...</p>
            ) : !stores?.length ? (
              <p className="text-sm text-muted-foreground">No stores found in your Pathao account.</p>
            ) : (
              <div className="space-y-2">
                {stores.map((s: PathaoStore) => (
                  <div key={s.store_id} className="flex items-center justify-between rounded-lg border p-3">
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
          </CardContent>
        </Card>
      )}

      {/* Test Connection */}
      {connected && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4 text-muted-foreground" /> Test Connection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" onClick={handleTestConnection} disabled={testing}>
              {testing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Testing...</> : "Send Test Request"}
            </Button>
            {testResult && (
              <div className={`rounded-lg border p-3 text-sm ${testResult.ok ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
                <p className="font-medium">{testResult.ok ? "✅ Connection OK" : "❌ Connection Failed"}</p>
                <p className="text-xs mt-1">Response time: {testResult.time}ms • {testResult.message}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
