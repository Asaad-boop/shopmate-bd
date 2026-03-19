import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useCompanySettings } from "@/hooks/use-company-settings";
import {
  LayoutDashboard, Package, ShoppingCart, Boxes, Globe, Users,
  Wallet, BarChart3, UserCog, Handshake, Settings, ClipboardList,
  ChevronDown, Plus, List, FileText, User, Activity, Megaphone,
  Truck, Shield, Upload, Search, ArrowRightLeft, CheckCircle,
  ScanLine, ShieldAlert, FolderOpen, ShieldCheck, BookOpen,
  DollarSign, Scale, Clock, Archive, Receipt, CreditCard,
  Building2, Users2, Briefcase, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Nav config ─── */

interface NavChild { label: string; path: string; icon?: React.ElementType }
interface NavGroup { label: string; icon: React.ElementType; group: string; children: NavChild[] }
interface NavLink { label: string; icon: React.ElementType; path: string; group?: undefined; children?: undefined }
type NavItem = NavGroup | NavLink;

const NAV_SECTIONS: { title: string; items: NavItem[]; defaultCollapsed?: boolean }[] = [
  {
    title: "SALES",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, path: "/" },
      {
        label: "Orders", icon: ShoppingCart, group: "Orders",
        children: [
          { label: "Order Dashboard", path: "/orders", icon: BarChart3 },
          { label: "Approved Orders", path: "/orders/approved", icon: CheckCircle },
          { label: "Add New Order", path: "/orders/new", icon: Plus },
          { label: "All Orders", path: "/orders/all", icon: Archive },
          { label: "Super Edit", path: "/orders/super-edit", icon: FileText },
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
      { label: "Exchanges", icon: ArrowRightLeft, path: "/exchanges" },
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
        label: "Procurement", icon: Truck, group: "Procurement",
        children: [
          { label: "Purchasing", path: "/purchasing", icon: BarChart3 },
          { label: "Purchase Orders", path: "/purchase-orders", icon: ClipboardList },
          { label: "Suppliers", path: "/suppliers", icon: Building2 },
          { label: "Imports", path: "/import-dashboard", icon: Upload },
        ],
      },
    ],
  },
  {
    title: "FINANCE",
    items: [
      {
        label: "Account & Finance", icon: Wallet, group: "Finance",
        children: [
          { label: "Overview", path: "/finance", icon: BookOpen },
          { label: "Accounts", path: "/finance/accounts", icon: CreditCard },
          { label: "Posting Queue", path: "/finance/posting-queue", icon: ClipboardList },
          { label: "Ledger", path: "/accounting", icon: FileText },
        ],
      },
      { label: "Courier COD", icon: Receipt, path: "/courier-cod" },
      { label: "Expenses", icon: DollarSign, path: "/expenses" },
    ],
  },
  {
    title: "CUSTOMERS",
    items: [
      { label: "CRM", icon: Handshake, path: "/crm" },
      {
        label: "Marketing", icon: Megaphone, group: "Marketing",
        children: [
          { label: "Dashboard", path: "/marketing", icon: BarChart3 },
          { label: "Meta Ads Report", path: "/meta-ads/report", icon: Megaphone },
          { label: "Campaign Products", path: "/meta-ads/campaign-products", icon: List },
        ],
      },
    ],
  },
  {
    title: "TEAM",
    defaultCollapsed: true,
    items: [
      { label: "HRM", icon: Users2, path: "/hrm" },
      { label: "Agents", icon: Briefcase, path: "/agents" },
    ],
  },
  {
    title: "SYSTEM",
    defaultCollapsed: true,
    items: [
      { label: "Reports", icon: BarChart3, path: "/reports" },
      { label: "Settings", icon: Settings, path: "/settings" },
      {
        label: "Security", icon: Shield, group: "Security",
        children: [
          { label: "Roles & Permissions", path: "/security/roles", icon: UserCog },
          { label: "Audit Logs", path: "/security/audit-logs", icon: FileText },
        ],
      },
      { label: "Exceptions", icon: AlertTriangle, path: "/exceptions" },
      { label: "System Health", icon: Activity, path: "/system-health" },
    ],
  },
];

/* ─── Component ─── */

