import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Trash2, AlertTriangle, Link2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useMetaCampaigns,
  useMetaCampaignMetrics,
  useCampaignProducts,
  useAllCampaignProducts,
  useSaveCampaignProducts,
  computeMetricsSummary,
} from "@/hooks/use-meta-ads";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export default function MetaAdsCampaignProducts() {
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: campaigns, isLoading: campsLoading } = useMetaCampaigns();
  const { data: metrics } = useMetaCampaignMetrics();
  const { data: allLinks } = useAllCampaignProducts();
  const { data: currentLinks, isLoading: linksLoading } = useCampaignProducts(selectedCampaignId || undefined);
  const saveMutation = useSaveCampaignProducts();

  // Products list
  const { data: products } = useQuery({
    queryKey: ["products-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name, sku").order("name");
      if (error) throw error;
      return data;
    },
  });

  // Local state for editing links
  const [editLinks, setEditLinks] = useState<{ product_id: string; allocation_pct: number; note?: string }[]>([]);
  const [isEditing, setIsEditing] = useState(false);

  const selectedCampaign = campaigns?.find((c) => c.id === selectedCampaignId);

  // Campaign spend summary
  const campaignSpend = useMemo(() => {
    if (!metrics || !selectedCampaignId) return 0;
    return metrics.filter((m) => m.campaign_id === selectedCampaignId).reduce((s, m) => s + (m.spend_bdt || 0), 0);
  }, [metrics, selectedCampaignId]);

  // Linked campaign IDs set
  const linkedCampaignIds = useMemo(() => {
    const set = new Set<string>();
    allLinks?.forEach((l) => set.add(l.campaign_id));
    return set;
  }, [allLinks]);

  // Unlinked spend
  const unlinkedSpend = useMemo(() => {
    if (!campaigns || !metrics) return 0;
    return campaigns
      .filter((c) => !linkedCampaignIds.has(c.id))
      .reduce((sum, c) => {
        const campMetrics = metrics.filter((m) => m.campaign_id === c.id);
        return sum + campMetrics.reduce((s, m) => s + (m.spend_bdt || 0), 0);
      }, 0);
  }, [campaigns, metrics, linkedCampaignIds]);

  const selectCampaign = (id: string) => {
    setSelectedCampaignId(id);
    setIsEditing(false);
  };

  const startEdit = () => {
    setEditLinks(
      currentLinks?.map((l) => ({ product_id: l.product_id, allocation_pct: l.allocation_pct, note: l.note || "" })) || []
    );
    setIsEditing(true);
  };

  const addProductLink = () => {
    setEditLinks([...editLinks, { product_id: "", allocation_pct: 100 }]);
  };

  const removeProductLink = (idx: number) => {
    setEditLinks(editLinks.filter((_, i) => i !== idx));
  };

  const updateLink = (idx: number, field: string, value: any) => {
    const updated = [...editLinks];
    (updated[idx] as any)[field] = value;
    setEditLinks(updated);
  };

  const totalAlloc = editLinks.reduce((s, l) => s + (l.allocation_pct || 0), 0);

  const handleSave = () => {
    if (editLinks.length > 0 && Math.abs(totalAlloc - 100) > 0.01) {
      toast({ title: "Allocation must equal 100%", variant: "destructive" });
      return;
    }
    if (editLinks.some((l) => !l.product_id)) {
      toast({ title: "Please select a product for each row", variant: "destructive" });
      return;
    }
    saveMutation.mutate(
      { campaignId: selectedCampaignId!, products: editLinks },
      { onSuccess: () => setIsEditing(false) }
    );
  };

  const fmt = (n: number) => n.toLocaleString("en-BD", { maximumFractionDigits: 0 });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Campaign → Product Linking</h1>
        <p className="text-sm text-muted-foreground">Link ad campaigns to products for accurate P&L tracking</p>
      </div>

      {/* Unlinked Warning */}
      {unlinkedSpend > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            ৳{fmt(unlinkedSpend)} in ads spend is not assigned to any product. This will cause inaccurate P&L.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Campaign List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Campaigns</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {campsLoading ? (
                <p className="p-4 text-sm text-muted-foreground">Loading...</p>
              ) : !campaigns?.length ? (
                <p className="p-4 text-sm text-muted-foreground">No campaigns found. Sync from Settings first.</p>
              ) : (
                <div className="divide-y">
                  {campaigns.map((c) => {
                    const isLinked = linkedCampaignIds.has(c.id);
                    const isSelected = selectedCampaignId === c.id;
                    const campSpend = metrics?.filter((m) => m.campaign_id === c.id).reduce((s, m) => s + (m.spend_bdt || 0), 0) || 0;
                    return (
                      <button
                        key={c.id}
                        onClick={() => selectCampaign(c.id)}
                        className={`w-full text-left px-4 py-3 transition-colors ${isSelected ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/50"}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium truncate">{c.campaign_name}</span>
                          <Badge variant="secondary" className={isLinked ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"}>
                            {isLinked ? "Linked" : "Unlinked"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">৳{fmt(campSpend)}</span>
                          <Badge variant="secondary" className="text-[10px]">{c.status}</Badge>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Product Links */}
        <div className="lg:col-span-2">
          {!selectedCampaignId ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Link2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Select a campaign to manage product links</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{selectedCampaign?.campaign_name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">Total Spend: ৳{fmt(campaignSpend)}</p>
                  </div>
                  {!isEditing ? (
                    <Button variant="outline" size="sm" onClick={startEdit}>Edit Links</Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>Cancel</Button>
                      <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
                        {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                        Save
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <div className="space-y-3">
                    {editLinks.map((link, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <Select value={link.product_id} onValueChange={(v) => updateLink(idx, "product_id", v)}>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select product" />
                          </SelectTrigger>
                          <SelectContent>
                            {products?.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name} {p.sku ? `(${p.sku})` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="w-24 flex items-center gap-1">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={link.allocation_pct}
                            onChange={(e) => updateLink(idx, "allocation_pct", parseFloat(e.target.value) || 0)}
                            className="text-center"
                          />
                          <span className="text-sm text-muted-foreground">%</span>
                        </div>
                        <span className="text-sm w-28 text-right">৳{fmt(campaignSpend * (link.allocation_pct / 100))}</span>
                        <Button variant="ghost" size="icon" onClick={() => removeProductLink(idx)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={addProductLink} className="w-full">
                      <Plus className="w-4 h-4 mr-1" /> Add Product
                    </Button>
                    {editLinks.length > 0 && (
                      <div className={`text-sm font-medium text-right ${Math.abs(totalAlloc - 100) > 0.01 ? "text-destructive" : "text-emerald-600"}`}>
                        Total Allocation: {totalAlloc}%
                      </div>
                    )}
                  </div>
                ) : linksLoading ? (
                  <p className="text-sm text-muted-foreground">Loading...</p>
                ) : !currentLinks?.length ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">No products linked yet.</p>
                    <Button variant="outline" size="sm" onClick={startEdit} className="mt-2">
                      <Plus className="w-4 h-4 mr-1" /> Link Products
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {currentLinks.map((link) => {
                      const product = products?.find((p) => p.id === link.product_id);
                      const allocated = campaignSpend * (link.allocation_pct / 100);
                      return (
                        <div key={link.id} className="flex items-center justify-between p-3 rounded-lg border">
                          <div>
                            <span className="font-medium text-sm">{product?.name || "Unknown Product"}</span>
                            {product?.sku && <span className="text-xs text-muted-foreground ml-2">({product.sku})</span>}
                          </div>
                          <div className="flex items-center gap-4">
                            <Badge variant="secondary">{link.allocation_pct}%</Badge>
                            <span className="font-medium text-sm">৳{fmt(allocated)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
