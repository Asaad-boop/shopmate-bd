import { useState, useEffect, createContext, useContext, memo, useMemo, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { useCompanySettings } from "@/hooks/use-company-settings";
import {
  LayoutDashboard, Package, ShoppingCart, Boxes, Globe, Users,
  Wallet, BarChart2, Settings, ClipboardList,
  ChevronDown, Plus, List, FileText, Activity, Megaphone,
  Truck, Shield, Ship,
  ArrowLeftRight, CheckCircle,
  ScanLine, ShieldAlert, FolderOpen, BookOpen,
  DollarSign, Receipt,
  Users2, AlertTriangle,
  PanelLeftClose, PanelLeft, Archive, UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/* ─── Sidebar context ─── */
const SidebarContext = createContext<{ collapsed: boolean; toggle: () => void }>({
  collapsed: false,
  toggle: () => {},
});

export function useSidebarState() {
  return useContext(SidebarContext);
}

/* ─── Nav config ─── */
interface NavChild { label: string; path: string; icon: React.ElementType }
interface NavGroup { label: string; icon: React.ElementType; group: string; children: NavChild[] }
interface NavLink { label: string; icon: React.ElementType; path: string; group?: undefined; children?: undefined }
type NavItem = NavGroup | NavLink;

const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "SALES",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, path: "/" },
      {
        label: "Orders", icon: ShoppingCart, group: "Orders",
        children: [
          { label: "All Orders", path: "/orders/all", icon: Archive },
          { label: "Add New Order", path: "/orders/new", icon: Plus },
          { label: "Approved Orders", path: "/orders/approved", icon: CheckCircle },
          { label: "Pre Orders", path: "/orders/pre-orders", icon: Package },
          { label: "Scan to Update", path: "/orders/scan", icon: ScanLine },
        ],
      },
      {
        label: "Web Orders", icon: Globe, group: "WebOrders",
        children: [
          { label: "Web Order List", path: "/web-orders", icon: List },
          { label: "Fake Order Reports", path: "/web-orders/fake-reports", icon: ShieldAlert },
        ],
      },
      { label: "Exchanges", icon: ArrowLeftRight, path: "/exchanges" },
    ],
  },
  {
    title: "INVENTORY",
    items: [
      {
        label: "Products", icon: Package, group: "Products",
        children: [
          { label: "Product List", path: "/products", icon: List },
          { label: "Add Product", path: "/products/new", icon: Plus },
          { label: "Category & Brand", path: "/inventory/categories", icon: FolderOpen },
        ],
      },
      { label: "Inventory", icon: Boxes, path: "/inventory" },
      {
        label: "Procurement", icon: ClipboardList, group: "Procurement",
        children: [
          { label: "Purchasing", path: "/purchasing", icon: BarChart2 },
          { label: "Purchase Orders", path: "/purchase-orders", icon: ClipboardList },
          { label: "Suppliers", path: "/suppliers", icon: Users },
        ],
      },
      { label: "Imports", icon: Ship, path: "/import-dashboard" },
    ],
  },
  {
    title: "FINANCE",
    items: [
      {
        label: "Finance", icon: Wallet, group: "Finance",
        children: [
          { label: "Overview", path: "/finance", icon: BookOpen },
          { label: "Accounts", path: "/finance/accounts", icon: DollarSign },
          { label: "Posting Queue", path: "/finance/posting-queue", icon: ClipboardList },
        ],
      },
      { label: "Accounting", icon: BookOpen, path: "/accounting" },
      { label: "Courier COD", icon: Truck, path: "/courier-cod" },
      { label: "Expenses", icon: Receipt, path: "/expenses" },
    ],
  },
  {
    title: "CUSTOMERS",
    items: [
      { label: "CRM", icon: Users, path: "/crm" },
      {
        label: "Marketing", icon: Megaphone, group: "Marketing",
        children: [
          { label: "Overview", path: "/marketing", icon: BarChart2 },
          { label: "Influencers", path: "/marketing/influencers", icon: Users },
          { label: "UGC Creators", path: "/marketing/ugc-creators", icon: Activity },
          { label: "External Spend", path: "/marketing/external", icon: Globe },
          { label: "Meta Ads Report", path: "/meta-ads/report", icon: Megaphone },
          { label: "Campaign Products", path: "/meta-ads/campaign-products", icon: List },
        ],
      },
    ],
  },
  {
    title: "TEAM",
    items: [
      { label: "HRM", icon: UserCheck, path: "/hrm" },
    ],
  },
  {
    title: "SYSTEM",
    items: [
      { label: "Reports", icon: BarChart2, path: "/reports" },
      {
        label: "Security", icon: Shield, group: "Security",
        children: [
          { label: "Roles & Permissions", path: "/security/roles", icon: Shield },
          { label: "Audit Logs", path: "/security/audit-logs", icon: FileText },
        ],
      },
      { label: "Exceptions", icon: AlertTriangle, path: "/exceptions" },
      { label: "System Health", icon: Activity, path: "/system-health" },
      { label: "Settings", icon: Settings, path: "/settings" },
    ],
  },
];

