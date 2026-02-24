import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const META_API_VERSION = "v19.0";
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Parse optional body params
    let datePreset = "today";
    let dateFrom = "";
    let dateTo = "";
    let manualUsdRate: number | null = null;
    try {
      const body = await req.json();
      if (body.date_preset) datePreset = body.date_preset;
      if (body.date_from && body.date_to) {
        dateFrom = body.date_from;
        dateTo = body.date_to;
        datePreset = ""; // will use time_range instead
      }
      if (body.usd_rate) manualUsdRate = body.usd_rate;
    } catch { /* no body is fine */ }

    // 1. Get all active ad accounts
    const { data: accounts, error: accErr } = await supabase
      .from("meta_ad_accounts")
      .select("*")
      .eq("is_active", true);

    if (accErr) throw accErr;
    if (!accounts || accounts.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No active Meta ad accounts found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Fetch USD rate
    let usdRate = 110;
    try {
      if (manualUsdRate) {
        usdRate = manualUsdRate;
      } else {
        // Check settings for default rate
        const { data: rateSetting } = await supabase
          .from("settings")
          .select("value")
          .eq("key", "meta_default_usd_rate")
          .maybeSingle();
        
        if (rateSetting?.value) {
          usdRate = parseFloat(rateSetting.value);
        } else {
          // Fetch from API
          const rateResp = await fetch("https://api.exchangerate-api.com/v4/latest/USD");
          if (rateResp.ok) {
            const rateData = await rateResp.json();
            usdRate = rateData.rates?.BDT || 110;
          }
        }
      }
    } catch {
      console.log("Failed to fetch USD rate, using default:", usdRate);
    }

    const results: any[] = [];

    for (const account of accounts) {
      try {
        // 3. Fetch campaigns
        const campaignsUrl = `${META_BASE_URL}/act_${account.meta_account_id}/campaigns?fields=id,name,objective,status,daily_budget,lifetime_budget,start_time,stop_time&access_token=${account.access_token}&limit=500`;
        const campResp = await fetch(campaignsUrl);
        
        if (!campResp.ok) {
          const errData = await campResp.json();
          results.push({ account: account.meta_account_id, error: errData.error?.message || "API error" });
          continue;
        }

        const campData = await campResp.json();
        const campaigns = campData.data || [];

        // Upsert campaigns
        for (const camp of campaigns) {
          await supabase.from("meta_campaigns").upsert({
            meta_campaign_id: camp.id,
            meta_account_id: account.meta_account_id,
            campaign_name: camp.name,
            objective: camp.objective,
            status: camp.status,
            daily_budget: camp.daily_budget ? parseFloat(camp.daily_budget) / 100 : null,
            lifetime_budget: camp.lifetime_budget ? parseFloat(camp.lifetime_budget) / 100 : null,
            start_date: camp.start_time ? camp.start_time.split("T")[0] : null,
            end_date: camp.stop_time ? camp.stop_time.split("T")[0] : null,
            synced_at: new Date().toISOString(),
          }, { onConflict: "meta_campaign_id" });
        }

        // 4. Fetch insights for each campaign
        for (const camp of campaigns) {
          try {
            let insightsParams = `fields=campaign_id,campaign_name,spend,impressions,clicks,reach,actions,action_values,purchase_roas,cost_per_action_type,cpc,cpm,ctr&access_token=${account.access_token}`;
            if (dateFrom && dateTo) {
              insightsParams += `&time_range={"since":"${dateFrom}","until":"${dateTo}"}&time_increment=1`;
            } else {
              insightsParams += `&date_preset=${datePreset}`;
            }
            const insightsUrl = `${META_BASE_URL}/${camp.id}/insights?${insightsParams}`;
            const insResp = await fetch(insightsUrl);
            
            if (!insResp.ok) continue;
            
            const insData = await insResp.json();
            const insights = insData.data || [];

            for (const insight of insights) {
              const spendUsd = parseFloat(insight.spend || "0");
              const spendBdt = spendUsd * usdRate;
              const impressions = parseInt(insight.impressions || "0");
              const clicks = parseInt(insight.clicks || "0");
              const reach = parseInt(insight.reach || "0");
              const cpc = parseFloat(insight.cpc || "0");
              const cpm = parseFloat(insight.cpm || "0");
              const ctr = parseFloat(insight.ctr || "0");

              // Extract purchases from actions
              let purchases = 0;
              let purchaseValue = 0;
              if (insight.actions) {
                const purchaseAction = insight.actions.find(
                  (a: any) => a.action_type === "offsite_conversion.fb_pixel_purchase" || a.action_type === "purchase"
                );
                if (purchaseAction) purchases = parseInt(purchaseAction.value || "0");
              }
              if (insight.action_values) {
                const purchaseVal = insight.action_values.find(
                  (a: any) => a.action_type === "offsite_conversion.fb_pixel_purchase" || a.action_type === "purchase"
                );
                if (purchaseVal) purchaseValue = parseFloat(purchaseVal.value || "0");
              }

              const roas = spendUsd > 0 ? purchaseValue / spendUsd : 0;
              const cpo = purchases > 0 ? spendBdt / purchases : 0;
              const metricDate = insight.date_start || new Date().toISOString().split("T")[0];

              // Get campaign internal ID
              const { data: campRow } = await supabase
                .from("meta_campaigns")
                .select("id")
                .eq("meta_campaign_id", camp.id)
                .maybeSingle();

              // Upsert metric
              const { data: metricRow } = await supabase
                .from("meta_campaign_metrics")
                .upsert({
                  campaign_id: campRow?.id,
                  meta_campaign_id: camp.id,
                  metric_date: metricDate,
                  spend_usd: spendUsd,
                  spend_bdt: spendBdt,
                  usd_rate: usdRate,
                  impressions,
                  clicks,
                  reach,
                  purchases,
                  purchase_value: purchaseValue,
                  cpc,
                  cpm,
                  ctr,
                  roas,
                  cpo,
                  synced_at: new Date().toISOString(),
                }, { onConflict: "meta_campaign_id,metric_date" })
                .select("id")
                .maybeSingle();

              // 5. Auto expense creation
              if (campRow && spendUsd > 0) {
                // Check if expense already exists
                const { data: existingExpense } = await supabase
                  .from("ad_expenses")
                  .select("id")
                  .eq("campaign_id", campRow.id)
                  .eq("expense_date", metricDate)
                  .limit(1);

                if (!existingExpense || existingExpense.length === 0) {
                  // Get campaign product links
                  const { data: productLinks } = await supabase
                    .from("campaign_products")
                    .select("*")
                    .eq("campaign_id", campRow.id);

                  if (productLinks && productLinks.length > 0) {
                    for (const link of productLinks) {
                      const allocatedSpend = spendBdt * (link.allocation_pct / 100);
                      await supabase.from("ad_expenses").insert({
                        expense_date: metricDate,
                        category: "meta_ads",
                        sub_category: camp.name,
                        amount_bdt: allocatedSpend,
                        currency: "USD",
                        exchange_rate: usdRate,
                        product_id: link.product_id,
                        campaign_id: campRow.id,
                        metric_id: metricRow?.id,
                        allocation_type: "campaign",
                        ref_id: metricRow?.id,
                        note: "Auto-synced from Meta Ads",
                        created_by: "system",
                      });
                    }
                  } else {
                    // No product link — unassigned
                    await supabase.from("ad_expenses").insert({
                      expense_date: metricDate,
                      category: "meta_ads_unassigned",
                      sub_category: camp.name,
                      amount_bdt: spendBdt,
                      currency: "USD",
                      exchange_rate: usdRate,
                      campaign_id: campRow.id,
                      metric_id: metricRow?.id,
                      ref_id: metricRow?.id,
                      note: "Auto-synced from Meta Ads (no product linked)",
                      created_by: "system",
                    });
                  }
                }
              }
            }
          } catch (campErr) {
            console.error(`Error fetching insights for campaign ${camp.id}:`, campErr);
          }
        }

        results.push({
          account: account.meta_account_id,
          campaigns_synced: campaigns.length,
          usd_rate: usdRate,
        });
      } catch (accError) {
        results.push({ account: account.meta_account_id, error: String(accError) });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results, usd_rate: usdRate }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
