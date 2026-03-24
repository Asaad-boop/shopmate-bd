import { supabase } from "@/integrations/supabase/client";

let pingInterval: ReturnType<typeof setInterval> | null = null;

export function startSupabaseKeepalive() {
  if (pingInterval) return; // already running
  
  // Ping immediately on start
  pingSupabase();
  
  // Then ping every 4 minutes
  pingInterval = setInterval(pingSupabase, 4 * 60 * 1000);
}

async function pingSupabase() {
  try {
    await supabase.from('settings').select('key').limit(1).maybeSingle();
  } catch {
    // Silent fail — just a keepalive ping
  }
}

export function stopSupabaseKeepalive() {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
}