/* ─── Component ─── */

export function AppSidebar() {
  const location = useLocation();
  const { settings: company } = useCompanySettings();

  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("shopmate_sidebar_collapsed") === "true"; } catch { return false; }
  });

  const toggle = () => {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem("shopmate_sidebar_collapsed", String(next)); } catch {}
      return next;
    });
  };

  const [expandedGroups, setExpandedGroups] = useState<string[]>(() => {
    const initial: string[] = [];
    NAV_SECTIONS.forEach(s => {
      s.items.forEach(item => {
        if (item.children) {
          const group = item as NavGroup;
          if (group.children.some(c => location.pathname === c.path || location.pathname.startsWith(c.path + "/"))) {
            initial.push(group.group);
          }
        }
      });
    });
    return initial.length ? initial : ["Orders"];
  });

  const toggleGroup = (group: string) => {
    if (collapsed) return; // Don't toggle in collapsed mode
    setExpandedGroups(prev =>
      prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]
    );
  };

  const isActive = (path: string) => location.pathname === path;

  const isGroupActive = (item: NavGroup) =>
    item.children.some(c => location.pathname === c.path || location.pathname.startsWith(c.path + "/"));

  // Auto-expand active group on route change
  useEffect(() => {
    NAV_SECTIONS.forEach(s => {
      s.items.forEach(item => {
        if (item.children) {
          const group = item as NavGroup;
          if (isGroupActive(group) && !expandedGroups.includes(group.group)) {
            setExpandedGroups(prev => [...prev, group.group]);
          }
        }
      });
    });
  }, [location.pathname]);

  // Also handle /orders route → highlight Orders group
  const isOrdersDashboard = location.pathname === "/orders";

  return (
    <SidebarContext.Provider value={{ collapsed, toggle }}>
      <TooltipProvider delayDuration={0}>
        <aside
          className={cn(
            "flex flex-col h-screen bg-card border-r border-border sticky top-0 shrink-0 transition-all duration-200 ease-in-out",
            collapsed ? "w-16" : "w-[240px]"
          )}
        >
          {/* ─── Logo ─── */}
          <div className={cn("flex items-center pt-5 pb-3", collapsed ? "px-3 justify-center" : "px-5")}>
            <Link to="/" className="flex items-center gap-2.5 min-w-0">
              {collapsed ? (
                <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shrink-0">
                  <Package className="w-4 h-4 text-primary-foreground" />
                </div>
              ) : company?.logo ? (
                <img
                  src={company.logo}
                  alt="Logo"
                  className="h-8 max-w-[130px] object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <>
                  <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shrink-0">
                    <Package className="w-4 h-4 text-primary-foreground" />
                  </div>
                  <span className="font-bold text-sm text-foreground">ShopMate BD</span>
                </>
              )}
            </Link>
          </div>

          {/* ─── Divider ─── */}
          <div className="mx-3 border-b border-border" />

          {/* ─── Navigation ─── */}
          <nav className="flex-1 overflow-y-auto px-2 pt-3 pb-4 space-y-4">
            {NAV_SECTIONS.map((section) => (
              <div key={section.title}>
                {/* Section title */}
                {!collapsed && (
                  <p className="px-2.5 mb-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground/60 uppercase select-none">
                    {section.title}
                  </p>
                )}
                {collapsed && <div className="mx-auto w-6 border-b border-border/40 mb-1.5" />}

                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    // Group with children
                    if (item.children) {
                      const group = item as NavGroup;
                      const groupActive = isGroupActive(group) || (group.group === "Orders" && isOrdersDashboard);
                      const expanded = expandedGroups.includes(group.group) && !collapsed;

                      if (collapsed) {
                        // In collapsed mode show icon with tooltip, link to first child
                        return (
                          <Tooltip key={group.group}>
                            <TooltipTrigger asChild>
                              <Link
                                to={group.children[0].path}
                                className={cn(
                                  "flex items-center justify-center h-9 w-full rounded-lg transition-all duration-150",
                                  groupActive
                                    ? "bg-primary text-primary-foreground"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                )}
                              >
                                <group.icon className="w-4 h-4" strokeWidth={1.8} />
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="font-medium">
                              {group.label}
                            </TooltipContent>
                          </Tooltip>
                        );
                      }

                      return (
                        <div key={group.group}>
                          <button
                            onClick={() => toggleGroup(group.group)}
                            className={cn(
                              "w-full flex items-center gap-2.5 px-2.5 h-9 rounded-lg text-[13px] font-medium transition-all duration-150",
                              groupActive
                                ? "text-foreground"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                            )}
                          >
                            <group.icon className="w-4 h-4 shrink-0" strokeWidth={1.8} />
                            <span className="flex-1 text-left">{group.label}</span>
                            <ChevronDown
                              className={cn(
                                "w-3.5 h-3.5 transition-transform duration-200",
                                expanded && "rotate-180"
                              )}
                            />
                          </button>
                          <div
                            className={cn(
                              "overflow-hidden transition-all duration-200",
                              expanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
                            )}
                          >
                            <div className="mt-0.5 ml-4 pl-2.5 border-l border-border/60 space-y-0.5">
                              {group.children.map((child) => {
                                const active = isActive(child.path);
                                return (
                                  <Link
                                    key={child.path}
                                    to={child.path}
                                    className={cn(
                                      "relative flex items-center gap-2 px-2.5 h-[34px] rounded-lg text-[13px] transition-all duration-150",
                                      active
                                        ? "bg-primary text-primary-foreground font-medium"
                                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                    )}
                                  >
                                    {active && (
                                      <span className="absolute -left-[11px] top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-full bg-primary" />
                                    )}
                                    <child.icon
                                      className={cn("w-3.5 h-3.5 shrink-0", active && "text-primary-foreground")}
                                      strokeWidth={1.8}
                                    />
                                    <span>{child.label}</span>
                                  </Link>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // Single link
                    const link = item as NavLink;
                    const active = isActive(link.path);

                    if (collapsed) {
                      return (
                        <Tooltip key={link.path}>
                          <TooltipTrigger asChild>
                            <Link
                              to={link.path}
                              className={cn(
                                "flex items-center justify-center h-9 w-full rounded-lg transition-all duration-150",
                                active
                                  ? "bg-primary text-primary-foreground"
                                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                              )}
                            >
                              <link.icon className="w-4 h-4" strokeWidth={1.8} />
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="font-medium">
                            {link.label}
                          </TooltipContent>
                        </Tooltip>
                      );
                    }

                    return (
                      <Link
                        key={link.path}
                        to={link.path}
                        className={cn(
                          "relative flex items-center gap-2.5 px-2.5 h-9 rounded-lg text-[13px] font-medium transition-all duration-150",
                          active
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        )}
                      >
                        <link.icon
                          className={cn("w-4 h-4 shrink-0", active && "text-primary-foreground")}
                          strokeWidth={1.8}
                        />
                        <span>{link.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* ─── Collapse toggle + version ─── */}
          <div className="border-t border-border px-2 py-2">
            <button
              onClick={toggle}
              className="w-full flex items-center justify-center gap-2 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-150 text-[13px]"
            >
              {collapsed ? (
                <PanelLeft className="w-4 h-4" />
              ) : (
                <>
                  <PanelLeftClose className="w-4 h-4" />
                  <span>Collapse</span>
                </>
              )}
            </button>
            {!collapsed && (
              <p className="text-[10px] text-muted-foreground/50 text-center mt-1">ShopMate BD v1.0</p>
            )}
          </div>
        </aside>
      </TooltipProvider>
    </SidebarContext.Provider>
  );
}
