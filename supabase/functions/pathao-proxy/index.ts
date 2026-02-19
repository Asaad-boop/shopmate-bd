import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PATHAO_BASE = Deno.env.get("PATHAO_BASE_URL") || "https://api-hermes.pathao.com";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

/* ──────── Token Management ──────── */
async function getToken(): Promise<string> {
  // Check cached token in settings table
  const { data: tokenRow } = await supabaseAdmin
    .from("settings")
    .select("value")
    .eq("key", "pathao_token")
    .maybeSingle();

  if (tokenRow?.value) {
    try {
      const cached = JSON.parse(tokenRow.value);
      // If token expires in more than 5 minutes, reuse it
      if (cached.expires_at && Date.now() < cached.expires_at - 5 * 60 * 1000) {
        return cached.access_token;
      }
    } catch { /* parse error, refresh */ }
  }

  // Issue new token
  const res = await fetch(`${PATHAO_BASE}/aladdin/api/v1/issue-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: Deno.env.get("PATHAO_CLIENT_ID"),
      client_secret: Deno.env.get("PATHAO_CLIENT_SECRET"),
      username: Deno.env.get("PATHAO_USERNAME"),
      password: Deno.env.get("PATHAO_PASSWORD"),
      grant_type: "password",
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Pathao token error:", errText);
    throw new Error(`Pathao auth failed: ${res.status}`);
  }

  const tokenData = await res.json();
  const accessToken = tokenData.access_token;
  const expiresIn = tokenData.expires_in || 3600; // seconds
  const expiresAt = Date.now() + expiresIn * 1000;

  // Cache token
  await supabaseAdmin
    .from("settings")
    .upsert(
      { key: "pathao_token", value: JSON.stringify({ access_token: accessToken, expires_at: expiresAt }) },
      { onConflict: "key" }
    );

  return accessToken;
}

/* ──────── Pathao API Proxy ──────── */
async function callPathao(
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<Response> {
  const token = await getToken();

  const opts: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  };
  if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(`${PATHAO_BASE}${path}`, opts);
  const data = await res.json();
  return new Response(JSON.stringify(data), {
    status: res.ok ? 200 : res.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/* ──────── Main Handler ──────── */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, ...params } = await req.json();

    switch (action) {
      /* ── Location APIs ── */
      case "cities":
        return callPathao("GET", "/aladdin/api/v1/countries/1/city-list");

      case "zones":
        if (!params.city_id) throw new Error("city_id required");
        return callPathao("GET", `/aladdin/api/v1/cities/${params.city_id}/zone-list`);

      case "areas":
        if (!params.zone_id) throw new Error("zone_id required");
        return callPathao("GET", `/aladdin/api/v1/zones/${params.zone_id}/area-list`);

      /* ── Store APIs ── */
      case "stores":
        return callPathao("GET", "/aladdin/api/v1/stores");

      case "create_store":
        return callPathao("POST", "/aladdin/api/v1/stores", params.store);

      /* ── Order APIs ── */
      case "create_order":
        return callPathao("POST", "/aladdin/api/v1/orders/bulk", params.order);

      case "track_order":
        if (!params.consignment_id) throw new Error("consignment_id required");
        return callPathao("GET", `/aladdin/api/v1/orders/${params.consignment_id}`);

      /* ── Price API ── */
      case "price_plan":
        return callPathao("POST", "/aladdin/api/v1/merchant/price-plan", params.price_data);

      /* ── Test Connection ── */
      case "test_connection": {
        const token = await getToken();
        // Read cached token to get expiry
        const { data: cachedRow } = await supabaseAdmin
          .from("settings")
          .select("value")
          .eq("key", "pathao_token")
          .maybeSingle();
        let expiresAt = null;
        if (cachedRow?.value) {
          try { expiresAt = JSON.parse(cachedRow.value).expires_at; } catch {}
        }
        return new Response(
          JSON.stringify({ success: true, token_preview: token.slice(0, 10) + "...", expires_at: expiresAt }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (err) {
    console.error("pathao-proxy error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
