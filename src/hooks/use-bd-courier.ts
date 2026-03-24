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

function mapResult(r: any): BDCourierResult {
  return {
    risk_level: r.risk_level || "unknown",
    overall_success_rate: r.overall_success_rate ?? 0,
    total_orders: r.total_orders ?? 0,
    total_success: r.total_success ?? 0,
    total_cancel: r.total_cancel ?? 0,
    courier_data: r.courier_data,
    fetched_at: r.fetched_at,
    from_cache: r.from_cache ?? true,
    error: r.error,
    success_rate: r.overall_success_rate ?? r.success_rate ?? 0,
    successful_orders: r.total_success ?? r.successful_orders ?? 0,
    returned_orders: r.total_cancel ?? r.returned_orders ?? 0,
    cancelled_orders: r.total_cancel ?? r.cancelled_orders ?? 0,
  };
}

// Session-level rate limit tracker — stops hammering API when daily limit reached
let _rateLimitTs = 0;
function _rateLimitedUntil(): boolean {
  return Date.now() - _rateLimitTs < 30 * 60 * 1000;
}
function _setRateLimited() {
  _rateLimitTs = Date.now();
  console.warn("BD Courier API daily limit reached — pausing calls for 30 min");
}

/**
 * Optimized bulk courier check:
 * 1. First check Supabase cache (customer_qc_cache) for ALL phones in ONE query
 * 2. Only call edge function for uncached/expired phones
 * 3. Stagger API calls to avoid 429 rate limits
 * 4. Stop calling when daily API limit is reached
 */
export function useBDCourierBulk(phones: string[], enabled = true) {
  // Stabilize the key to avoid re-fetching on every render
  const uniquePhones = [...new Set(phones.filter(Boolean))];
  const sortedKey = uniquePhones.sort().join(",");

  return useQuery({
    queryKey: ["bd-courier-bulk", sortedKey],
    queryFn: async (): Promise<Record<string, BDCourierResult>> => {
      const uniquePhones = [...new Set(phones.filter(Boolean))];
      if (!uniquePhones.length) return {};

      const results: Record<string, BDCourierResult> = {};

      // Step 1: Check cache first (ONE query for all phones)
      try {
        const { data: cached } = await supabase
          .from("customer_qc_cache")
          .select("phone, success_rate, total_orders, successful_orders, returned_orders, cancelled_orders, last_fetched_at, raw_data")
          .in("phone", uniquePhones);

        if (cached) {
          for (const row of cached) {
            const fetchedAt = row.last_fetched_at ? new Date(row.last_fetched_at).getTime() : 0;
            const isExpired = Date.now() - fetchedAt > 7 * 24 * 60 * 60 * 1000;

            if (!isExpired && row.phone) {
              const rate = row.success_rate ?? 0;
              results[row.phone] = mapResult({
                risk_level: getRiskFromRate(rate),
                overall_success_rate: rate,
                total_orders: row.total_orders ?? 0,
                total_success: row.successful_orders ?? 0,
                total_cancel: (row.returned_orders ?? 0) + (row.cancelled_orders ?? 0),
                from_cache: true,
                fetched_at: row.last_fetched_at,
              });
            }
          }
        }
      } catch (e) {
        console.error("Cache lookup error:", e);
      }

      // Step 2: Find uncached phones
      const uncached = uniquePhones.filter((p) => !results[p]);

      // Step 3: Only call edge function if we have uncached phones AND not rate-limited
      // Check session-level rate limit flag to avoid wasting calls
      if (uncached.length > 0 && !_rateLimitedUntil()) {
        const batchSize = 5;
        let hitRateLimit = false;
        for (let i = 0; i < uncached.length && !hitRateLimit; i += batchSize) {
          const batch = uncached.slice(i, i + batchSize);
          try {
            const { data, error } = await supabase.functions.invoke("bd-courier-check", {
              body: { phones: batch },
            });
            if (!error && data?.results) {
              for (const [ph, r] of Object.entries(data.results as Record<string, any>)) {
                if (r.error === "daily_limit_reached" || r.error === "api_error") {
                  // Stop fetching — API limit hit
                  hitRateLimit = true;
                  _setRateLimited();
                } else if (!r.error) {
                  results[ph] = mapResult(r);
                }
              }
            }
            if (data?.error === "daily_limit_reached") {
              hitRateLimit = true;
              _setRateLimited();
            }
          } catch (e) {
            console.error("BD Courier batch error:", e);
            break; // Stop on network errors too
          }
          if (i + batchSize < uncached.length && !hitRateLimit) {
            await new Promise((r) => setTimeout(r, 300));
          }
        }
      }

      return results;
    },
    enabled: enabled && phones.length > 0,
    staleTime: 10 * 60 * 1000, // 10 minutes - data doesn't change fast
    gcTime: 15 * 60 * 1000,
    retry: 0, // Don't retry on failure - saves API quota
  });
}

function getRiskFromRate(rate: number | null | undefined): string {
  if (rate == null) return "new_customer";
  if (rate >= 80) return "low";
  if (rate >= 60) return "medium";
  return "high";
}

export function useBDCourierSingle(phone: string, enabled = true) {
  return useQuery({
    queryKey: ["bd-courier-single", phone],
    queryFn: async (): Promise<BDCourierResult | null> => {
      if (!phone || phone.length < 8) return null;

      // Check cache first
      try {
        const { data: cached } = await supabase
          .from("customer_qc_cache")
          .select("phone, success_rate, total_orders, successful_orders, returned_orders, cancelled_orders, last_fetched_at")
          .eq("phone", phone)
          .maybeSingle();

        if (cached?.last_fetched_at) {
          const age = Date.now() - new Date(cached.last_fetched_at).getTime();
          if (age < 7 * 24 * 60 * 60 * 1000) {
            const rate = cached.success_rate ?? 0;
            return mapResult({
              risk_level: getRiskFromRate(rate),
              overall_success_rate: rate,
              total_orders: cached.total_orders ?? 0,
              total_success: cached.successful_orders ?? 0,
              total_cancel: (cached.returned_orders ?? 0) + (cached.cancelled_orders ?? 0),
              from_cache: true,
              fetched_at: cached.last_fetched_at,
            });
          }
        }
      } catch {}

      // Skip API call if rate-limited
      if (_rateLimitedUntil()) return null;

      const { data, error } = await supabase.functions.invoke("bd-courier-check", {
        body: { phone },
      });

      if (error || !data || data.error) {
        if (data?.error === "daily_limit_reached") _setRateLimited();
        return null;
      }

      return mapResult(data);
    },
    enabled: enabled && !!phone && phone.length >= 8,
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
