import { Outlet, useNavigate } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { Search, Bell, Plus } from "lucide-react";
import { NotificationDropdown } from "./NotificationDropdown";
import { Button } from "@/components/ui/button";

export function AppLayout() {
  const navigate = useNavigate();
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between h-[52px] px-6 bg-background border-b border-border">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-semibold text-foreground">Dashboard</h1>
            <span className="text-xs text-muted-foreground">{today}</span>
          </div>
          <div className="flex items-center gap-2">
            <NotificationDropdown />
            <button className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
              <Search className="w-4 h-4" />
            </button>
            <Button
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => navigate("/orders/new")}
            >
              <Plus className="w-3.5 h-3.5" />
              New Order
            </Button>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 p-5 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
