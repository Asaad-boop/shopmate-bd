import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BDCourierResult {
  success_rate: number;
  total_orders: number;
  successful_orders: number;
  returned_orders: number;
  cancelled_orders: number;
  raw_data?: any;
  last_fetched_at?: string;
  cached?: boolean;
  error?: string;
}

export function useBDCourierBulk(phones: string[], enabled = true) {
  return useQuery({
    queryKey: ["bd-courier-bulk", phones.sort().join(",")],
    queryFn: async (): Promise<Record<string, BDCourierResult>> => {
      if (!phones.length) return {};

      const uniquePhones = [...new Set(phones.filter(Boolean))];
      if (!uniquePhones.length) return {};

      const { data, error } = await supabase.functions.invoke("bd-courier-check", {
        body: { phones: uniquePhones },
      });

      if (error) {
        console.error("BD Courier bulk check error:", error);
        return {};
      }

      return data?.results || {};
    },
    enabled: enabled && phones.length > 0,
    staleTime: 5 * 60 * 1000, // 5 min stale
    retry: 1,
  });
}

export function useBDCourierSingle(phone: string, enabled = true) {
  return useQuery({
    queryKey: ["bd-courier-single", phone],
    queryFn: async (): Promise<BDCourierResult | null> => {
      if (!phone || phone.length < 8) return null;

      const { data, error } = await supabase.functions.invoke("bd-courier-check", {
        body: { phones: [phone] },
      });

      if (error) {
        console.error("BD Courier single check error:", error);
        return null;
      }

      return data?.results?.[phone] || null;
    },
    enabled: enabled && !!phone && phone.length >= 8,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function getRiskLevel(successRate: number | null | undefined) {
  if (successRate == null) return { label: "🆕 New Customer", color: "text-muted-foreground", bg: "bg-muted", risk: "new" };
  if (successRate > 80) return { label: "✅ Trusted", color: "text-green-700", bg: "bg-green-100", risk: "low" };
  if (successRate >= 50) return { label: "⚠️ Medium Risk", color: "text-yellow-700", bg: "bg-yellow-100", risk: "medium" };
  return { label: "🚨 High Risk", color: "text-red-700", bg: "bg-red-100", risk: "high" };
}

export function getSuccessColor(rate: number) {
  if (rate >= 80) return "hsl(142 76% 36%)";
  if (rate >= 50) return "hsl(48 96% 53%)";
  return "hsl(0 84% 60%)";
}
