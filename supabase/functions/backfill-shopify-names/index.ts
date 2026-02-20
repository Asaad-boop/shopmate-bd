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

    // Get Shopify credentials from settings
    const { data: settings } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", ["shopify_store_url", "shopify_api_token"]);

    const settingsMap: Record<string, string> = {};
    settings?.forEach((s: any) => { settingsMap[s.key] = s.value; });

    const storeUrl = settingsMap["shopify_store_url"]?.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const apiToken = settingsMap["shopify_api_token"];

    if (!storeUrl || !apiToken) {
      return new Response(JSON.stringify({ error: "Shopify credentials not configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all unmatched order items with shopify_order_id
    const { data: unmatchedItems, error: fetchError } = await supabase
      .from("order_items")
      .select("id, order_id, unit_price, quantity, orders!inner(shopify_order_id)")
      .is("product_id", null)
      .is("product_name_fallback", null);

    if (fetchError) throw fetchError;

    // Filter to only items with shopify orders
    const itemsToFix = (unmatchedItems || []).filter(
      (item: any) => item.orders?.shopify_order_id
    );

    console.log(`Found ${itemsToFix.length} unmatched items to backfill`);

    // Group by shopify_order_id to minimize API calls
    const orderGroups: Record<string, any[]> = {};
    for (const item of itemsToFix) {
      const shopifyId = (item as any).orders.shopify_order_id;
      if (!orderGroups[shopifyId]) orderGroups[shopifyId] = [];
      orderGroups[shopifyId].push(item);
    }

    let updated = 0;
    let matched = 0;
    const errors: string[] = [];

    for (const [shopifyOrderId, items] of Object.entries(orderGroups)) {
      try {
        // Fetch order from Shopify API
        const res = await fetch(
          `https://${storeUrl}/admin/api/2024-01/orders/${shopifyOrderId}.json?fields=id,line_items`,
          {
            headers: {
              "X-Shopify-Access-Token": apiToken,
              "Content-Type": "application/json",
            },
          }
        );

        if (!res.ok) {
          const errText = await res.text();
          errors.push(`Order ${shopifyOrderId}: ${res.status} - ${errText}`);
          continue;
        }

        const { order } = await res.json();
        if (!order?.line_items) continue;

        // Match line items by price + quantity
        for (const item of items) {
          const unitPrice = parseFloat(item.unit_price);
          const qty = item.quantity;

          // Find matching Shopify line item
          const match = order.line_items.find((li: any) =>
            Math.abs(parseFloat(li.price) - unitPrice) < 0.01 && li.quantity === qty
          );

          if (match) {
            const fallbackName = match.title || match.name || "Shopify Product";

            // Also try to match with local products by variant_id or sku
            let productId: string | null = null;

            if (match.variant_id) {
              const { data: prod } = await supabase
                .from("products")
                .select("id, landed_cost_bdt")
                .eq("shopify_variant_id", String(match.variant_id))
                .maybeSingle();
              if (prod) productId = prod.id;
            }

            if (!productId && match.sku) {
              const { data: prod } = await supabase
                .from("products")
                .select("id, landed_cost_bdt")
                .eq("sku", match.sku)
                .maybeSingle();
              if (prod) productId = prod.id;
            }

            const updateData: any = {
              product_name_fallback: fallbackName,
            };
            if (productId) {
              updateData.product_id = productId;
              matched++;
            }

            await supabase
              .from("order_items")
              .update(updateData)
              .eq("id", item.id);

            updated++;
          }
        }

        // Rate limit: Shopify allows 2 req/sec
        await new Promise((r) => setTimeout(r, 600));
      } catch (err) {
        errors.push(`Order ${shopifyOrderId}: ${err.message}`);
      }
    }

    console.log(`Backfill complete: ${updated} updated, ${matched} matched to products`);

    return new Response(
      JSON.stringify({
        success: true,
        total_unmatched: itemsToFix.length,
        updated,
        matched_to_products: matched,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Backfill error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
