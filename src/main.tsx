import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { startSupabaseKeepalive } from "@/lib/supabase-keepalive";

// Keep Supabase free-tier awake (ping every 4 min)
startSupabaseKeepalive();

createRoot(document.getElementById("root")!).render(<App />);
