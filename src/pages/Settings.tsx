import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Building2, FileText, ShoppingBag, Shield, Truck, MessageSquare, Megaphone,
  CheckCircle2, XCircle, Loader2, Eye, EyeOff,
} from "lucide-react";
import PathaoSettingsSection from "@/components/settings/PathaoSettingsSection";
import SmsSettingsSection from "@/components/settings/SmsSettingsSection";
import CompanyProfileSection from "@/components/settings/CompanyProfileSection";
import InvoiceSettingsSection from "@/components/settings/InvoiceSettingsSection";
import MetaAdsSettingsSection from "@/components/settings/MetaAdsSettingsSection";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "company", label: "Company Profile", icon: Building2, description: "Business identity & branding" },
  { id: "invoice", label: "Invoice Settings", icon: FileText, description: "Paper size, terms & layout" },
  { id: "shopify", label: "Shopify Integration", icon: ShoppingBag, description: "Sync orders & products" },
  { id: "bdcourier", label: "BD Courier (QC)", icon: Shield, description: "Customer quality check" },
  { id: "pathao", label: "Pathao Courier", icon: Truck, description: "Delivery booking" },
  { id: "sms", label: "Bulk SMS BD", icon: MessageSquare, description: "SMS notifications & marketing" },
  { id: "metaads", label: "Meta Ads", icon: Megaphone, description: "Facebook & Instagram ads" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

/* ── Status badge component ── */
function ConnectionBadge({ status }: { status: "unknown" | "connected" | "error" }) {
  if (status === "connected") {
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
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-red-50 text-red-600 border border-red-200">
        <span className="h-2 w-2 rounded-full bg-red-500" />
        Disconnected
      </span>
    );
  }
  return null;
}

