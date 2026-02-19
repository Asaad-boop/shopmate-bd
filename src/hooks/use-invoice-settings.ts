import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface InvoiceSettings {
  vatNumber: string;
  vatPercentage: number;
  showVat: boolean;
  terms: string;
  footerNote: string;
  showBarcode: boolean;
  mushokText: string;
  defaultPaperSize: "a4" | "a5";
}

const INVOICE_KEYS = [
  "invoice_vat_number",
  "invoice_vat_percentage",
  "invoice_show_vat",
  "invoice_terms",
  "invoice_footer_note",
  "invoice_show_barcode",
  "invoice_mushok_text",
  "invoice_default_paper_size",
];

const DEFAULT_TERMS = `1. If any defect is found (damaged/defective/wrong product) after opening the box, inform us immediately with picture/video proof.
2. Return process must be initiated within 3 days of receiving the parcel.
3. Product must be in original condition with all tags and packaging.
4. Exchange delivery cost may be applicable.
5. Promotional offers are not applicable for returned products.`;

export function useInvoiceSettings() {
  const { data, isLoading } = useQuery({
    queryKey: ["invoice-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("settings")
        .select("key, value")
        .in("key", INVOICE_KEYS);
      if (error) throw error;
      const map: Record<string, string> = {};
      data?.forEach((s: any) => {
        map[s.key] = s.value || "";
      });
      return {
        vatNumber: map.invoice_vat_number || "",
        vatPercentage: parseFloat(map.invoice_vat_percentage || "0"),
        showVat: map.invoice_show_vat === "true",
        terms: map.invoice_terms || DEFAULT_TERMS,
        footerNote: map.invoice_footer_note || "",
        showBarcode: map.invoice_show_barcode !== "false",
        mushokText: map.invoice_mushok_text || "MUSHOK 6.3",
        defaultPaperSize: (map.invoice_default_paper_size as "a4" | "a5") || "a4",
      } as InvoiceSettings;
    },
    staleTime: 5 * 60 * 1000,
  });

  return { invoiceSettings: data, isLoading };
}

export { DEFAULT_TERMS };
