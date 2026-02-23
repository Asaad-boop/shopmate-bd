import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("BULKSMSBD_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "BULKSMSBD_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { to, message, sender_id, action } = await req.json();

    // Test connection action
    if (action === "test") {
      const res = await fetch(
        `https://bulksmsbd.net/api/getBalanceApi?api_key=${encodeURIComponent(apiKey)}`
      );
      const data = await res.json();
      if (!res.ok) {
        return new Response(
          JSON.stringify({ error: "API test failed", details: data }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ success: true, balance: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send SMS
    if (!to || !message) {
      return new Response(
        JSON.stringify({ error: "Missing 'to' or 'message' field" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const smsPayload = {
      api_key: apiKey,
      senderid: sender_id || "8809617618618",
      number: to,
      message: message,
    };

    const res = await fetch("https://bulksmsbd.net/api/smsapi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(smsPayload),
    });

    const data = await res.json();

    if (data.response_code !== 202 && data.response_code !== 200) {
      console.error("BulkSMSBD error:", JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: data.error_message || "SMS sending failed", details: data }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`SMS sent to ${to}: ${data.response_code}`);
    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("SMS edge function error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
