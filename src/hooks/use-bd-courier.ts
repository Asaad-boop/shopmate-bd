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
  success_rate: number;
  successful_orders: number;
  returned_orders: number;
  cancelled_orders: number;
}

interface CacheRow {
  phone: string | null;
  success_rate: number | null;
  total_orders: number | null;
  successful_orders: number | null;
  returned_orders: number | null;
  cancelled_orders: number | null;
  last_fetched_at: string | null;
  raw_data?: any;
}

function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return "";

  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("880")) digits = digits.slice(3);
  if (digits.length === 10 && !digits.startsWith("0")) digits = `0${digits}`;
  if (digits.length > 11) digits = digits.slice(-11);

  return digits.length === 11 ? digits : "";
}

function getPhoneVariants(phone: string | null | undefined): string[] {
  const normalized = normalizePhone(phone);
  if (!normalized) return [];

  return [...new Set([
    phone?.trim(),
    normalized,
    `88${normalized}`,
    `+88${normalized}`,
  ].filter(Boolean) as string[])];
}

function mapResult(r: any): BDCourierResult {
  const overallRate = r.overall_success_rate ?? r.success_rate ?? 0;
  const totalSuccess = r.total_success ?? r.successful_orders ?? 0;
  const totalCancel = r.total_cancel ?? r.cancelled_orders ?? r.returned_orders ?? 0;

  return {
    risk_level: r.risk_level || (r.total_orders > 0 ? getRiskFromRate(overallRate) : "new_customer"),
    overall_success_rate: overallRate,
    total_orders: r.total_orders ?? 0,
    total_success: totalSuccess,
    total_cancel: totalCancel,
    courier_data: r.courier_data,
    fetched_at: r.fetched_at ?? r.last_fetched_at,
    from_cache: r.from_cache ?? true,
    error: r.error,
    success_rate: overallRate,
    successful_orders: totalSuccess,
    returned_orders: r.returned_orders ?? totalCancel,
    cancelled_orders: r.cancelled_orders ?? totalCancel,
  };
}

function mapCacheRow(row: CacheRow): BDCourierResult {
  const rate = row.success_rate ?? 0;
  const rawData = row.raw_data && typeof row.raw_data === "object" ? row.raw_data : {};
  const courierData = rawData?.data?.Summaries || rawData?.data?.summaries || rawData?.courier_data || {};

  return mapResult({
    risk_level: (row.total_orders ?? 0) > 0 ? getRiskFromRate(rate) : "new_customer",
    overall_success_rate: rate,
    total_orders: row.total_orders ?? 0,
    total_success: row.successful_orders ?? 0,
    total_cancel: (row.returned_orders ?? 0) + (row.cancelled_orders ?? 0),
    returned_orders: row.returned_orders ?? 0,
    cancelled_orders: row.cancelled_orders ?? 0,
    courier_data: courierData,
    last_fetched_at: row.last_fetched_at,
    from_cache: true,
  });
}

let rateLimitTs = 0;
function isRateLimited(): boolean {
  return Date.now() - rateLimitTs < 30 * 60 * 1000;
}
function setRateLimited() {
  rateLimitTs = Date.now();
  console.warn("BD Courier API daily limit reached — pausing calls for 30 min");
}

function getRiskFromRate(rate: number | null | undefined): string {
  if (rate == null) return "new_customer";
  if (rate >= 80) return "low";
  if (rate >= 60) return "medium";
  return "high";
}

export function useBDCourierBulk(phones: string[], enabled = true) {
  const normalizedPhones = [...new Set(phones.map(normalizePhone).filter(Boolean))];
  const sortedKey = [...normalizedPhones].sort().join(",");

  return useQuery({
    queryKey: ["bd-courier-bulk", sortedKey],
    queryFn: async (): Promise<Record<string, BDCourierResult>> => {
      if (!normalizedPhones.length) return {};

      const results: Record<string, BDCourierResult> = {};
      const allPhoneVariants = [...new Set(normalizedPhones.flatMap(getPhoneVariants))];

      try {
        const { data: cached, error } = await supabase
          .from("customer_qc_cache")
          .select("phone, success_rate, total_orders, successful_orders, returned_orders, cancelled_orders, last_fetched_at, raw_data")
          .in("phone", allPhoneVariants);

        if (error) throw error;

        for (const row of (cached ?? []) as CacheRow[]) {
          const normalized = normalizePhone(row.phone);
          if (!normalized) continue;

          const fetchedTime = row.last_fetched_at ? new Date(row.last_fetched_at).getTime() : 0;
          const isExpired = fetchedTime > 0 && Date.now() - fetchedTime > 7 * 24 * 60 * 60 * 1000;

          if (!isExpired) {
            results[normalized] = mapCacheRow(row);
          }
        }
      } catch (error) {
        console.error("Cache lookup error:", error);
      }

      const uncached = normalizedPhones.filter((phone) => !results[phone]);
      if (!uncached.length || isRateLimited()) return results;

      const batchSize = 5;
      let hitRateLimit = false;

      for (let i = 0; i < uncached.length && !hitRateLimit; i += batchSize) {
        const batch = uncached.slice(i, i + batchSize);

        try {
          const { data, error } = await supabase.functions.invoke("bd-courier-check", {
            body: { phones: batch },
          });

          if (error) {
            console.error("BD Courier batch error:", error);
            break;
          }

          for (const [phone, result] of Object.entries((data?.results ?? {}) as Record<string, any>)) {
            const normalized = normalizePhone(phone);
            if (!normalized) continue;

            if (result?.error === "daily_limit_reached" || result?.error === "api_error") {
              hitRateLimit = true;
              setRateLimited();
              continue;
            }

            if (!result?.error) {
              results[normalized] = mapResult(result);
            }
          }
        } catch (error) {
          console.error("BD Courier batch error:", error);
          break;
        }

        if (i + batchSize < uncached.length && !hitRateLimit) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }

      return results;
    },
    enabled: enabled && normalizedPhones.length > 0,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 0,
  });
}

export function useBDCourierSingle(phone: string, enabled = true) {
  const normalizedPhone = normalizePhone(phone);

  return useQuery({
    queryKey: ["bd-courier-single", normalizedPhone],
    queryFn: async (): Promise<BDCourierResult | null> => {
      if (!normalizedPhone) return null;

      try {
        const variants = getPhoneVariants(normalizedPhone);
        const { data: cached, error } = await supabase
          .from("customer_qc_cache")
          .select("phone, success_rate, total_orders, successful_orders, returned_orders, cancelled_orders, last_fetched_at, raw_data")
          .in("phone", variants)
          .limit(1)
          .maybeSingle();

        if (error) throw error;

        if (cached) {
          const row = cached as CacheRow;
          const fetchedTime = row.last_fetched_at ? new Date(row.last_fetched_at).getTime() : 0;
          const isExpired = fetchedTime > 0 && Date.now() - fetchedTime > 7 * 24 * 60 * 60 * 1000;

          if (!isExpired) {
            return mapCacheRow(row);
          }
        }
      } catch {
        // fall through to edge function
      }

      if (isRateLimited()) return null;

      const { data, error } = await supabase.functions.invoke("bd-courier-check", {
        body: { phone: normalizedPhone },
      });

      if (error || !data || data.error) {
        if (data?.error === "daily_limit_reached" || data?.error === "api_error") setRateLimited();
        return null;
      }

      return mapResult(data);
    },
    enabled: enabled && !!normalizedPhone,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 0,
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
