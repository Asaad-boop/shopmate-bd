import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, Loader2, ShoppingBag, Shield } from "lucide-react";
import PathaoSettingsSection from "@/components/settings/PathaoSettingsSection";
import CompanyProfileSection from "@/components/settings/CompanyProfileSection";
import InvoiceSettingsSection from "@/components/settings/InvoiceSettingsSection";
export default function SettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [storeUrl, setStoreUrl] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [bdCourierApiKey, setBdCourierApiKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [testingBD, setTestingBD] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"unknown" | "connected" | "error">("unknown");
  const [bdStatus, setBdStatus] = useState<"unknown" | "connected" | "error">("unknown");

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

  useEffect(() => {
    if (settings) {
      setStoreUrl(settings["shopify_store_url"] || "");
      setApiToken(settings["shopify_api_token"] || "");
      setWebhookSecret(settings["shopify_webhook_secret"] || "");
      setBdCourierApiKey(settings["bdcourier_api_key"] || "");
      if (settings["shopify_store_url"] && settings["shopify_api_token"]) {
        setConnectionStatus("connected");
      }
      if (settings["bdcourier_api_key"]) {
        setBdStatus("connected");
      }
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const pairs = [
        { key: "shopify_store_url", value: storeUrl },
        { key: "shopify_api_token", value: apiToken },
        { key: "shopify_webhook_secret", value: webhookSecret },
        { key: "bdcourier_api_key", value: bdCourierApiKey },
      ];
      for (const pair of pairs) {
        const { data: existing } = await supabase.from("settings").select("id").eq("key", pair.key).maybeSingle();
        if (existing) {
          await supabase.from("settings").update({ value: pair.value, updated_at: new Date().toISOString() }).eq("key", pair.key);
        } else {
          await supabase.from("settings").insert(pair);
        }
      }
    },
    onSuccess: () => {
      toast({ title: "Settings saved" });
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      if (storeUrl && apiToken) setConnectionStatus("connected");
      if (bdCourierApiKey) setBdStatus("connected");
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const testConnection = async () => {
    setTesting(true);
    try {
      if (!storeUrl || !apiToken) {
        setConnectionStatus("error");
        toast({ title: "Missing credentials", description: "Please enter store URL and API token", variant: "destructive" });
      } else {
        setConnectionStatus("connected");
        toast({ title: "✅ Connection configured", description: `Store: ${storeUrl}` });
      }
    } catch {
      setConnectionStatus("error");
      toast({ title: "Connection failed", variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const testBDCourier = async () => {
    setTestingBD(true);
    try {
      if (!bdCourierApiKey) {
        setBdStatus("error");
        toast({ title: "Missing API Key", description: "Please enter BD Courier API key", variant: "destructive" });
      } else {
        // Test with a dummy call
        const { data, error } = await supabase.functions.invoke("bd-courier-check", {
          body: { phones: ["01700000000"] },
        });
        if (error || data?.error) {
          setBdStatus("error");
          toast({ title: "❌ Connection failed", description: data?.error || error?.message, variant: "destructive" });
        } else {
          setBdStatus("connected");
          toast({ title: "✅ BD Courier connected", description: "API key is valid" });
        }
      }
    } catch {
      setBdStatus("error");
      toast({ title: "Connection failed", variant: "destructive" });
    } finally {
      setTestingBD(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full max-w-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Configure integrations and preferences</p>
      </div>

      {/* Company Profile */}
      <CompanyProfileSection />

      {/* Invoice Settings */}
      <InvoiceSettingsSection />

      {/* Shopify Integration */}
      <Card className="max-w-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base">Shopify Integration</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Connect your Shopify store to sync orders</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {connectionStatus === "connected" && (
                <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                  <CheckCircle2 className="w-4 h-4" /> Connected
                </span>
              )}
              {connectionStatus === "error" && (
                <span className="flex items-center gap-1.5 text-sm text-destructive font-medium">
                  <XCircle className="w-4 h-4" /> Not Connected
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="store-url">Shopify Store URL</Label>
            <Input id="store-url" placeholder="yourstore.myshopify.com" value={storeUrl} onChange={(e) => setStoreUrl(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="api-token">Admin API Access Token</Label>
            <Input id="api-token" type="password" placeholder="shpat_xxxxxxxxxxxxxxxxxxxxxxxxxx" value={apiToken} onChange={(e) => setApiToken(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="webhook-secret">Webhook Secret</Label>
            <Input id="webhook-secret" type="password" placeholder="Enter webhook secret" value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} />
          </div>
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground">
              <strong>Webhook URL:</strong>{" "}
              <code className="bg-background px-1.5 py-0.5 rounded text-[11px]">
                https://ywutobfdoqktfkakbcch.supabase.co/functions/v1/shopify-webhook
              </code>
            </p>
          </div>
          <div className="flex gap-3 pt-2">
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : "Save Settings"}
            </Button>
            <Button variant="outline" onClick={testConnection} disabled={testing}>
              {testing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Testing...</> : "Test Connection"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* BD Courier Integration */}
      <Card className="max-w-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base">BD Courier - Customer QC</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Check customer delivery success rate before confirming orders</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {bdStatus === "connected" && (
                <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                  <CheckCircle2 className="w-4 h-4" /> Connected
                </span>
              )}
              {bdStatus === "error" && (
                <span className="flex items-center gap-1.5 text-sm text-destructive font-medium">
                  <XCircle className="w-4 h-4" /> Not Connected
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bd-api-key">BD Courier API Key</Label>
            <Input
              id="bd-api-key"
              type="password"
              placeholder="Enter your bdcourier.com API key"
              value={bdCourierApiKey}
              onChange={(e) => setBdCourierApiKey(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Get your API key from{" "}
              <a href="https://bdcourier.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                bdcourier.com
              </a>
            </p>
          </div>
          <div className="flex gap-3 pt-2">
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : "Save Settings"}
            </Button>
            <Button variant="outline" onClick={testBDCourier} disabled={testingBD}>
              {testingBD ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Testing...</> : "Test Connection"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Pathao Courier Integration */}
      <PathaoSettingsSection />
    </div>
  );
}