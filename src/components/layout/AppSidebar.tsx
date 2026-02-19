import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useCompanySettings } from "@/hooks/use-company-settings";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Boxes,
  Ship,
  Globe,
  Users,
  Wallet,
  BarChart3,
  UserCog,
  Handshake,
  Settings,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  List,
  FileText,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  icon: React.ElementType;
  path?: string;
  children?: { label: string; path: string; icon?: React.ElementType }[];
}

const navItems: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/" },
  {
    label: "Orders",
    icon: ShoppingCart,
    children: [
      { label: "All Orders", path: "/orders", icon: List },
      { label: "Add New Order", path: "/orders/new", icon: Plus },
    ],
  },
  { label: "Web Orders", icon: Globe, path: "/web-orders" },
  {
    label: "Products",
    icon: Package,
    children: [
      { label: "Product List", path: "/products", icon: List },
      { label: "Add Product", path: "/products/new", icon: Plus },
    ],
  },
  { label: "Inventory", icon: Boxes, path: "/inventory" },
  {
    label: "China Import",
    icon: Ship,
    children: [
      { label: "Purchase Orders", path: "/imports", icon: List },
      { label: "Suppliers", path: "/suppliers", icon: Users },
    ],
  },
  { label: "Customers", icon: Users, path: "/customers" },
  {
    label: "Accounting",
    icon: Wallet,
    children: [
      { label: "Transactions", path: "/accounting", icon: List },
      { label: "P&L Report", path: "/accounting/pnl", icon: FileText },
    ],
  },
  { label: "Reports", icon: BarChart3, path: "/reports" },
  { label: "HRM", icon: UserCog, path: "/hrm" },
  { label: "CRM", icon: Handshake, path: "/crm" },
  { label: "Settings", icon: Settings, path: "/settings" },
];

export function AppSidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>(["Orders", "Products"]);
  const { settings: company } = useCompanySettings();

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) =>
      prev.includes(label) ? prev.filter((g) => g !== label) : [...prev, label]
    );
  };

  const isActive = (path: string) => location.pathname === path;
  const isGroupActive = (item: NavItem) =>
    item.children?.some((c) => location.pathname === c.path || location.pathname.startsWith(c.path + '/'));

  return (
    <aside
      className={cn(
        "flex flex-col h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300 sticky top-0",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-4 h-16 border-b border-sidebar-border">
        {!collapsed && (
          <Link to="/" className="flex items-center gap-2 min-w-0">
            {company?.logo ? (
              <img
                src={company.logo}
                alt="Logo"
                className="h-8 max-w-[140px] object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <>
                <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center flex-shrink-0">
                  <Package className="w-5 h-5 text-sidebar-primary-foreground" />
                </div>
                <span className="font-bold text-lg text-white truncate">
                  {company?.name || "EcomHub"}
                </span>
              </>
            )}
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-muted hover:text-sidebar-accent-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
        {navItems.map((item) => {
          if (item.children) {
            const groupActive = isGroupActive(item);
            const expanded = expandedGroups.includes(item.label);
            return (
              <div key={item.label}>
                <button
                  onClick={() => toggleGroup(item.label)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    groupActive
                      ? "text-sidebar-accent-foreground bg-sidebar-accent"
                      : "text-sidebar-muted hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"
                  )}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left">{item.label}</span>
                      <ChevronDown
                        className={cn("w-4 h-4 transition-transform", expanded && "rotate-180")}
                      />
                    </>
                  )}
                </button>
                {!collapsed && expanded && (
                  <div className="mt-0.5 ml-4 pl-4 border-l border-sidebar-border space-y-0.5">
                    {item.children.map((child) => (
                      <Link
                        key={child.path}
                        to={child.path}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                          isActive(child.path)
                            ? "bg-sidebar-primary/15 text-sidebar-primary border-l-2 border-sidebar-primary -ml-[1px] font-medium"
                            : "text-sidebar-muted hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"
                        )}
                      >
                        {child.icon && <child.icon className="w-4 h-4" />}
                        <span>{child.label}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.path}
              to={item.path!}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive(item.path!)
                  ? "bg-sidebar-primary/15 text-sidebar-primary border-l-2 border-sidebar-primary -ml-[1px]"
                  : "text-sidebar-muted hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"
              )}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom user section */}
      {!collapsed && (
        <div className="p-3 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground text-sm font-semibold">
              A
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-accent-foreground truncate">Admin</p>
              <p className="text-xs text-sidebar-muted truncate">admin@store.com</p>
            </div>
            <button className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-muted hover:text-sidebar-accent-foreground transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
