import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { phone, phones: rawPhones, force } = await req.json();

    // Support both single phone and batch mode
    const phoneList: string[] = phone ? [phone] : (rawPhones || []).slice(0, 5);

    if (!phoneList.length) {
      return new Response(JSON.stringify({ error: "phone or phones required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get API key from settings
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

    // Check cache first (unless force refresh) — 7 day cache
    if (!force) {
      const { data: cached } = await supabase
        .from("customer_qc_cache")
        .select("*")
        .in("phone", phoneList)
        .gt("cache_expires_at", new Date().toISOString());

      cached?.forEach((c: any) => {
        results[c.phone] = {
          from_cache: true,
          risk_level: c.risk_level || "unknown",
          overall_success_rate: c.overall_success_rate ?? c.success_rate ?? 0,
          total_orders: c.total_orders ?? 0,
          total_success: c.total_success ?? c.successful_orders ?? 0,
          total_cancel: c.total_cancel ?? c.cancelled_orders ?? 0,
          courier_data: c.courier_data || c.raw_data || {},
          fetched_at: c.fetched_at || c.last_fetched_at,
        };
      });
    }

    // Check daily limit BEFORE making any API calls
    const { count: dailyCount } = await supabase
      .from("bdcourier_api_log")
      .select("*", { count: "exact", head: true })
      .eq("call_date", today)
      .eq("success", true);

    const uncachedPhones = phoneList.filter((p: string) => !results[p]);

    // If daily limit reached, return early with error for all uncached phones
    if ((dailyCount || 0) >= 490 && uncachedPhones.length > 0) {
      for (const ph of uncachedPhones) {
        results[ph] = { error: "daily_limit_reached", used: dailyCount, limit: 500 };
      }

      if (phone && !rawPhones) {
        return new Response(JSON.stringify(results[phone] || { error: "daily_limit_reached" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ results }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const ph of uncachedPhones) {

      try {
        // Normalize phone: remove +88, spaces, dashes
        const normalizedPhone = ph.replace(/[\s\-\+]/g, "").replace(/^88/, "");

        const response = await fetch("https://bdcourier.com/api/courier-check", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
            "Accept": "application/json",
          },
          body: JSON.stringify({ phone: normalizedPhone }),
        });

        if (response.ok) {
          const data = await response.json();

          // Parse response — BD Courier returns data.data.summary
          const summary = data?.data?.summary || data?.data?.totalSummary || {};
          const courierSummaries = data?.data?.Summaries || data?.data?.summaries || {};
          
          const totalOrders = summary.total_parcel || summary.total || 0;
          const totalSuccess = summary.success_parcel || summary.success || 0;
          const totalCancel = summary.cancelled_parcel || summary.cancel || 0;
          const successRate = summary.success_ratio 
            ? Math.round(summary.success_ratio) 
            : (totalOrders > 0 ? Math.round((totalSuccess / totalOrders) * 100) : 0);

          // Determine risk level
          let riskLevel = "unknown";
          if (totalOrders === 0) riskLevel = "new_customer";
          else if (successRate >= 80) riskLevel = "low";
          else if (successRate >= 60) riskLevel = "medium";
          else riskLevel = "high";

          const cacheData = {
            phone: ph,
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
            fetched_at: new Date().toISOString(),
            last_fetched_at: new Date().toISOString(),
            cache_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          };

          // Upsert cache
          await supabase
            .from("customer_qc_cache")
            .upsert(cacheData, { onConflict: "phone" });

          // Log successful API call
          await supabase
            .from("bdcourier_api_log")
            .insert({ phone_number: ph, success: true, call_date: today });

          results[ph] = {
            from_cache: false,
            risk_level: riskLevel,
            overall_success_rate: successRate,
            total_orders: totalOrders,
            total_success: totalSuccess,
            total_cancel: totalCancel,
            courier_data: courierSummaries,
            fetched_at: cacheData.fetched_at,
          };
        } else {
          const errText = await response.text();
          console.error(`BD Courier API error for ${ph}: ${response.status} ${errText}`);
          
          // Log failed call
          await supabase
            .from("bdcourier_api_log")
            .insert({ phone_number: ph, success: false, call_date: today });

          results[ph] = { error: "api_error", status: response.status };
        }
      } catch (err) {
        console.error(`BD Courier fetch error for ${ph}:`, err);
        
        await supabase
          .from("bdcourier_api_log")
          .insert({ phone_number: ph, success: false, call_date: today });

        results[ph] = { error: "fetch_error" };
      }
    }

    // Single phone mode returns flat result
    if (phone && !rawPhones) {
      return new Response(JSON.stringify(results[phone] || { error: "no_result" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Batch mode returns { results: { ... } }
    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("BD Courier check error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
