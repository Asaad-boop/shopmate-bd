import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { NotificationDropdown } from "./NotificationDropdown";
import { GlobalSearchTrigger } from "./GlobalSearchTrigger";

export function AppLayout() {
  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar – Glass header */}
         <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-6 border-b border-border" style={{ background: 'rgba(255,255,255,0.70)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
          <div className="flex items-center gap-4 flex-1 max-w-md">
            <GlobalSearchTrigger />
          </div>
          <div className="flex items-center gap-3">
            <NotificationDropdown />
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-semibold">
              A
            </div>
          </div>
        </header>

        {/* Main content – subtle teal gradient bg */}
        <main className="flex-1 p-6 overflow-auto" style={{ background: 'linear-gradient(135deg, rgba(20,184,166,0.06) 0%, rgba(15,118,110,0.02) 50%, transparent 100%)' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
