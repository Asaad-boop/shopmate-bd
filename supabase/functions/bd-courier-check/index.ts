import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    const { phones: rawPhones, force } = await req.json();

    // Limit to 5 phones per invocation to avoid compute limits
    const phones = (rawPhones || []).slice(0, 5);

    if (!phones || !Array.isArray(phones) || phones.length === 0) {
      return new Response(JSON.stringify({ error: "phones array required" }), {
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

    // Check cache first (unless force refresh)
    if (!force) {
      const { data: cached } = await supabase
        .from("customer_qc_cache")
        .select("*")
        .in("phone", phones)
        .gte("last_fetched_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      cached?.forEach((c: any) => {
        results[c.phone] = {
          success_rate: c.success_rate,
          total_orders: c.total_orders,
          successful_orders: c.successful_orders,
          returned_orders: c.returned_orders,
          cancelled_orders: c.cancelled_orders,
          raw_data: c.raw_data,
          last_fetched_at: c.last_fetched_at,
          cached: true,
        };
      });
    }

    // Fetch uncached phones from BD Courier API
    const uncachedPhones = phones.filter((p: string) => !results[p]);

    for (const phone of uncachedPhones) {
      try {
        // Normalize phone: remove +88, spaces, dashes
        const normalizedPhone = phone.replace(/[\s\-\+]/g, "").replace(/^88/, "").replace(/^0/, "0");
        
        const response = await fetch(
          "https://api.bdcourier.com/courier-check",
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              "Accept": "application/json",
            },
            body: JSON.stringify({ phone: normalizedPhone }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          
          // Parse BD Courier response - new API format: data.data.summary
          const summary = data?.data?.summary || {};
          const totalOrders = summary.total_parcel || 0;
          const totalDelivered = summary.success_parcel || 0;
          const totalCancelled = summary.cancelled_parcel || 0;
          const totalReturned = totalCancelled;
          const successRate = summary.success_ratio ? Math.round(summary.success_ratio) : (totalOrders > 0 ? Math.round((totalDelivered / totalOrders) * 100) : 0);

          const record = {
            phone,
            success_rate: successRate,
            total_orders: totalOrders,
            successful_orders: totalDelivered,
            returned_orders: totalReturned,
            cancelled_orders: totalCancelled,
            raw_data: data,
            last_fetched_at: new Date().toISOString(),
          };

          // Upsert cache
          await supabase
            .from("customer_qc_cache")
            .upsert(record, { onConflict: "phone" });

          results[phone] = { ...record, cached: false };
        } else {
          const errText = await response.text();
          console.error(`BD Courier API error for ${phone}: ${response.status} ${errText}`);
          results[phone] = { error: "api_error", status: response.status };
        }
      } catch (err) {
        console.error(`BD Courier fetch error for ${phone}:`, err);
        results[phone] = { error: "fetch_error" };
      }
    }

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