export function AppSidebar() {
  const location = useLocation();
  const [expandedGroups, setExpandedGroups] = useState<string[]>(() => {
    // Auto-expand group containing current route
    const initial: string[] = [];
    NAV_SECTIONS.forEach(s => {
      s.items.forEach(item => {
        if (item.children) {
          const group = item as NavGroup;
          if (group.children.some(c => {
            const [pathPart] = c.path.split("?");
            return location.pathname === pathPart || location.pathname.startsWith(pathPart + "/");
          })) {
            initial.push(group.group);
          }
        }
      });
    });
    return initial.length ? initial : ["Orders"];
  });
  const [collapsedSections, setCollapsedSections] = useState<string[]>(() => {
    return NAV_SECTIONS.filter(s => s.defaultCollapsed).map(s => s.title);
  });
  const { settings: company } = useCompanySettings();

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) =>
      prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]
    );
  };

  const toggleSection = (title: string) => {
    setCollapsedSections(prev =>
      prev.includes(title) ? prev.filter(s => s !== title) : [...prev, title]
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

  // Auto-expand active group on route change
  useEffect(() => {
    NAV_SECTIONS.forEach(s => {
      s.items.forEach(item => {
        if (item.children) {
          const group = item as NavGroup;
          if (isGroupActive(group) && !expandedGroups.includes(group.group)) {
            setExpandedGroups(prev => [...prev, group.group]);
          }
          // Also un-collapse the section
          if (isGroupActive(group) && collapsedSections.includes(s.title)) {
            setCollapsedSections(prev => prev.filter(t => t !== s.title));
          }
        }
        if (!item.children) {
          const link = item as NavLink;
          if (isActive(link.path) && collapsedSections.includes(s.title)) {
            setCollapsedSections(prev => prev.filter(t => t !== s.title));
          }
        }
      });
    });
  }, [location.pathname]);

  return (
    <aside className="flex flex-col h-screen w-[240px] bg-card border-r border-border sticky top-0 shrink-0">
      {/* ─── Logo ─── */}
      <div className="flex items-center px-5 pt-5 pb-3">
        <Link to="/" className="flex items-center gap-2.5 min-w-0">
          {company?.logo ? (
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
      <div className="mx-4 border-b border-border" />

      {/* ─── Navigation ─── */}
      <nav className="flex-1 overflow-y-auto px-2.5 pt-3 pb-4 space-y-3">
        {NAV_SECTIONS.map((section) => {
          const isSectionCollapsed = collapsedSections.includes(section.title);
          return (
            <div key={section.title}>
              <button
                onClick={() => toggleSection(section.title)}
                className="w-full px-2.5 mb-1.5 flex items-center justify-between group"
              >
                <p className="text-[10px] font-semibold tracking-wider text-muted-foreground/60 uppercase select-none">
                  {section.title}
                </p>
                <ChevronDown className={cn(
                  "w-3 h-3 text-muted-foreground/40 transition-transform duration-200",
                  isSectionCollapsed && "-rotate-90"
                )} />
              </button>
              {!isSectionCollapsed && (
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
                              "w-full flex items-center gap-2.5 px-2.5 h-[38px] rounded-lg text-[13px] font-medium transition-all duration-150",
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
                          {expanded && (
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
                                        ? "bg-primary/10 text-primary font-medium"
                                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                    )}
                                  >
                                    {active && (
                                      <span className="absolute -left-[11px] top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-full bg-primary" />
                                    )}
                                    {child.icon && (
                                      <child.icon
                                        className={cn("w-3.5 h-3.5 shrink-0", active && "text-primary")}
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
                          "relative flex items-center gap-2.5 px-2.5 h-[38px] rounded-lg text-[13px] font-medium transition-all duration-150",
                          active
                            ? "bg-primary/10 text-primary font-semibold"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        )}
                      >
                        {active && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-full bg-primary" />
                        )}
                        <link.icon
                          className={cn("w-4 h-4 shrink-0", active && "text-primary")}
                          strokeWidth={1.8}
                        />
                        <span>{link.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Version */}
      <div className="px-5 py-3 border-t border-border">
        <p className="text-[10px] text-muted-foreground/50">ShopMate BD v1.0</p>
      </div>
    </aside>
  );
}
