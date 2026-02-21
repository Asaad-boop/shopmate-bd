import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useCompanySettings } from "@/hooks/use-company-settings";
import { Building2, Upload, X, Loader2, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CompanyProfileSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { settings, isLoading } = useCompanySettings();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: "", tagline: "", phone: "", phone2: "", email: "", website: "",
    address1: "", address2: "", city: "", facebook: "", whatsapp: "", tin: "", bin: "",
    whatsappReviewLink: "", facebookGroupLink: "",
  });
  const [logoUrl, setLogoUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({
        name: settings.name, tagline: settings.tagline, phone: settings.phone,
        phone2: settings.phone2, email: settings.email, website: settings.website,
        address1: settings.address1, address2: settings.address2, city: settings.city,
        facebook: settings.facebook, whatsapp: settings.whatsapp, tin: settings.tin, bin: settings.bin,
        whatsappReviewLink: settings.whatsappReviewLink, facebookGroupLink: settings.facebookGroupLink,
      });
      setLogoUrl(settings.logo);
    }
  }, [settings]);

  const handleUpload = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 2MB allowed", variant: "destructive" });
      return;
    }
    if (!["image/png", "image/jpeg", "image/svg+xml"].includes(file.type)) {
      toast({ title: "Invalid format", description: "PNG, JPG, or SVG only", variant: "destructive" });
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const filePath = `logo.${ext}`;
    await supabase.storage.from("company-assets").remove([filePath]);
    const { error } = await supabase.storage.from("company-assets").upload(filePath, file, { upsert: true, contentType: file.type });
    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("company-assets").getPublicUrl(filePath);
    const publicUrl = urlData.publicUrl + "?t=" + Date.now();
    setLogoUrl(publicUrl);
    await saveSetting("company_logo_url", publicUrl);
    queryClient.invalidateQueries({ queryKey: ["company-settings"] });
    toast({ title: "✅ Logo uploaded" });
    setUploading(false);
  };

  const removeLogo = async () => {
    setLogoUrl("");
    await saveSetting("company_logo_url", "");
    queryClient.invalidateQueries({ queryKey: ["company-settings"] });
    toast({ title: "Logo removed" });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  };

  const saveSetting = async (key: string, value: string) => {
    const { data: existing } = await supabase.from("settings").select("id").eq("key", key).maybeSingle();
    if (existing) {
      await supabase.from("settings").update({ value, updated_at: new Date().toISOString() }).eq("key", key);
    } else {
      await supabase.from("settings").insert({ key, value });
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const pairs: Record<string, string> = {
        company_name: form.name, company_tagline: form.tagline, company_phone: form.phone,
        company_phone2: form.phone2, company_email: form.email, company_website: form.website,
        company_address1: form.address1, company_address2: form.address2, company_city: form.city,
        company_facebook: form.facebook, company_whatsapp: form.whatsapp, company_tin: form.tin,
        company_bin: form.bin, company_whatsapp_review_link: form.whatsappReviewLink,
        company_facebook_group_link: form.facebookGroupLink,
      };
      for (const [key, value] of Object.entries(pairs)) {
        await saveSetting(key, value);
      }
    },
    onSuccess: () => {
      toast({ title: "✅ Company profile saved" });
      queryClient.invalidateQueries({ queryKey: ["company-settings"] });
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const update = (key: string, value: string) => setForm((p) => ({ ...p, [key]: value }));

  if (isLoading) return null;

  return (
    <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b bg-muted/20">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Company Profile</h2>
            <p className="text-sm text-muted-foreground">Logo and business info for invoices & documents</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Logo Upload */}
        <div>
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Company Logo</Label>
          <div
            className={cn(
              "relative flex items-center gap-4 p-5 border-2 border-dashed rounded-xl transition-all duration-200",
              logoUrl ? "border-border bg-muted/20" : "border-primary/20 bg-primary/[0.02] hover:border-primary/40 hover:bg-primary/[0.04] cursor-pointer"
            )}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => !logoUrl && fileInputRef.current?.click()}
          >
            {logoUrl ? (
              <div className="flex items-center gap-4 w-full">
                <div className="h-20 w-40 rounded-lg border bg-background flex items-center justify-center overflow-hidden">
                  <img src={logoUrl} alt="Company logo" className="max-h-full max-w-full object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
                <div className="flex gap-2 ml-auto">
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                    Change
                  </Button>
                  <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); removeLogo(); }}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center w-full py-6 text-center">
                {uploading ? (
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                ) : (
                  <>
                    <div className="p-3 rounded-full bg-primary/10 mb-3">
                      <Upload className="w-5 h-5 text-primary" />
                    </div>
                    <p className="text-sm font-medium text-foreground">Click or drag & drop to upload</p>
                    <p className="text-xs text-muted-foreground mt-1">PNG, JPG, SVG • Max 2MB</p>
                  </>
                )}
              </div>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/svg+xml" className="hidden"
            onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUpload(file); e.target.value = ""; }} />
        </div>

        <Separator />

        {/* Business Info */}
        <div>
          <h3 className="text-sm font-semibold mb-4">Business Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Company Name *</Label>
              <Input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Your Business Name" className="h-11" />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tagline / Slogan</Label>
              <Input value={form.tagline} onChange={(e) => update("tagline", e.target.value)} placeholder="Quality products at best prices" className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Phone</Label>
              <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="01XXXXXXXXX" className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Phone 2</Label>
              <Input value={form.phone2} onChange={(e) => update("phone2", e.target.value)} placeholder="Optional" className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</Label>
              <Input value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="info@company.com" className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Website</Label>
              <Input value={form.website} onChange={(e) => update("website", e.target.value)} placeholder="www.company.com" className="h-11" />
            </div>
          </div>
        </div>

        <Separator />

        {/* Address */}
        <div>
          <h3 className="text-sm font-semibold mb-4">Address</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Address Line 1</Label>
              <Input value={form.address1} onChange={(e) => update("address1", e.target.value)} placeholder="House/Road/Area" className="h-11" />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Address Line 2</Label>
              <Input value={form.address2} onChange={(e) => update("address2", e.target.value)} placeholder="Optional" className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">City</Label>
              <Input value={form.city} onChange={(e) => update("city", e.target.value)} placeholder="Dhaka" className="h-11" />
            </div>
          </div>
        </div>

        <Separator />

        {/* Social & Contact */}
        <div>
          <h3 className="text-sm font-semibold mb-4">Social & Contact Links</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Facebook Page URL</Label>
              <Input value={form.facebook} onChange={(e) => update("facebook", e.target.value)} placeholder="facebook.com/yourpage" className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">WhatsApp Number</Label>
              <Input value={form.whatsapp} onChange={(e) => update("whatsapp", e.target.value)} placeholder="01XXXXXXXXX" className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">TIN Number</Label>
              <Input value={form.tin} onChange={(e) => update("tin", e.target.value)} placeholder="Tax ID Number" className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">BIN Number</Label>
              <Input value={form.bin} onChange={(e) => update("bin", e.target.value)} placeholder="Business ID Number" className="h-11" />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">WhatsApp Review Link</Label>
              <Input value={form.whatsappReviewLink} onChange={(e) => update("whatsappReviewLink", e.target.value)} placeholder="https://wa.me/88017XXXXXXXX" className="h-11" />
              <p className="text-xs text-muted-foreground">Link shown on invoice for customer feedback via WhatsApp</p>
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Facebook Group Link</Label>
              <Input value={form.facebookGroupLink} onChange={(e) => update("facebookGroupLink", e.target.value)} placeholder="https://facebook.com/groups/yourgroup" className="h-11" />
              <p className="text-xs text-muted-foreground">Link shown on invoice for customers to join your Facebook group</p>
            </div>
          </div>
        </div>

        <Separator />

        <div className="flex justify-end">
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="h-10 px-6">
            {saveMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : "Save Company Profile"}
          </Button>
        </div>
      </div>
    </div>
  );
}
