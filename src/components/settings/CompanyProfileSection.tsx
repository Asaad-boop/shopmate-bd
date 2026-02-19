import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useCompanySettings } from "@/hooks/use-company-settings";
import { Building2, Upload, X, Loader2, Image as ImageIcon } from "lucide-react";

export default function CompanyProfileSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { settings, isLoading } = useCompanySettings();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: "", tagline: "", phone: "", phone2: "", email: "", website: "",
    address1: "", address2: "", city: "", facebook: "", whatsapp: "", tin: "", bin: "",
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

    // Remove old logo first
    await supabase.storage.from("company-assets").remove([filePath]);

    const { error } = await supabase.storage.from("company-assets").upload(filePath, file, {
      upsert: true,
      contentType: file.type,
    });

    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("company-assets").getPublicUrl(filePath);
    const publicUrl = urlData.publicUrl + "?t=" + Date.now();
    setLogoUrl(publicUrl);

    // Save to settings
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
        company_name: form.name,
        company_tagline: form.tagline,
        company_phone: form.phone,
        company_phone2: form.phone2,
        company_email: form.email,
        company_website: form.website,
        company_address1: form.address1,
        company_address2: form.address2,
        company_city: form.city,
        company_facebook: form.facebook,
        company_whatsapp: form.whatsapp,
        company_tin: form.tin,
        company_bin: form.bin,
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
    <Card className="max-w-2xl">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <CardTitle className="text-base">Company Profile</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Logo and business info for invoices & documents</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Logo Upload */}
        <div className="space-y-2">
          <Label>Company Logo</Label>
          <div
            className="flex items-center gap-4 p-4 border-2 border-dashed rounded-lg bg-muted/30 cursor-pointer hover:border-primary/40 transition-colors"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => !logoUrl && fileInputRef.current?.click()}
          >
            {logoUrl ? (
              <div className="flex items-center gap-4 w-full">
                <img
                  src={logoUrl}
                  alt="Company logo"
                  className="max-h-[80px] max-w-[200px] object-contain rounded"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <div className="flex gap-2 ml-auto">
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                    Change Logo
                  </Button>
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); removeLogo(); }}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center w-full py-4 text-center">
                {uploading ? (
                  <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
                ) : (
                  <>
                    <ImageIcon className="w-8 h-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Click or drag & drop to upload logo</p>
                    <p className="text-xs text-muted-foreground mt-1">PNG, JPG, SVG • Max 2MB</p>
                  </>
                )}
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
              e.target.value = "";
            }}
          />
        </div>

        {/* Company Info Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Company Name *</Label>
            <Input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Your Business Name" />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Tagline / Slogan</Label>
            <Input value={form.tagline} onChange={(e) => update("tagline", e.target.value)} placeholder="Quality products at best prices" />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="01XXXXXXXXX" />
          </div>
          <div className="space-y-1.5">
            <Label>Phone 2</Label>
            <Input value={form.phone2} onChange={(e) => update("phone2", e.target.value)} placeholder="Optional" />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="info@company.com" />
          </div>
          <div className="space-y-1.5">
            <Label>Website</Label>
            <Input value={form.website} onChange={(e) => update("website", e.target.value)} placeholder="www.company.com" />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Address Line 1</Label>
            <Input value={form.address1} onChange={(e) => update("address1", e.target.value)} placeholder="House/Road/Area" />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Address Line 2</Label>
            <Input value={form.address2} onChange={(e) => update("address2", e.target.value)} placeholder="Optional" />
          </div>
          <div className="space-y-1.5">
            <Label>City</Label>
            <Input value={form.city} onChange={(e) => update("city", e.target.value)} placeholder="Dhaka" />
          </div>
          <div className="space-y-1.5">
            <Label>Facebook Page URL</Label>
            <Input value={form.facebook} onChange={(e) => update("facebook", e.target.value)} placeholder="facebook.com/yourpage" />
          </div>
          <div className="space-y-1.5">
            <Label>WhatsApp Number</Label>
            <Input value={form.whatsapp} onChange={(e) => update("whatsapp", e.target.value)} placeholder="01XXXXXXXXX" />
          </div>
          <div className="space-y-1.5">
            <Label>TIN Number</Label>
            <Input value={form.tin} onChange={(e) => update("tin", e.target.value)} placeholder="Tax ID Number" />
          </div>
          <div className="space-y-1.5">
            <Label>BIN Number</Label>
            <Input value={form.bin} onChange={(e) => update("bin", e.target.value)} placeholder="Business ID Number" />
          </div>
        </div>

        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full sm:w-auto">
          {saveMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : "Save Company Profile"}
        </Button>
      </CardContent>
    </Card>
  );
}
