import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-shopify-topic, x-shopify-hmac-sha256, x-shopify-shop-domain",
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

    const topic = req.headers.get("x-shopify-topic");
    const shopDomain = req.headers.get("x-shopify-shop-domain");
    const body = await req.json();

    console.log(`Webhook received: ${topic} from ${shopDomain}`);

    // ── Check sync settings ──
    const { data: syncSettings } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", ["shopify_sync_enabled", "shopify_sync_from_date"]);

    const settingsMap: Record<string, string> = {};
    syncSettings?.forEach((s: any) => { settingsMap[s.key] = s.value || ""; });

    const syncEnabled = settingsMap["shopify_sync_enabled"] === "true";
    const syncFromDate = settingsMap["shopify_sync_from_date"] || "";

    if (!syncEnabled) {
      console.log("Shopify sync is disabled – ignoring webhook");
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "sync_disabled" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (topic === "orders/create") {
      // Check sync-from-date filter
      if (syncFromDate) {
        const orderCreatedAt = body.created_at ? new Date(body.created_at) : new Date();
        const fromDate = new Date(syncFromDate + "T00:00:00Z");
        if (orderCreatedAt < fromDate) {
          console.log(`Order date ${orderCreatedAt.toISOString()} is before sync-from ${syncFromDate} – skipping`);
          return new Response(JSON.stringify({ success: true, skipped: true, reason: "before_sync_date" }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // ── Duplicate check via shopify_order_id ──
      const shopifyId = String(body.id);
      const { data: existingOrder } = await supabase
        .from("orders")
        .select("id")
        .eq("shopify_order_id", shopifyId)
        .maybeSingle();

      if (existingOrder) {
        console.log(`Duplicate shopify_order_id ${shopifyId} – skipping`);
        return new Response(JSON.stringify({ success: true, skipped: true, reason: "duplicate", existing_order_id: existingOrder.id }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Extract customer info
      const shopifyCustomer = body.customer || {};
      const shippingAddress = body.shipping_address || {};

      // Find or create customer
      let customerId: string | null = null;
      const phone = shopifyCustomer.phone || shippingAddress.phone || body.phone || "";
      const fullName = `${shippingAddress.first_name || shopifyCustomer.first_name || ""} ${shippingAddress.last_name || shopifyCustomer.last_name || ""}`.trim() || "Shopify Customer";

      if (phone) {
        const { data: existingCustomer } = await supabase
          .from("customers")
          .select("id")
          .eq("phone", phone)
          .maybeSingle();

        if (existingCustomer) {
          customerId = existingCustomer.id;
        } else {
          const { data: newCustomer } = await supabase
            .from("customers")
            .insert({
              full_name: fullName,
              phone: phone,
              email: shopifyCustomer.email || null,
              address: `${shippingAddress.address1 || ""} ${shippingAddress.address2 || ""}`.trim(),
              district: shippingAddress.city || null,
              source: "shopify",
            })
            .select("id")
            .single();
          customerId = newCustomer?.id || null;
        }
      }

      // Create order
      const orderNumber = `SH-${body.order_number || body.id}`;
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          order_number: orderNumber,
          channel: "shopify",
          shopify_order_id: shopifyId,
          shopify_order_number: String(body.order_number || ""),
          customer_id: customerId,
          status: "pending",
          web_order_status: "processing",
          payment_status: body.financial_status || "pending",
          payment_method: body.gateway || null,
          subtotal: parseFloat(body.subtotal_price || "0"),
          discount: parseFloat(body.total_discounts || "0"),
          delivery_charge: parseFloat(body.total_shipping_price_set?.shop_money?.amount || "0"),
          total_amount: parseFloat(body.total_price || "0"),
          delivery_address: `${shippingAddress.address1 || ""} ${shippingAddress.address2 || ""}, ${shippingAddress.city || ""}`.trim(),
          delivery_district: shippingAddress.city || null,
          notes: body.note || null,
        })
        .select("id")
        .single();

      if (orderError) {
        console.error("Order insert error:", orderError);
        return new Response(JSON.stringify({ error: orderError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create order items
      if (body.line_items && body.line_items.length > 0) {
        const items = [];
        for (const lineItem of body.line_items) {
          let product: any = null;
          let unitCost = 0;

          if (lineItem.variant_id) {
            const { data } = await supabase
              .from("products")
              .select("id, name, image_url, sku, landed_cost_bdt")
              .eq("shopify_variant_id", String(lineItem.variant_id))
              .maybeSingle();
            product = data;
          }

          if (!product && lineItem.sku) {
            const { data } = await supabase
              .from("products")
              .select("id, name, image_url, sku, landed_cost_bdt")
              .eq("sku", lineItem.sku)
              .maybeSingle();
            product = data;
          }

          const productId = product?.id || null;
          const productNameFallback = product ? null : (lineItem.title || lineItem.name || "Shopify Product");
          unitCost = product?.landed_cost_bdt || 0;

          console.log(`Line item "${lineItem.title}" → product_id: ${productId}, sku: ${lineItem.sku}, variant: ${lineItem.variant_id}`);

          items.push({
            order_id: order.id,
            product_id: productId,
            product_name_fallback: productNameFallback,
            quantity: lineItem.quantity,
            unit_price: parseFloat(lineItem.price || "0"),
            unit_cost: unitCost,
            total_price: parseFloat(lineItem.price || "0") * lineItem.quantity,
            discount: parseFloat(lineItem.total_discount || "0"),
          });
        }

        await supabase.from("order_items").insert(items);

        const costOfGoods = items.reduce((s, i) => s + (i.unit_cost * i.quantity), 0);
        if (costOfGoods > 0) {
          await supabase.from("orders").update({
            cost_of_goods: costOfGoods,
            gross_profit: parseFloat(body.total_price || "0") - costOfGoods,
          }).eq("id", order.id);
        }
      }

      // Create notification
      await supabase.from("notifications").insert({
        title: "🛍️ নতুন Shopify Order",
        message: `Order ${orderNumber} - ৳${body.total_price} from ${fullName}`,
        type: "shopify_order",
        related_type: "order",
        related_id: order.id,
      });

      console.log(`Order created: ${orderNumber}`);
      return new Response(JSON.stringify({ success: true, order_id: order.id }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle other topics
    return new Response(JSON.stringify({ success: true, topic }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
