import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useCompanySettings } from "@/hooks/use-company-settings";
import {
  LayoutDashboard, Package, ShoppingCart, Boxes, Globe, Users,
  Wallet, BarChart3, UserCog, Handshake, Settings, ClipboardList,
  ChevronDown, Plus, List, FileText, User, Activity, Megaphone,
  Truck, Shield, Upload, Search, ArrowRightLeft, CheckCircle,
  ScanLine, ShieldAlert, FolderOpen, ShieldCheck, BookOpen,
  DollarSign, Scale, Clock, Archive,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Nav config ─── */

interface NavChild { label: string; path: string; icon?: React.ElementType }
interface NavGroup { label: string; icon: React.ElementType; group: string; children: NavChild[] }
interface NavLink { label: string; icon: React.ElementType; path: string; group?: undefined; children?: undefined }
type NavItem = NavGroup | NavLink;

const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "MAIN",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, path: "/" },
      { label: "Search", icon: Search, path: "/search" },
    ],
  },
  {
    title: "COMMERCE",
    items: [
      {
        label: "Orders", icon: ShoppingCart, group: "Orders",
        children: [
          { label: "Approved Orders", path: "/orders/approved", icon: CheckCircle },
          { label: "Add New Order", path: "/orders/new", icon: Plus },
          { label: "Order List", path: "/orders", icon: List },
          { label: "All Orders", path: "/orders/all", icon: Archive },
          { label: "Old Orders", path: "/orders/old", icon: Archive },
          { label: "Super Edit", path: "/orders/super-edit", icon: FileText },
          { label: "Pre Order List", path: "/orders/pre-orders", icon: Package },
          { label: "Scan to Update", path: "/orders/scan", icon: ScanLine },
          { label: "Exchanges", path: "/exchanges", icon: ArrowRightLeft },
        ],
      },
      {
        label: "Web Orders", icon: Globe, group: "WebOrders",
        children: [
          { label: "Web Order List", path: "/web-orders", icon: List },
          { label: "Fake Order Reports", path: "/web-orders/fake-reports", icon: ShieldAlert },
        ],
      },
      {
        label: "Inventory", icon: Boxes, group: "Inventory",
        children: [
          { label: "Inventory Dashboard", path: "/inventory", icon: BarChart3 },
          { label: "Product List", path: "/products", icon: List },
          { label: "Add New Product", path: "/products/new", icon: Plus },
          { label: "Category & Brand", path: "/inventory/categories", icon: FolderOpen },
          { label: "Warranty", path: "/inventory/warranty", icon: ShieldCheck },
        ],
      },
    ],
  },
  {
    title: "MARKETING",
    items: [
      {
        label: "Meta Ads", icon: Megaphone, group: "MetaAds",
        children: [
          { label: "Meta Ads Report", path: "/meta-ads/report", icon: BarChart3 },
          { label: "Campaign Products", path: "/meta-ads/campaign-products", icon: List },
        ],
      },
      { label: "Marketing", icon: Megaphone, path: "/marketing" },
    ],
  },
  {
    title: "FINANCE",
    items: [
      {
        label: "Account & Finance", icon: Wallet, group: "Finance",
        children: [
          { label: "Accounts", path: "/finance", icon: BookOpen },
          { label: "Posting Queue", path: "/finance/posting-queue", icon: ClipboardList },
          { label: "Settlements", path: "/courier-cod?tab=settlements", icon: DollarSign },
          { label: "Payables", path: "/purchasing?tab=payables", icon: Clock },
          { label: "Ledger", path: "/accounting?tab=general_ledger", icon: FileText },
        ],
      },
    ],
  },
  {
    title: "OPERATIONS",
    items: [
      { label: "HRM", icon: UserCog, path: "/hrm" },
      { label: "CRM", icon: Handshake, path: "/crm" },
      {
        label: "Imports & Purchase", icon: Upload, group: "Imports",
        children: [
          { label: "Purchase Dashboard", path: "/purchasing", icon: BarChart3 },
          { label: "Import", path: "/import-dashboard", icon: Upload },
        ],
      },
    ],
  },
  {
    title: "INSIGHTS",
    items: [
      { label: "Reports", icon: BarChart3, path: "/reports" },
    ],
  },
  {
    title: "SYSTEM",
    items: [
      { label: "Settings", icon: Settings, path: "/settings" },
      {
        label: "Access", icon: Shield, group: "Access",
        children: [
          { label: "Roles & Permissions", path: "/security/roles", icon: UserCog },
          { label: "Audit Logs", path: "/security/audit-logs", icon: FileText },
        ],
      },
      { label: "System Health", icon: Activity, path: "/system-health" },
    ],
  },
];

