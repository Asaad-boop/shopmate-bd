import { Outlet, useLocation, Link } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { NotificationDropdown } from "./NotificationDropdown";
import { GlobalSearchTrigger } from "./GlobalSearchTrigger";
import { UserMenu } from "./UserMenu";
import { CommandBar } from "./CommandBar";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { ChevronRight, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard", "/search": "Search",
  "/orders": "Order Dashboard", "/orders/approved": "Approved Orders", "/orders/new": "New Order",
  "/orders/all": "All Orders", "/orders/old": "Old Orders", "/orders/super-edit": "Super Edit",
  "/orders/pre-orders": "Pre Orders", "/orders/scan": "Scan to Update",
  "/exchanges": "Exchanges",
  "/web-orders": "Web Orders", "/web-orders/fake-reports": "Fake Order Reports",
  "/products": "Products", "/products/new": "New Product",
  "/inventory": "Inventory", "/inventory/categories": "Category & Brand", "/inventory/warranty": "Warranty",
  "/meta-ads/report": "Meta Ads Report", "/meta-ads/campaign-products": "Campaign Products",
  "/finance": "Finance", "/finance/posting-queue": "Posting Queue", "/finance/accounts": "Finance Accounts",
  "/finance/settlements": "Settlements", "/finance/payables": "Payables", "/finance/ledger": "Ledger",
  "/accounting": "Accounting", "/courier-cod": "Courier COD", "/expenses": "Expenses",
  "/purchasing": "Purchasing", "/purchase-orders": "Purchase Orders", "/suppliers": "Suppliers",
  "/agents": "Agents", "/import-dashboard": "Import Dashboard", "/imports": "Import Management",
  "/crm": "CRM", "/hrm": "HRM", "/reports": "Reports", "/settings": "Settings",
  "/security/roles": "Roles & Permissions", "/security/audit-logs": "Audit Logs",
  "/exceptions": "Exceptions", "/system-health": "System Health",
  "/marketing": "Marketing", "/marketing/influencers": "Influencers",
  "/marketing/ugc-creators": "UGC Creators", "/marketing/external": "External Spend",
  "/marketing/decisions": "Campaign Decisions",
  "/go-live": "Go Live", "/optimization": "Optimization",
  "/procurement": "Procurement",
};

const BREADCRUMBS: Record<string, { parent: string; parentPath: string }> = {
  "/orders/approved": { parent: "Orders", parentPath: "/orders" },
  "/orders/new": { parent: "Orders", parentPath: "/orders" },
  "/orders/all": { parent: "Orders", parentPath: "/orders" },
  "/orders/old": { parent: "Orders", parentPath: "/orders" },
  "/orders/super-edit": { parent: "Orders", parentPath: "/orders" },
  "/orders/pre-orders": { parent: "Orders", parentPath: "/orders" },
  "/orders/scan": { parent: "Orders", parentPath: "/orders" },
  "/web-orders/fake-reports": { parent: "Web Orders", parentPath: "/web-orders" },
  "/products/new": { parent: "Products", parentPath: "/products" },
  "/inventory/categories": { parent: "Inventory", parentPath: "/inventory" },
  "/inventory/warranty": { parent: "Inventory", parentPath: "/inventory" },
  "/finance/posting-queue": { parent: "Finance", parentPath: "/finance" },
  "/finance/accounts": { parent: "Finance", parentPath: "/finance" },
  "/finance/settlements": { parent: "Finance", parentPath: "/finance" },
  "/finance/payables": { parent: "Finance", parentPath: "/finance" },
  "/finance/ledger": { parent: "Finance", parentPath: "/finance" },
  "/meta-ads/report": { parent: "Marketing", parentPath: "/marketing" },
  "/meta-ads/campaign-products": { parent: "Marketing", parentPath: "/marketing" },
  "/reports/executive": { parent: "Reports", parentPath: "/reports" },
  "/reports/pnl": { parent: "Reports", parentPath: "/reports" },
  "/reports/cashflow": { parent: "Reports", parentPath: "/reports" },
  "/reports/sku-profit": { parent: "Reports", parentPath: "/reports" },
  "/reports/inventory-valuation": { parent: "Reports", parentPath: "/reports" },
  "/reports/courier-performance": { parent: "Reports", parentPath: "/reports" },
  "/reports/balance": { parent: "Reports", parentPath: "/reports" },
  "/reports/expense-analytics": { parent: "Reports", parentPath: "/reports" },
  "/security/roles": { parent: "System", parentPath: "/settings" },
  "/security/audit-logs": { parent: "System", parentPath: "/settings" },
  "/marketing/influencers": { parent: "Marketing", parentPath: "/marketing" },
  "/marketing/ugc-creators": { parent: "Marketing", parentPath: "/marketing" },
  "/marketing/external": { parent: "Marketing", parentPath: "/marketing" },
  "/marketing/decisions": { parent: "Marketing", parentPath: "/marketing" },
};

