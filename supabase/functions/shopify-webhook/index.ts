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

    if (topic === "orders/create") {
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
          shopify_order_id: String(body.id),
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

      // Create order items — match products by variant_id or sku
      if (body.line_items && body.line_items.length > 0) {
        const items = [];
        for (const lineItem of body.line_items) {
          let productId: string | null = null;
          let productNameFallback: string | null = null;
          let unitCost = 0;

          // Try to match product by shopify_variant_id or sku
          if (lineItem.variant_id || lineItem.sku) {
            const conditions = [];
            if (lineItem.variant_id) conditions.push(`shopify_variant_id.eq.${lineItem.variant_id}`);
            if (lineItem.sku) conditions.push(`sku.eq.${lineItem.sku}`);

            const { data: matchedProduct } = await supabase
              .from("products")
              .select("id, name, image_url, sku, landed_cost_bdt")
              .or(conditions.join(","))
              .maybeSingle();

            if (matchedProduct) {
              productId = matchedProduct.id;
              unitCost = matchedProduct.landed_cost_bdt || 0;
            } else {
              // No match found, save title as fallback
              productNameFallback = lineItem.title || lineItem.name || "Shopify Product";
            }
          } else {
            productNameFallback = lineItem.title || lineItem.name || "Shopify Product";
          }

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

        // Calculate cost_of_goods
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
