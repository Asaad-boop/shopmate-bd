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
  Plus,
  List,
  FileText,
  User,
  Activity,
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
      { label: "Import Dashboard", path: "/import-dashboard", icon: BarChart3 },
      { label: "Purchase Orders", path: "/purchase-orders", icon: List },
      { label: "Agents", path: "/agents", icon: Handshake },
      { label: "Suppliers", path: "/suppliers", icon: Users },
    ],
  },
  { label: "Customers", icon: Users, path: "/customers" },
  { label: "Finance", icon: Wallet, path: "/finance" },
  { label: "Reports", icon: BarChart3, path: "/reports" },
  { label: "HRM", icon: UserCog, path: "/hrm" },
  { label: "CRM", icon: Handshake, path: "/crm" },
  { label: "Settings", icon: Settings, path: "/settings" },
  { label: "System Health", icon: Activity, path: "/system-health" },
];

export function AppSidebar() {
  const location = useLocation();
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
    <aside className="flex flex-col h-screen w-[260px] bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300 sticky top-0">
      {/* Header: Logo + Avatar */}
      <div className="flex items-center justify-between px-5 pt-6 pb-4">
        <Link to="/" className="flex items-center gap-2 min-w-0">
          {company?.logo ? (
            <img
              src={company.logo}
              alt="Logo"
              className="h-9 max-w-[140px] object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
              <Package className="w-5 h-5 text-primary-foreground" />
            </div>
          )}
        </Link>
        <button className="w-9 h-9 rounded-full border border-sidebar-border flex items-center justify-center text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
          <User className="w-4 h-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-0.5">
        {navItems.map((item) => {
          if (item.children) {
            const groupActive = isGroupActive(item);
            const expanded = expandedGroups.includes(item.label);
            return (
              <div key={item.label}>
                <button
                  onClick={() => toggleGroup(item.label)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                    groupActive
                      ? "text-sidebar-foreground bg-sidebar-accent"
                      : "text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent"
                  )}
                >
                  <item.icon className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.8} />
                  <span className="flex-1 text-left">{item.label}</span>
                  <ChevronDown
                    className={cn("w-4 h-4 transition-transform duration-200", expanded && "rotate-180")}
                  />
                </button>
                {expanded && (
                  <div className="mt-0.5 ml-5 pl-3 border-l border-sidebar-border space-y-0.5">
                    {item.children.map((child) => (
                      <Link
                        key={child.path}
                        to={child.path}
                        className={cn(
                          "flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all duration-200",
                          isActive(child.path)
                            ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                            : "text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent"
                        )}
                      >
                        {child.icon && <child.icon className="w-4 h-4" strokeWidth={1.8} />}
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
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                isActive(item.path!)
                  ? "bg-sidebar-accent text-sidebar-foreground shadow-sm"
                  : "text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent"
              )}
            >
              <item.icon className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.8} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