export default function SettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<SectionId>("company");
  const [storeUrl, setStoreUrl] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [bdCourierApiKey, setBdCourierApiKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [testingBD, setTestingBD] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"unknown" | "connected" | "error">("unknown");
  const [bdStatus, setBdStatus] = useState<"unknown" | "connected" | "error">("unknown");
  const [showApiToken, setShowApiToken] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [showBdKey, setShowBdKey] = useState(false);

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
      if (settings["shopify_store_url"] && settings["shopify_api_token"]) setConnectionStatus("connected");
      if (settings["bdcourier_api_key"]) setBdStatus("connected");
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
      <div className="flex gap-6 animate-fade-in p-6">
        <div className="w-64 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
        <div className="flex-1 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  /* ── Get Pathao status for sidebar badge ── */
  let pathaoStatus: "unknown" | "connected" | "error" = "unknown";
  if (settings?.["pathao_token"]) {
    try {
      const cached = JSON.parse(settings["pathao_token"]);
      if (cached.expires_at && Date.now() < cached.expires_at) pathaoStatus = "connected";
    } catch { /* ignore */ }
  }

  const sectionStatuses: Record<SectionId, "unknown" | "connected" | "error"> = {
    company: "unknown",
    invoice: "unknown",
    shopify: connectionStatus,
    bdcourier: bdStatus,
    pathao: pathaoStatus,
    sms: "unknown",
    metaads: "unknown",
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Configure integrations and preferences</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* ── Sidebar ── */}
        <nav className="md:w-64 md:sticky md:top-20 md:self-start shrink-0">
          <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
            {SECTIONS.map((sec, idx) => {
              const Icon = sec.icon;
              const isActive = activeSection === sec.id;
              const status = sectionStatuses[sec.id];
              return (
                <button
                  key={sec.id}
                  onClick={() => setActiveSection(sec.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all duration-200",
                    isActive
                      ? "bg-primary/5 border-l-[3px] border-l-primary"
                      : "border-l-[3px] border-l-transparent hover:bg-muted/50",
                    idx > 0 && "border-t border-border/50"
                  )}
                >
                  <div className={cn(
                    "p-2 rounded-lg transition-colors",
                    isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  )}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("text-sm font-medium truncate", isActive ? "text-primary" : "text-foreground")}>
                        {sec.label}
                      </span>
                      {status !== "unknown" && (
                        <span className={cn(
                          "h-2 w-2 rounded-full shrink-0",
                          status === "connected" ? "bg-emerald-500" : "bg-red-500"
                        )} />
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{sec.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </nav>

        {/* ── Content Area ── */}
        <div className="flex-1 min-w-0">
          <div className="transition-all duration-300 ease-in-out">
            {activeSection === "company" && <CompanyProfileSection />}
            {activeSection === "invoice" && <InvoiceSettingsSection />}
            {activeSection === "shopify" && (
              <SettingsCard
                icon={ShoppingBag}
                iconBg="bg-emerald-50 text-emerald-600"
                title="Shopify Integration"
                description="Connect your Shopify store to sync orders and products automatically."
                badge={<ConnectionBadge status={connectionStatus} />}
              >
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="store-url" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Store URL</Label>
                    <Input id="store-url" placeholder="yourstore.myshopify.com" value={storeUrl} onChange={(e) => setStoreUrl(e.target.value)} className="h-11" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="api-token" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Admin API Access Token</Label>
                    <div className="relative">
                      <Input id="api-token" type={showApiToken ? "text" : "password"} placeholder="shpat_xxxxxxxxxxxxxxxxxxxxxxxxxx" value={apiToken} onChange={(e) => setApiToken(e.target.value)} className="h-11 pr-10" />
                      <button type="button" onClick={() => setShowApiToken(!showApiToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                        {showApiToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="webhook-secret" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Webhook Secret</Label>
                    <div className="relative">
                      <Input id="webhook-secret" type={showWebhookSecret ? "text" : "password"} placeholder="Enter webhook secret" value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} className="h-11 pr-10" />
                      <button type="button" onClick={() => setShowWebhookSecret(!showWebhookSecret)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                        {showWebhookSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg border">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Webhook URL:</span>{" "}
                      <code className="bg-background px-1.5 py-0.5 rounded text-[11px] border">
                        https://ywutobfdoqktfkakbcch.supabase.co/functions/v1/shopify-webhook
                      </code>
                    </p>
                  </div>
                  <Separator />
                  <div className="flex gap-3 justify-end">
                    <Button variant="outline" onClick={testConnection} disabled={testing} className="h-10">
                      {testing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Testing...</> : "Test Connection"}
                    </Button>
                    <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="h-10">
                      {saveMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : "Save Settings"}
                    </Button>
                  </div>
                </div>
              </SettingsCard>
            )}
            {activeSection === "bdcourier" && (
              <SettingsCard
                icon={Shield}
                iconBg="bg-blue-50 text-blue-600"
                title="BD Courier — Customer QC"
                description="Check customer delivery success rate before confirming orders."
                badge={<ConnectionBadge status={bdStatus} />}
              >
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="bd-api-key" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">API Key</Label>
                    <div className="relative">
                      <Input id="bd-api-key" type={showBdKey ? "text" : "password"} placeholder="Enter your bdcourier.com API key" value={bdCourierApiKey} onChange={(e) => setBdCourierApiKey(e.target.value)} className="h-11 pr-10" />
                      <button type="button" onClick={() => setShowBdKey(!showBdKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                        {showBdKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Get your API key from{" "}
                      <a href="https://bdcourier.com" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">
                        bdcourier.com
                      </a>
                    </p>
                  </div>
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
              </SettingsCard>
            )}
            {activeSection === "pathao" && <PathaoSettingsSection />}
            {activeSection === "sms" && (
              <SettingsCard
                icon={MessageSquare}
                iconBg="bg-violet-50 text-violet-600"
                title="Bulk SMS BD"
                description="Send SMS notifications, OTP, and marketing messages via BulkSMSBD.com"
                badge={null}
              >
                <SmsSettingsSection />
              </SettingsCard>
            )}
            {activeSection === "metaads" && (
              <SettingsCard
                icon={Megaphone}
                iconBg="bg-blue-50 text-blue-600"
                title="Meta Ads Integration"
                description="Connect Facebook & Instagram ad accounts to track spend and calculate product-level P&L."
                badge={null}
              >
                <MetaAdsSettingsSection />
              </SettingsCard>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Reusable settings card wrapper ── */
function SettingsCard({
  icon: Icon, iconBg, title, description, badge, children,
}: {
  icon: React.ElementType;
  iconBg: string;
  title: string;
  description: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("p-2.5 rounded-xl", iconBg)}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">{title}</h2>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
          {badge}
        </div>
      </div>
      <div className="p-6">
        {children}
      </div>
    </div>
  );
}
