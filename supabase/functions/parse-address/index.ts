import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { address } = await req.json();
    if (!address || address.trim().length < 5) {
      return new Response(JSON.stringify({ district: null, thana: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a Bangladesh address parser. Given a delivery address, extract the District and Thana/Zone.

Rules:
- Return ONLY valid Bangladesh districts (all 64 districts)
- Return the district and thana in Bengali script
- Common mappings: Dhaka=ঢাকা, Chittagong/Chattogram=চট্টগ্রাম, Sylhet=সিলেট, Rajshahi=রাজশাহী, Khulna=খুলনা, Barishal=বরিশাল, Comilla/Cumilla=কুমিল্লা, Narayanganj=নারায়ণগঞ্জ, Gazipur=গাজীপুর, Mymensingh=ময়মনসিংহ, Rangpur=রংপুর, Bogra/Bogura=বগুড়া, Jessore/Jashore=যশোর, Dinajpur=দিনাজপুর, Faridpur=ফরিদপুর, Tangail=টাঙ্গাইল, Noakhali=নোয়াখালী, Brahmanbaria=ব্রাহ্মণবাড়িয়া, Narsingdi=নরসিংদী, Manikganj=মানিকগঞ্জ, Munshiganj=মুন্সীগঞ্জ, Kishoreganj=কিশোরগঞ্জ, Netrokona=নেত্রকোণা, Sherpur=শেরপুর, Jamalpur=জামালপুর, Habiganj=হবিগঞ্জ, Moulvibazar=মৌলভীবাজার, Sunamganj=সুনামগঞ্জ, Chandpur=চাঁদপুর, Lakshmipur=লক্ষ্মীপুর, Feni=ফেনী, Cox's Bazar=কক্সবাজার, Bandarban=বান্দরবান, Rangamati=রাঙ্গামাটি, Khagrachari=খাগড়াছড়ি, Pabna=পাবনা, Sirajganj=সিরাজগঞ্জ, Natore=নাটোর, Naogaon=নওগাঁ, Chapainawabganj=চাঁপাইনবাবগঞ্জ, Joypurhat=জয়পুরহাট, Satkhira=সাতক্ষীরা, Bagerhat=বাগেরহাট, Narail=নড়াইল, Jhenaidah=ঝিনাইদহ, Magura=মাগুরা, Kushtia=কুষ্টিয়া, Meherpur=মেহেরপুর, Chuadanga=চুয়াডাঙ্গা, Pirojpur=পিরোজপুর, Jhalokati=ঝালকাঠি, Barguna=বরগুনা, Patuakhali=পটুয়াখালী, Bhola=ভোলা, Gopalganj=গোপালগঞ্জ, Madaripur=মাদারীপুর, Shariatpur=শরীয়তপুর, Rajbari=রাজবাড়ী, Thakurgaon=ঠাকুরগাঁও, Panchagarh=পঞ্চগড়, Nilphamari=নীলফামারী, Lalmonirhat=লালমনিরহাট, Kurigram=কুড়িগ্রাম, Gaibandha=গাইবান্ধা
- For thana, use the specific area/upazila/thana name mentioned in the address
- If you cannot determine district or thana, return null for that field
- IMPORTANT: Do NOT guess. Only return values you are confident about from the address text.`,
          },
          {
            role: "user",
            content: `Extract district and thana from this address: "${address}"`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_address",
              description: "Extract district and thana from a Bangladesh address",
              parameters: {
                type: "object",
                properties: {
                  district: {
                    type: "string",
                    nullable: true,
                    description: "District name in Bengali (e.g. ঢাকা, চট্টগ্রাম). Null if not found.",
                  },
                  thana: {
                    type: "string",
                    nullable: true,
                    description: "Thana/Zone/Upazila name in Bengali (e.g. মিরপুর, উত্তরা). Null if not found.",
                  },
                },
                required: ["district", "thana"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_address" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "rate_limited", district: null, thana: null }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "ai_error", district: null, thana: null }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      console.error("No tool call in AI response:", JSON.stringify(aiData));
      return new Response(JSON.stringify({ district: null, thana: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    console.log("Parsed address:", address, "→", parsed);

    return new Response(JSON.stringify({
      district: parsed.district || null,
      thana: parsed.thana || null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-address error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error", district: null, thana: null }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
