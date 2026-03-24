import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BDCourierResult {
  risk_level: string;
  overall_success_rate: number;
  total_orders: number;
  total_success: number;
  total_cancel: number;
  courier_data?: Record<string, any>;
  fetched_at?: string;
  from_cache?: boolean;
  error?: string;
  // Legacy compat fields
  success_rate: number;
  successful_orders: number;
  returned_orders: number;
  cancelled_orders: number;
}

export function useBDCourierBulk(phones: string[], enabled = true) {
  return useQuery({
    queryKey: ["bd-courier-bulk", phones.sort().join(",")],
    queryFn: async (): Promise<Record<string, BDCourierResult>> => {
      if (!phones.length) return {};

      const uniquePhones = [...new Set(phones.filter(Boolean))];
      if (!uniquePhones.length) return {};

      const results: Record<string, BDCourierResult> = {};
      const batchSize = 5;
      for (let i = 0; i < uniquePhones.length; i += batchSize) {
        const batch = uniquePhones.slice(i, i + batchSize);
        try {
          const { data, error } = await supabase.functions.invoke("bd-courier-check", {
            body: { phones: batch },
          });
          if (!error && data?.results) {
            for (const [ph, r] of Object.entries(data.results as Record<string, any>)) {
              results[ph] = {
                risk_level: r.risk_level || "unknown",
                overall_success_rate: r.overall_success_rate ?? 0,
                total_orders: r.total_orders ?? 0,
                total_success: r.total_success ?? 0,
                total_cancel: r.total_cancel ?? 0,
                courier_data: r.courier_data,
                fetched_at: r.fetched_at,
                from_cache: r.from_cache,
                error: r.error,
                // Legacy compat
                success_rate: r.overall_success_rate ?? 0,
                successful_orders: r.total_success ?? 0,
                returned_orders: r.total_cancel ?? 0,
                cancelled_orders: r.total_cancel ?? 0,
              };
            }
          }
        } catch (e) {
          console.error("BD Courier batch error:", e);
        }
      }

      return results;
    },
    enabled: enabled && phones.length > 0,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useBDCourierSingle(phone: string, enabled = true) {
  return useQuery({
    queryKey: ["bd-courier-single", phone],
    queryFn: async (): Promise<BDCourierResult | null> => {
      if (!phone || phone.length < 8) return null;

      const { data, error } = await supabase.functions.invoke("bd-courier-check", {
        body: { phone },
      });

      if (error) {
        console.error("BD Courier single check error:", error);
        return null;
      }

      if (!data || data.error) return null;

      return {
        risk_level: data.risk_level || "unknown",
        overall_success_rate: data.overall_success_rate ?? 0,
        total_orders: data.total_orders ?? 0,
        total_success: data.total_success ?? 0,
        total_cancel: data.total_cancel ?? 0,
        courier_data: data.courier_data,
        fetched_at: data.fetched_at,
        from_cache: data.from_cache,
        // Legacy compat
        success_rate: data.overall_success_rate ?? 0,
        successful_orders: data.total_success ?? 0,
        returned_orders: data.total_cancel ?? 0,
        cancelled_orders: data.total_cancel ?? 0,
      };
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
