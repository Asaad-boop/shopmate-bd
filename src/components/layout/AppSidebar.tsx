import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  Plus,
  List,
  Zap,
  Activity,
  Truck,
  Receipt,
  ScrollText,
  FileText,
  Shield,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  DollarSign,
  TrendingUp,
  Archive,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface NavItem {
  label: string;
  icon: React.ElementType;
  path?: string;
  badge?: number;
  badgeColor?: string;
  children?: { label: string; icon: React.ElementType; path: string }[];
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

export function AppSidebar() {
  const location = useLocation();
  const [expandedItems, setExpandedItems] = useState<string[]>(["Orders", "Reports"]);

  const { data: pendingCount } = useQuery({
    queryKey: ["sidebar-pending"],
    queryFn: async () => {
      const { count } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      return count || 0;
    },
  });

  const { data: lowStockCount } = useQuery({
    queryKey: ["sidebar-low-stock"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, stock_quantity, reorder_point")
        .eq("status", "active");
      return (data || []).filter((p) => (p.stock_quantity || 0) <= (p.reorder_point || 10)).length;
    },
  });

  const toggleExpand = (label: string) => {
    setExpandedItems((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  const navGroups: NavGroup[] = [
    {
      title: "MAIN",
      items: [
        { label: "Dashboard", icon: LayoutDashboard, path: "/" },
      ],
    },
    {
      title: "OPERATIONS",
      items: [
        {
          label: "Orders",
          icon: ShoppingCart,
          badge: pendingCount || 0,
          badgeColor: "bg-red-500",
          children: [
            { label: "Order List", icon: List, path: "/orders" },
            { label: "New Order", icon: Plus, path: "/orders/new" },
            { label: "Web Orders", icon: Globe, path: "/web-orders" },
          ],
        },
        { label: "Inventory", icon: Package, path: "/inventory", badge: lowStockCount || 0, badgeColor: "bg-orange-500" },
        { label: "Courier & COD", icon: Truck, path: "/courier" },
      ],
    },
    {
      title: "FINANCE",
      items: [
        { label: "Accounts", icon: BookOpen, path: "/accounts" },
        { label: "Expenses", icon: Receipt, path: "/expenses" },
        {
          label: "Reports",
          icon: BarChart3,
          children: [
            { label: "P&L Report", icon: TrendingUp, path: "/reports/pnl" },
            { label: "Cashflow", icon: DollarSign, path: "/reports/cashflow" },
            { label: "Stock Report", icon: Archive, path: "/reports/stock" },
          ],
        },
      ],
    },
    {
      title: "PROCUREMENT",
      items: [
        { label: "Purchase Orders", icon: Boxes, path: "/purchase-orders" },
        { label: "Suppliers", icon: Handshake, path: "/suppliers" },
      ],
    },
    {
      title: "SYSTEM",
      items: [
        { label: "Audit Logs", icon: ScrollText, path: "/audit-logs" },
        { label: "Settings", icon: Settings, path: "/settings" },
      ],
    },
  ];

  const isActive = (path: string) => location.pathname === path;
  const isChildActive = (children?: { path: string }[]) =>
    children?.some((c) => location.pathname === c.path || location.pathname.startsWith(c.path + "/"));

  return (
    <aside className="flex flex-col h-screen w-[220px] bg-card text-foreground border-r border-border sticky top-0 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-5">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shrink-0">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-sm text-foreground leading-tight">HeroShop</p>
          <p className="text-[10px] text-muted-foreground leading-tight">ERP v3.0</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-5">
        {navGroups.map((group) => (
          <div key={group.title}>
            <p className="px-3 mb-1.5 text-[10px] font-semibold tracking-widest text-muted-foreground">{group.title}</p>
            <div className="space-y-0.5">
              {group.items.map((item) =>
                item.children ? (
                  <div key={item.label}>
                    <button
                      onClick={() => toggleExpand(item.label)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200",
                        isChildActive(item.children)
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent"
                      )}
                    >
                      <item.icon className="w-4 h-4 shrink-0" strokeWidth={1.8} />
                      <span className="flex-1 text-left">{item.label}</span>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className={cn("text-[10px] font-bold text-white px-1.5 py-0.5 rounded-full min-w-[20px] text-center", item.badgeColor)}>
                          {item.badge}
                        </span>
                      )}
                      {expandedItems.includes(item.label) ? (
                        <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                      )}
                    </button>
                    {expandedItems.includes(item.label) && (
                      <div className="ml-4 mt-0.5 space-y-0.5 border-l border-border pl-3">
                        {item.children.map((child) => (
                          <Link
                            key={child.path}
                            to={child.path}
                            className={cn(
                              "flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all",
                              isActive(child.path)
                                ? "bg-primary/10 text-primary font-semibold"
                                : "text-muted-foreground hover:text-foreground hover:bg-accent"
                            )}
                          >
                            <child.icon className="w-3.5 h-3.5 shrink-0" strokeWidth={1.8} />
                            <span>{child.label}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <Link
                    key={item.path}
                    to={item.path!}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 relative",
                      isActive(item.path!)
                        ? "bg-primary/10 text-primary font-semibold border-l-2 border-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    )}
                  >
                    <item.icon className="w-4 h-4 shrink-0" strokeWidth={1.8} />
                    <span className="flex-1">{item.label}</span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className={cn("text-[10px] font-bold text-white px-1.5 py-0.5 rounded-full min-w-[20px] text-center", item.badgeColor)}>
                        {item.badge}
                      </span>
                    )}
                  </Link>
                )
              )}
            </div>
          </div>
        ))}
      </nav>

      {/* User card */}
      <div className="px-3 pb-4">
        <div className="flex items-center gap-3 px-3 py-3 rounded-lg bg-accent">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
            MA
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">Maiukh Akit</p>
            <p className="text-[10px] text-muted-foreground">Admin</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
