import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

function getRiskFromRate(rate: number): string {
  if (rate >= 80) return "low";
  if (rate >= 60) return "medium";
  return "high";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { phone, phones: rawPhones, force } = await req.json();
    const inputPhones = phone ? [phone] : (rawPhones || []).slice(0, 5);
    const phoneList = [...new Set(inputPhones.map(normalizePhone).filter(Boolean))];

    if (!phoneList.length) {
      return new Response(JSON.stringify({ error: "phone or phones required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: apiKeySetting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "bdcourier_api_key")
      .maybeSingle();

    if (!apiKeySetting?.value) {
      return new Response(JSON.stringify({ error: "BD Courier API key not configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = apiKeySetting.value;
    const results: Record<string, any> = {};
    const today = new Date().toISOString().split("T")[0];

    if (!force) {
      const allPhoneVariants = [...new Set(phoneList.flatMap(getPhoneVariants))];
      const { data: cached } = await supabase
        .from("customer_qc_cache")
        .select("*")
        .in("phone", allPhoneVariants)
        .gt("cache_expires_at", new Date().toISOString());

      cached?.forEach((row: any) => {
        const normalized = normalizePhone(row.phone);
        if (!normalized) return;

        results[normalized] = {
          from_cache: true,
          risk_level: row.risk_level || "unknown",
          overall_success_rate: row.overall_success_rate ?? row.success_rate ?? 0,
          total_orders: row.total_orders ?? 0,
          total_success: row.total_success ?? row.successful_orders ?? 0,
          total_cancel: row.total_cancel ?? row.cancelled_orders ?? row.returned_orders ?? 0,
          courier_data: row.courier_data || row.raw_data || {},
          fetched_at: row.fetched_at || row.last_fetched_at,
        };
      });
    }

    const { count: dailyCount } = await supabase
      .from("bdcourier_api_log")
      .select("*", { count: "exact", head: true })
      .eq("call_date", today)
      .eq("success", true);

    const uncachedPhones = phoneList.filter((value) => !results[value]);

    if ((dailyCount || 0) >= 490 && uncachedPhones.length > 0) {
      for (const currentPhone of uncachedPhones) {
        results[currentPhone] = { error: "daily_limit_reached", used: dailyCount, limit: 500 };
      }

      if (phone && !rawPhones) {
        return new Response(JSON.stringify(results[phoneList[0]] || { error: "daily_limit_reached" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ results }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const currentPhone of uncachedPhones) {
      try {
        const response = await fetch("https://bdcourier.com/api/courier-check", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
            "Accept": "application/json",
          },
          body: JSON.stringify({ phone: currentPhone }),
        });

        if (response.ok) {
          const data = await response.json();
          const summary = data?.data?.summary || data?.data?.totalSummary || {};
          const courierSummaries = data?.data?.Summaries || data?.data?.summaries || {};

          const totalOrders = summary.total_parcel || summary.total || 0;
          const totalSuccess = summary.success_parcel || summary.success || 0;
          const totalCancel = summary.cancelled_parcel || summary.cancel || 0;
          const successRate = summary.success_ratio
            ? Math.round(summary.success_ratio)
            : (totalOrders > 0 ? Math.round((totalSuccess / totalOrders) * 100) : 0);

          const riskLevel = totalOrders === 0 ? "new_customer" : getRiskFromRate(successRate);
          const fetchedAt = new Date().toISOString();

          const cacheData = {
            phone: currentPhone,
            courier_data: courierSummaries,
            risk_level: riskLevel,
            overall_success_rate: successRate,
            success_rate: successRate,
            total_orders: totalOrders,
            total_success: totalSuccess,
            successful_orders: totalSuccess,
            total_cancel: totalCancel,
            cancelled_orders: totalCancel,
            returned_orders: totalCancel,
            raw_data: data,
            data_source: "api",
            fetched_at: fetchedAt,
            last_fetched_at: fetchedAt,
            cache_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          };

          await supabase.from("customer_qc_cache").upsert(cacheData, { onConflict: "phone" });
          await supabase.from("bdcourier_api_log").insert({ phone_number: currentPhone, success: true, call_date: today });

          results[currentPhone] = {
            from_cache: false,
            risk_level: riskLevel,
            overall_success_rate: successRate,
            total_orders: totalOrders,
            total_success: totalSuccess,
            total_cancel: totalCancel,
            courier_data: courierSummaries,
            fetched_at: fetchedAt,
          };
        } else {
          const errText = await response.text();
          console.error(`BD Courier API error for ${currentPhone}: ${response.status} ${errText}`);

          await supabase.from("bdcourier_api_log").insert({ phone_number: currentPhone, success: false, call_date: today });
          results[currentPhone] = { error: "api_error", status: response.status };
        }
      } catch (error) {
        console.error(`BD Courier fetch error for ${currentPhone}:`, error);

        await supabase.from("bdcourier_api_log").insert({ phone_number: currentPhone, success: false, call_date: today });
        results[currentPhone] = { error: "fetch_error" };
      }
    }

    if (phone && !rawPhones) {
      return new Response(JSON.stringify(results[phoneList[0]] || { error: "no_result" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("BD Courier check error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
