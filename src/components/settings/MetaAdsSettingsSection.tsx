import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function MetaAdsSettingsSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [defaultUsdRate, setDefaultUsdRate] = useState("110");
  const [autoSync, setAutoSync] = useState(true);

  // Ad accounts
  const [newAccountId, setNewAccountId] = useState("");
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccessToken, setNewAccessToken] = useState("");
  const [showToken, setShowToken] = useState(false);

  // Load settings
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data } = await supabase.from("settings").select("*");
      const map: Record<string, string> = {};
      data?.forEach((s: any) => { map[s.key] = s.value || ""; });
      return map;
    },
  });

  // Load ad accounts
  const { data: accounts, isLoading: accountsLoading } = useQuery({
    queryKey: ["meta-ad-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("meta_ad_accounts").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (settings) {
      setDefaultUsdRate(settings["meta_default_usd_rate"] || "110");
      setAutoSync(settings["meta_auto_sync"] !== "false");
    }
  }, [settings]);

  // Save settings
  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      const pairs = [
        { key: "meta_default_usd_rate", value: defaultUsdRate },
        { key: "meta_auto_sync", value: autoSync ? "true" : "false" },
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
      toast({ title: "Meta Ads settings saved" });
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Add ad account
  const addAccountMutation = useMutation({
    mutationFn: async () => {
      if (!newAccountId || !newAccountName || !newAccessToken) throw new Error("All fields required");
      const { error } = await supabase.from("meta_ad_accounts").insert({
        meta_account_id: newAccountId.replace("act_", ""),
        account_name: newAccountName,
        access_token: newAccessToken,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Ad account added" });
      setNewAccountId("");
      setNewAccountName("");
      setNewAccessToken("");
      queryClient.invalidateQueries({ queryKey: ["meta-ad-accounts"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Delete account
  const deleteAccountMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("meta_ad_accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Account removed" });
      queryClient.invalidateQueries({ queryKey: ["meta-ad-accounts"] });
    },
  });

  // Test connection
  const [testing, setTesting] = useState<string | null>(null);
  const testConnection = async (accountId: string, token: string) => {
    setTesting(accountId);
    try {
      const resp = await fetch(`https://graph.facebook.com/v19.0/act_${accountId}?fields=name,account_status&access_token=${token}`);
      const data = await resp.json();
      if (data.error) {
        toast({ title: "❌ Connection failed", description: data.error.message, variant: "destructive" });
      } else {
        toast({ title: "✅ Connected", description: `Account: ${data.name}` });
      }
    } catch {
      toast({ title: "Connection failed", variant: "destructive" });
    } finally {
      setTesting(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* General Settings */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium">General</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Default USD Rate (BDT)</Label>
            <Input value={defaultUsdRate} onChange={(e) => setDefaultUsdRate(e.target.value)} type="number" className="h-11" />
          </div>
          <div className="flex items-center gap-3 pt-6">
            <Switch checked={autoSync} onCheckedChange={setAutoSync} />
            <Label className="text-sm">Auto-sync daily at 6:00 AM</Label>
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={() => saveSettingsMutation.mutate()} disabled={saveSettingsMutation.isPending} size="sm">
            {saveSettingsMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
            Save Settings
          </Button>
        </div>
      </div>

      <Separator />

      {/* Ad Accounts */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium">Ad Accounts</h3>

        {/* Add new */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Account ID</Label>
            <Input placeholder="123456789" value={newAccountId} onChange={(e) => setNewAccountId(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Account Name</Label>
            <Input placeholder="My Business" value={newAccountName} onChange={(e) => setNewAccountName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Access Token</Label>
            <div className="relative">
              <Input
                type={showToken ? "text" : "password"}
                placeholder="Long-lived access token"
                value={newAccessToken}
                onChange={(e) => setNewAccessToken(e.target.value)}
                className="pr-10"
              />
              <button type="button" onClick={() => setShowToken(!showToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => addAccountMutation.mutate()} disabled={addAccountMutation.isPending}>
          <Plus className="w-4 h-4 mr-1" /> Add Account
        </Button>

        {/* Existing accounts */}
        {accounts && accounts.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((acc: any) => (
                <TableRow key={acc.id}>
                  <TableCell className="font-mono text-sm">{acc.meta_account_id}</TableCell>
                  <TableCell>{acc.account_name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={acc.is_active ? "bg-emerald-100 text-emerald-700" : "bg-muted"}>
                      {acc.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => testConnection(acc.meta_account_id, acc.access_token)}
                        disabled={testing === acc.meta_account_id}
                      >
                        {testing === acc.meta_account_id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Test"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteAccountMutation.mutate(acc.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
