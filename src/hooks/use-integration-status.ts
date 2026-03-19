import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface IntegrationStatus {
  pathao: boolean;
  steadfast: boolean;
  redx: boolean;
  metaAds: boolean;
  sms: boolean;
  shopify: boolean;
}

const INTEGRATION_KEYS: Record<keyof IntegrationStatus, string[]> = {
  pathao: ["pathao_client_id", "pathao_client_secret"],
  steadfast: ["steadfast_api_key"],
  redx: ["redx_api_key"],
  metaAds: ["meta_access_token", "meta_ad_account_id"],
  sms: ["bulksmsbd_api_key"],
  shopify: ["shopify_shop_url", "shopify_access_token"],
};

export function useIntegrationStatus(): IntegrationStatus & { isLoading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ["integration-status"],
    queryFn: async () => {
      const allKeys = Object.values(INTEGRATION_KEYS).flat();
      const { data: settings } = await supabase
        .from("settings")
        .select("key, value")
        .in("key", allKeys);

      const map: Record<string, string> = {};
      (settings || []).forEach(s => { map[s.key] = s.value || ""; });

      const result: IntegrationStatus = {
        pathao: false, steadfast: false, redx: false,
        metaAds: false, sms: false, shopify: false,
      };

      for (const [integration, keys] of Object.entries(INTEGRATION_KEYS)) {
        result[integration as keyof IntegrationStatus] = keys.every(k => !!map[k]?.trim());
      }

      return result;
    },
    staleTime: 300_000,
  });

  return {
    pathao: data?.pathao ?? false,
    steadfast: data?.steadfast ?? false,
    redx: data?.redx ?? false,
    metaAds: data?.metaAds ?? false,
    sms: data?.sms ?? false,
    shopify: data?.shopify ?? false,
    isLoading,
  };
}
