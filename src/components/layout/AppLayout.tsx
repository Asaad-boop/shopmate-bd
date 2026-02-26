import { Outlet, useLocation } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { NotificationDropdown } from "./NotificationDropdown";
import { GlobalSearchTrigger } from "./GlobalSearchTrigger";

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/search": "Search",
  "/orders": "Order List",
  "/orders/approved": "Approved Orders",
  "/orders/new": "New Order",
  "/orders/all": "All Orders",
  "/orders/old": "Old Orders",
  "/orders/super-edit": "Super Edit",
  "/orders/pre-orders": "Pre Orders",
  "/orders/scan": "Scan to Update",
  "/exchanges": "Exchanges",
  "/web-orders": "Web Orders",
  "/web-orders/fake-reports": "Fake Order Reports",
  "/products": "Products",
  "/products/new": "New Product",
  "/inventory": "Inventory",
  "/inventory/categories": "Category & Brand",
  "/inventory/warranty": "Warranty",
  "/meta-ads/report": "Meta Ads Report",
  "/meta-ads/campaign-products": "Campaign Products",
  "/finance": "Accounts",
  "/finance/posting-queue": "Posting Queue",
  "/finance/accounts": "Finance Accounts",
  "/finance/settlements": "Settlements",
  "/finance/payables": "Payables",
  "/finance/ledger": "Ledger",
  "/accounting": "Accounting",
  "/courier-cod": "Courier COD",
  "/expenses": "Expenses",
  "/purchasing": "Purchasing",
  "/purchase-orders": "Purchase Orders",
  "/suppliers": "Suppliers",
  "/agents": "Agents",
  "/import-dashboard": "Import Dashboard",
  "/imports": "Import Management",
  "/crm": "CRM",
  "/hrm": "HRM",
  "/reports": "Reports",
  "/settings": "Settings",
  "/security/roles": "Roles & Permissions",
  "/security/audit-logs": "Audit Logs",
  "/exceptions": "Exceptions",
  "/system-health": "System Health",
  "/marketing": "Marketing",
};

export function AppLayout() {
  const location = useLocation();
  const pageTitle = PAGE_TITLES[location.pathname] || "Dashboard";

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* ─── Glass Topbar ─── */}
        <header
          className="sticky top-0 z-30 flex items-center justify-between h-16 px-8 border-b border-border"
          style={{
            background: "rgba(255,255,255,0.70)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          {/* Left: Page title */}
          <div className="flex items-center gap-4 min-w-0">
            <h2 className="text-lg font-semibold text-foreground truncate">{pageTitle}</h2>
          </div>

          {/* Right: Search + actions */}
          <div className="flex items-center gap-3">
            <div className="w-[280px] hidden md:block">
              <GlobalSearchTrigger />
            </div>
            <NotificationDropdown />
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-semibold">
              A
            </div>
          </div>
        </header>

        {/* ─── Main content ─── */}
        <main
          className="flex-1 p-8 overflow-auto"
          style={{
            background:
              "linear-gradient(135deg, rgba(20,184,166,0.06) 0%, rgba(15,118,110,0.02) 50%, transparent 100%)",
          }}
        >
          <div className="max-w-[1400px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
