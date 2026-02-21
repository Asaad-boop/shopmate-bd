import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useInvoiceSettings, DEFAULT_TERMS } from "@/hooks/use-invoice-settings";
import { FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function InvoiceSettingsSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { invoiceSettings, isLoading } = useInvoiceSettings();

  const [form, setForm] = useState({
    vatNumber: "", vatPercentage: "0", showVat: false, terms: DEFAULT_TERMS,
    footerNote: "", showBarcode: true, mushokText: "MUSHOK 6.3",
    defaultPaperSize: "a4" as "a4" | "a5", riderNote: "",
  });

  useEffect(() => {
    if (invoiceSettings) {
      setForm({
        vatNumber: invoiceSettings.vatNumber, vatPercentage: String(invoiceSettings.vatPercentage),
        showVat: invoiceSettings.showVat, terms: invoiceSettings.terms,
        footerNote: invoiceSettings.footerNote, showBarcode: invoiceSettings.showBarcode,
        mushokText: invoiceSettings.mushokText, defaultPaperSize: invoiceSettings.defaultPaperSize,
        riderNote: invoiceSettings.riderNote,
      });
    }
  }, [invoiceSettings]);

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
        invoice_vat_number: form.vatNumber, invoice_vat_percentage: form.vatPercentage,
        invoice_show_vat: String(form.showVat), invoice_terms: form.terms,
        invoice_footer_note: form.footerNote, invoice_show_barcode: String(form.showBarcode),
        invoice_mushok_text: form.mushokText, invoice_default_paper_size: form.defaultPaperSize,
        invoice_rider_note: form.riderNote,
      };
      for (const [key, value] of Object.entries(pairs)) {
        await saveSetting(key, value);
      }
    },
    onSuccess: () => {
      toast({ title: "✅ Invoice settings saved" });
      queryClient.invalidateQueries({ queryKey: ["invoice-settings"] });
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (isLoading) return null;

  return (
    <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b bg-muted/20">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Invoice Settings</h2>
            <p className="text-sm text-muted-foreground">Paper size, terms & conditions, and invoice layout options</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Paper Size */}
        <div>
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 block">Default Paper Size</Label>
          <div className="grid grid-cols-2 gap-3 max-w-sm">
            {(["a4", "a5"] as const).map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setForm({ ...form, defaultPaperSize: size })}
                className={cn(
                  "relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200",
                  form.defaultPaperSize === size
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border hover:border-primary/30 hover:bg-muted/50"
                )}
              >
                <div className={cn(
                  "rounded-lg border-2 transition-colors",
                  size === "a4" ? "w-8 h-11" : "w-7 h-10",
                  form.defaultPaperSize === size ? "border-primary bg-primary/10" : "border-muted-foreground/30 bg-muted/50"
                )} />
                <div className="text-center">
                  <p className={cn("text-sm font-semibold", form.defaultPaperSize === size ? "text-primary" : "text-foreground")}>
                    {size.toUpperCase()}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {size === "a4" ? "210×297mm" : "148×210mm"}
                  </p>
                </div>
                {form.defaultPaperSize === size && (
                  <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary" />
                )}
              </button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Options */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Display Options</h3>
          <div className="flex items-center justify-between rounded-xl border p-4">
            <div>
              <p className="text-sm font-medium">Show Barcode</p>
              <p className="text-xs text-muted-foreground">Display barcode generated from order number</p>
            </div>
            <Switch checked={form.showBarcode} onCheckedChange={(v) => setForm({ ...form, showBarcode: v })} />
          </div>
        </div>

        <Separator />

        {/* Terms */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Content</h3>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Terms & Conditions</Label>
              <span className="text-xs text-muted-foreground">{form.terms.length} chars</span>
            </div>
            <Textarea value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })}
              rows={6} placeholder="Enter terms and conditions..." className="text-xs resize-none" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Invoice Footer Note</Label>
            <Input value={form.footerNote} onChange={(e) => setForm({ ...form, footerNote: e.target.value })}
              placeholder="Optional footer note" className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Rider Note (রাইডারের জন্য নির্দেশনা)</Label>
            <Textarea value={form.riderNote} onChange={(e) => setForm({ ...form, riderNote: e.target.value })}
              rows={3} placeholder="মার্চেন্টের অনুমতি ছাড়া প্রোডাক্ট খোলা সম্পূর্ণ নিষিদ্ধ..." className="text-xs resize-none" />
            <p className="text-xs text-muted-foreground">Leave empty for default message with your phone & WhatsApp number</p>
          </div>
        </div>

        <Separator />

        <div className="flex justify-end">
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="h-10 px-6">
            {saveMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : "Save Invoice Settings"}
          </Button>
        </div>
      </div>
    </div>
  );
}