const SHORTCUT_SECTIONS = [
  {
    title: "Navigation",
    items: [
      { key: "D", desc: "Go to Dashboard" },
      { key: "O", desc: "Go to Orders" },
      { key: "P", desc: "Go to Products" },
      { key: "F", desc: "Go to Finance" },
      { key: "C", desc: "Go to Customers" },
    ],
  },
  {
    title: "Actions",
    items: [
      { key: "N", desc: "New Order" },
      { key: "/", desc: "Search" },
      { key: "?", desc: "Show this help" },
    ],
  },
  {
    title: "General",
    items: [
      { key: "Esc", desc: "Close modal / drawer" },
    ],
  },
];

export function AppLayout() {
  const location = useLocation();
  const { showHelp, setShowHelp } = useKeyboardShortcuts();

  const pageTitle = PAGE_TITLES[location.pathname] || "Dashboard";
  const breadcrumb = BREADCRUMBS[location.pathname];

  const isDynamic = location.pathname.match(/^\/orders\/[a-f0-9-]+$/);
  const isWebDynamic = location.pathname.match(/^\/web-orders\/[a-f0-9-]+$/);
  const isPODynamic = location.pathname.match(/^\/purchase-orders\/[a-f0-9-]+$/);

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* ─── Glass Topbar ─── */}
        <header
          className="sticky top-0 z-30 flex items-center justify-between h-14 px-6 border-b border-border no-print"
          style={{
            background: "rgba(255,255,255,0.70)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          <div className="flex items-center gap-1.5 min-w-0 text-sm">
            {(breadcrumb || isDynamic || isWebDynamic || isPODynamic) && (
              <>
                <Link
                  to={breadcrumb?.parentPath || (isDynamic ? "/orders" : isWebDynamic ? "/web-orders" : "/purchase-orders")}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {breadcrumb?.parent || (isDynamic ? "Orders" : isWebDynamic ? "Web Orders" : "Purchase Orders")}
                </Link>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
              </>
            )}
            <h2 className="font-semibold text-foreground truncate">
              {isDynamic ? "Order Detail" : isWebDynamic ? "Web Order Detail" : isPODynamic ? "PO Detail" : pageTitle}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-[260px] hidden md:block">
              <GlobalSearchTrigger />
            </div>
            <NotificationDropdown />
            <UserMenu />
          </div>
        </header>

        {/* ─── Main content ─── */}
        <main
          className="flex-1 p-6 overflow-auto"
          style={{
            background:
              "linear-gradient(135deg, rgba(20,184,166,0.04) 0%, rgba(15,118,110,0.01) 50%, transparent 100%)",
          }}
        >
          <div className="max-w-[1400px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Keyboard Shortcuts Help Modal */}
      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Keyboard Shortcuts</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 mt-2">
            {SHORTCUT_SECTIONS.map((section) => (
              <div key={section.title}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {section.title}
                </p>
                <div className="space-y-1.5">
                  {section.items.map((item) => (
                    <div key={item.key} className="flex items-center justify-between">
                      <span className="text-sm text-foreground">{item.desc}</span>
                      <kbd className="px-2 py-0.5 rounded bg-muted border border-border text-xs font-mono text-muted-foreground">
                        {item.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
