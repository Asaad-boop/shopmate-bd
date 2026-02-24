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
        datePreset = "";
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
        const { data: rateSetting } = await supabase
          .from("settings")
          .select("value")
          .eq("key", "meta_default_usd_rate")
          .maybeSingle();
        if (rateSetting?.value) {
          usdRate = parseFloat(rateSetting.value);
        } else {
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

        // Batch upsert all campaigns at once
        if (campaigns.length > 0) {
          const campaignRows = campaigns.map((camp: any) => ({
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
          }));
          await supabase.from("meta_campaigns").upsert(campaignRows, { onConflict: "meta_campaign_id" });
        }

        // 4. Fetch insights for ALL campaigns in PARALLEL (batches of 5)
        const BATCH_SIZE = 5;
        for (let i = 0; i < campaigns.length; i += BATCH_SIZE) {
          const batch = campaigns.slice(i, i + BATCH_SIZE);
          await Promise.all(batch.map((camp: any) => fetchAndStoreInsights(supabase, camp, account, datePreset, dateFrom, dateTo, usdRate)));
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

async function fetchAndStoreInsights(
  supabase: any, camp: any, account: any,
  datePreset: string, dateFrom: string, dateTo: string, usdRate: number
) {
  try {
    let insightsParams = `fields=campaign_id,campaign_name,spend,impressions,clicks,reach,actions,action_values,purchase_roas,cost_per_action_type,cpc,cpm,ctr&access_token=${account.access_token}`;
    if (dateFrom && dateTo) {
      insightsParams += `&time_range={"since":"${dateFrom}","until":"${dateTo}"}&time_increment=1`;
    } else {
      insightsParams += `&date_preset=${datePreset}`;
    }
    const insResp = await fetch(`${META_BASE_URL}/${camp.id}/insights?${insightsParams}`);
    if (!insResp.ok) { await insResp.text(); return; }

    const insData = await insResp.json();
    const insights = insData.data || [];
    if (insights.length === 0) return;

    // Get campaign internal ID once
    const { data: campRow } = await supabase
      .from("meta_campaigns")
      .select("id")
      .eq("meta_campaign_id", camp.id)
      .maybeSingle();

    // Prepare all metrics for batch upsert
    const metricRows: any[] = [];
    for (const insight of insights) {
      const spendUsd = parseFloat(insight.spend || "0");
      const spendBdt = spendUsd * usdRate;
      const impressions = parseInt(insight.impressions || "0");
      const clicks = parseInt(insight.clicks || "0");
      const reach = parseInt(insight.reach || "0");
      const cpc = parseFloat(insight.cpc || "0");
      const cpm = parseFloat(insight.cpm || "0");
      const ctr = parseFloat(insight.ctr || "0");

      let purchases = 0, purchaseValue = 0;
      if (insight.actions) {
        const pa = insight.actions.find((a: any) => a.action_type === "offsite_conversion.fb_pixel_purchase" || a.action_type === "purchase");
        if (pa) purchases = parseInt(pa.value || "0");
      }
      if (insight.action_values) {
        const pv = insight.action_values.find((a: any) => a.action_type === "offsite_conversion.fb_pixel_purchase" || a.action_type === "purchase");
        if (pv) purchaseValue = parseFloat(pv.value || "0");
      }

      const roas = spendUsd > 0 ? purchaseValue / spendUsd : 0;
      const cpo = purchases > 0 ? spendBdt / purchases : 0;
      const metricDate = insight.date_start || new Date().toISOString().split("T")[0];

      metricRows.push({
        campaign_id: campRow?.id,
        meta_campaign_id: camp.id,
        metric_date: metricDate,
        spend_usd: spendUsd,
        spend_bdt: spendBdt,
        usd_rate: usdRate,
        impressions, clicks, reach, purchases, purchase_value: purchaseValue,
        cpc, cpm, ctr, roas, cpo,
        synced_at: new Date().toISOString(),
      });
    }

    // Batch upsert all metrics at once
    const { data: upsertedMetrics } = await supabase
      .from("meta_campaign_metrics")
      .upsert(metricRows, { onConflict: "meta_campaign_id,metric_date" })
      .select("id,meta_campaign_id,metric_date,spend_bdt,spend_usd");

    // 5. Auto expense creation - batch check & insert
    if (campRow && upsertedMetrics) {
      const spendMetrics = upsertedMetrics.filter((m: any) => m.spend_usd > 0);
      if (spendMetrics.length === 0) return;

      const metricDates = spendMetrics.map((m: any) => m.metric_date);

      // Check existing expenses in one query
      const { data: existingExpenses } = await supabase
        .from("ad_expenses")
        .select("expense_date")
        .eq("campaign_id", campRow.id)
        .in("expense_date", metricDates);

      const existingDates = new Set((existingExpenses || []).map((e: any) => e.expense_date));
      const newMetrics = spendMetrics.filter((m: any) => !existingDates.has(m.metric_date));
      if (newMetrics.length === 0) return;

      // Get product links once
      const { data: productLinks } = await supabase
        .from("campaign_products")
        .select("*")
        .eq("campaign_id", campRow.id);

      const expenseRows: any[] = [];
      for (const metric of newMetrics) {
        if (productLinks && productLinks.length > 0) {
          for (const link of productLinks) {
            expenseRows.push({
              expense_date: metric.metric_date,
              category: "meta_ads",
              sub_category: camp.name,
              amount_bdt: metric.spend_bdt * (link.allocation_pct / 100),
              currency: "USD",
              exchange_rate: usdRate,
              product_id: link.product_id,
              campaign_id: campRow.id,
              metric_id: metric.id,
              allocation_type: "campaign",
              ref_id: metric.id,
              note: "Auto-synced from Meta Ads",
              created_by: "system",
            });
          }
        } else {
          expenseRows.push({
            expense_date: metric.metric_date,
            category: "meta_ads_unassigned",
            sub_category: camp.name,
            amount_bdt: metric.spend_bdt,
            currency: "USD",
            exchange_rate: usdRate,
            campaign_id: campRow.id,
            metric_id: metric.id,
            ref_id: metric.id,
            note: "Auto-synced from Meta Ads (no product linked)",
            created_by: "system",
          });
        }
      }

      if (expenseRows.length > 0) {
        await supabase.from("ad_expenses").insert(expenseRows);
      }
    }
  } catch (err) {
    console.error(`Error fetching insights for campaign ${camp.id}:`, err);
  }
}
