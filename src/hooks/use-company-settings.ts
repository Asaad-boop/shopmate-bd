import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CompanySettings {
  logo: string;
  name: string;
  tagline: string;
  phone: string;
  phone2: string;
  email: string;
  website: string;
  address1: string;
  address2: string;
  city: string;
  facebook: string;
  whatsapp: string;
  tin: string;
  bin: string;
  whatsappReviewLink: string;
  facebookGroupLink: string;
}

const COMPANY_KEYS = [
  "company_logo_url",
  "company_name",
  "company_tagline",
  "company_phone",
  "company_phone2",
  "company_email",
  "company_website",
  "company_address1",
  "company_address2",
  "company_city",
  "company_facebook",
  "company_whatsapp",
  "company_tin",
  "company_bin",
  "company_whatsapp_review_link",
  "company_facebook_group_link",
];

export function useCompanySettings() {
  const { data, isLoading } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("settings")
        .select("key, value")
        .in("key", COMPANY_KEYS);
      if (error) throw error;
      const map: Record<string, string> = {};
      data?.forEach((s: any) => {
        map[s.key] = s.value || "";
      });
      return {
        logo: map.company_logo_url || "",
        name: map.company_name || "",
        tagline: map.company_tagline || "",
        phone: map.company_phone || "",
        phone2: map.company_phone2 || "",
        email: map.company_email || "",
        website: map.company_website || "",
        address1: map.company_address1 || "",
        address2: map.company_address2 || "",
        city: map.company_city || "",
        facebook: map.company_facebook || "",
        whatsapp: map.company_whatsapp || "",
        tin: map.company_tin || "",
        bin: map.company_bin || "",
        whatsappReviewLink: map.company_whatsapp_review_link || "",
        facebookGroupLink: map.company_facebook_group_link || "",
      } as CompanySettings;
    },
    staleTime: 5 * 60 * 1000,
  });

  return { settings: data, isLoading };
}
