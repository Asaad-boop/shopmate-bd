import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useInvoiceSettings, DEFAULT_TERMS } from "@/hooks/use-invoice-settings";
import { FileText, Loader2 } from "lucide-react";

export default function InvoiceSettingsSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { invoiceSettings, isLoading } = useInvoiceSettings();

  const [form, setForm] = useState({
    vatNumber: "",
    vatPercentage: "0",
    showVat: false,
    terms: DEFAULT_TERMS,
    footerNote: "",
    showBarcode: true,
    mushokText: "MUSHOK 6.3",
    defaultPaperSize: "a4" as "a4" | "a5",
  });

  useEffect(() => {
    if (invoiceSettings) {
      setForm({
        vatNumber: invoiceSettings.vatNumber,
        vatPercentage: String(invoiceSettings.vatPercentage),
        showVat: invoiceSettings.showVat,
        terms: invoiceSettings.terms,
        footerNote: invoiceSettings.footerNote,
        showBarcode: invoiceSettings.showBarcode,
        mushokText: invoiceSettings.mushokText,
        defaultPaperSize: invoiceSettings.defaultPaperSize,
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
        invoice_vat_number: form.vatNumber,
        invoice_vat_percentage: form.vatPercentage,
        invoice_show_vat: String(form.showVat),
        invoice_terms: form.terms,
        invoice_footer_note: form.footerNote,
        invoice_show_barcode: String(form.showBarcode),
        invoice_mushok_text: form.mushokText,
        invoice_default_paper_size: form.defaultPaperSize,
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
    <Card className="max-w-2xl">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <CardTitle className="text-base">Invoice Settings</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">VAT, terms & conditions, and invoice layout options</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label>Show Barcode</Label>
              <p className="text-xs text-muted-foreground">Display barcode generated from order number</p>
            </div>
            <Switch
              checked={form.showBarcode}
              onCheckedChange={(v) => setForm({ ...form, showBarcode: v })}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Default Paper Size</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={form.defaultPaperSize === "a4" ? "default" : "outline"}
              onClick={() => setForm({ ...form, defaultPaperSize: "a4" })}
            >
              A4 (210×297mm)
            </Button>
            <Button
              type="button"
              size="sm"
              variant={form.defaultPaperSize === "a5" ? "default" : "outline"}
              onClick={() => setForm({ ...form, defaultPaperSize: "a5" })}
            >
              A5 (148×210mm)
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Terms & Conditions</Label>
          <Textarea
            value={form.terms}
            onChange={(e) => setForm({ ...form, terms: e.target.value })}
            rows={6}
            placeholder="Enter terms and conditions..."
            className="text-xs"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Invoice Footer Note</Label>
          <Input
            value={form.footerNote}
            onChange={(e) => setForm({ ...form, footerNote: e.target.value })}
            placeholder="Optional footer note"
          />
        </div>

        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full sm:w-auto">
          {saveMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : "Save Invoice Settings"}
        </Button>
      </CardContent>
    </Card>
  );
}