/* ─── Component ─── */

export function AppSidebar() {
  const location = useLocation();
  const [expandedGroups, setExpandedGroups] = useState<string[]>(["Orders"]);
  const { settings: company } = useCompanySettings();

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) =>
      prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]
    );
  };

  const isActive = (path: string) => {
    const [pathPart, queryPart] = path.split("?");
    if (queryPart) return location.pathname === pathPart && location.search === "?" + queryPart;
    return location.pathname === path;
  };

  const isGroupActive = (item: NavGroup) =>
    item.children.some((c) => {
      const [pathPart] = c.path.split("?");
      return location.pathname === pathPart || location.pathname.startsWith(pathPart + "/");
    });

  return (
    <aside className="flex flex-col h-screen w-[260px] bg-card border-r border-border sticky top-0 shrink-0">
      {/* ─── Logo ─── */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4">
        <Link to="/" className="flex items-center gap-2.5 min-w-0">
          {company?.logo ? (
            <img
              src={company.logo}
              alt="Logo"
              className="h-8 max-w-[130px] object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shrink-0">
              <Package className="w-5 h-5 text-primary-foreground" />
            </div>
          )}
        </Link>
      </div>

      {/* ─── Divider ─── */}
      <div className="mx-5 border-b border-border" />

      {/* ─── Navigation ─── */}
      <nav className="flex-1 overflow-y-auto px-3 pt-4 pb-4 space-y-5">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="px-3 mb-2 text-[11px] font-semibold tracking-wider text-muted-foreground/70 uppercase select-none">
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                // Group with children
                if (item.children) {
                  const group = item as NavGroup;
                  const groupActive = isGroupActive(group);
                  const expanded = expandedGroups.includes(group.group);
                  return (
                    <div key={group.group}>
                      <button
                        onClick={() => toggleGroup(group.group)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 h-[44px] rounded-xl text-sm font-medium transition-all duration-200",
                          groupActive
                            ? "text-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                      >
                        <group.icon className="w-[18px] h-[18px] shrink-0" strokeWidth={1.8} />
                        <span className="flex-1 text-left">{group.label}</span>
                        <ChevronDown
                          className={cn(
                            "w-4 h-4 transition-transform duration-200",
                            expanded && "rotate-180"
                          )}
                        />
                      </button>
                      {expanded && (
                        <div className="mt-0.5 ml-5 pl-3 border-l border-border space-y-0.5">
                          {group.children.map((child) => {
                            const active = isActive(child.path);
                            return (
                              <Link
                                key={child.path}
                                to={child.path}
                                className={cn(
                                  "relative flex items-center gap-2.5 px-3 h-[40px] rounded-xl text-sm transition-all duration-200",
                                  active
                                    ? "bg-primary/10 text-primary font-medium"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                )}
                              >
                                {/* Active accent bar */}
                                {active && (
                                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-primary" />
                                )}
                                {child.icon && (
                                  <child.icon
                                    className={cn("w-4 h-4 shrink-0", active && "text-primary")}
                                    strokeWidth={1.8}
                                  />
                                )}
                                <span>{child.label}</span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                // Single link
                const link = item as NavLink;
                const active = isActive(link.path);
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={cn(
                      "relative flex items-center gap-3 px-3 h-[44px] rounded-xl text-sm font-medium transition-all duration-200",
                      active
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-primary" />
                    )}
                    <link.icon
                      className={cn("w-[18px] h-[18px] shrink-0", active && "text-primary")}
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
    </aside>
  );
}
