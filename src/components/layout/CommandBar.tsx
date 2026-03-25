import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, ShoppingCart, Plus, Package, Boxes, Wallet, Users,
  BarChart2, Settings, Globe, Megaphone, BookOpen, Truck, UserCheck,
  AlertTriangle, Search, Clock, ArrowRight, Ship, Receipt,
  ArrowLeftRight, Zap, Rocket, ClipboardList, Shield,
} from "lucide-react";

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  keywords?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard, keywords: "home main" },
  { label: "New Order", path: "/orders/new", icon: Plus, keywords: "create add" },
  { label: "All Orders", path: "/orders/all", icon: ShoppingCart, keywords: "order list" },
  { label: "Approved Orders", path: "/orders/approved", icon: ShoppingCart },
  { label: "Pre Orders", path: "/orders/pre-orders", icon: Package },
  { label: "Scan to Update", path: "/orders/scan", icon: Search },
  { label: "Web Orders", path: "/web-orders", icon: Globe, keywords: "shopify" },
  { label: "Exchanges", path: "/exchanges", icon: ArrowLeftRight },
  { label: "Products", path: "/products", icon: Package, keywords: "product list" },
  { label: "Add Product", path: "/products/new", icon: Plus },
  { label: "Inventory", path: "/inventory", icon: Boxes, keywords: "stock" },
  { label: "Category & Brand", path: "/inventory/categories", icon: Package },
  { label: "Purchasing", path: "/purchasing", icon: ClipboardList },
  { label: "Purchase Orders", path: "/purchase-orders", icon: ClipboardList },
  { label: "Suppliers", path: "/suppliers", icon: Users },
  { label: "Imports", path: "/import-dashboard", icon: Ship },
  { label: "Finance", path: "/finance", icon: Wallet },
  { label: "Accounts", path: "/finance/accounts", icon: Wallet },
  { label: "Posting Queue", path: "/finance/posting-queue", icon: ClipboardList },
  { label: "Accounting", path: "/accounting", icon: BookOpen },
  { label: "Courier COD", path: "/courier-cod", icon: Truck },
  { label: "Expenses", path: "/expenses", icon: Receipt },
  { label: "CRM", path: "/crm", icon: Users, keywords: "customer" },
  { label: "Marketing", path: "/marketing", icon: Megaphone },
  { label: "Campaign Decisions", path: "/marketing/decisions", icon: Megaphone, keywords: "kill scale hold" },
  { label: "Influencers", path: "/marketing/influencers", icon: Users },
  { label: "UGC Creators", path: "/marketing/ugc-creators", icon: Users },
  { label: "Meta Ads Report", path: "/meta-ads/report", icon: Megaphone },
  { label: "HRM", path: "/hrm", icon: UserCheck, keywords: "staff employee" },
  { label: "Reports", path: "/reports", icon: BarChart2 },
  { label: "Optimization", path: "/optimization", icon: Zap, keywords: "anomaly sla" },
  { label: "Go Live", path: "/go-live", icon: Rocket, keywords: "setup onboarding" },
  { label: "Settings", path: "/settings", icon: Settings },
  { label: "Roles & Permissions", path: "/security/roles", icon: Shield },
  { label: "Audit Logs", path: "/security/audit-logs", icon: Shield },
  { label: "Exceptions", path: "/exceptions", icon: AlertTriangle },
];

const RECENT_KEY = "shopmate_cmd_recent";

function getRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { return []; }
}
function addRecent(path: string) {
  const arr = getRecent().filter(p => p !== path);
  arr.unshift(path);
  localStorage.setItem(RECENT_KEY, JSON.stringify(arr.slice(0, 5)));
}

export function CommandBar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Search Supabase for data results
  const { data: searchResults } = useQuery({
    queryKey: ["cmd-search", query],
    queryFn: async () => {
      if (query.length < 2) return [];
      const results: { label: string; path: string; type: string }[] = [];

      // Search orders
      const { data: orders } = await supabase.from("orders")
        .select("id, invoice_id, phone, status")
        .or(`invoice_id.ilike.%${query}%,phone.ilike.%${query}%`)
        .limit(5);
      (orders || []).forEach(o => {
        results.push({ label: `Order ${o.invoice_id} — ${o.phone}`, path: `/orders/${o.id}`, type: "Order" });
      });

      // Search products
      const { data: products } = await supabase.from("products")
        .select("id, name, sku")
        .or(`name.ilike.%${query}%,sku.ilike.%${query}%`)
        .limit(5);
      (products || []).forEach(p => {
        results.push({ label: `${p.name} (${p.sku})`, path: `/products`, type: "Product" });
      });

      // Search customers
      const { data: customers } = await supabase.from("customers")
        .select("id, full_name, phone")
        .or(`full_name.ilike.%${query}%,phone.ilike.%${query}%`)
        .limit(5);
      (customers || []).forEach(c => {
        results.push({ label: `${c.full_name || "—"} — ${c.phone}`, path: `/crm`, type: "Customer" });
      });

      return results;
    },
    enabled: query.length >= 2,
    staleTime: 30_000,
  });

  // Filter nav items
  const filteredNav = useMemo(() => {
    if (!query) return [];
    const q = query.toLowerCase();
    return NAV_ITEMS.filter(item =>
      item.label.toLowerCase().includes(q) || (item.keywords || "").toLowerCase().includes(q)
    ).slice(0, 8);
  }, [query]);

  const recentPaths = getRecent();
  const recentItems = recentPaths.map(p => NAV_ITEMS.find(n => n.path === p)).filter(Boolean) as NavItem[];

  const allResults = useMemo(() => {
    const items: { label: string; path: string; icon?: React.ElementType; section: string }[] = [];

    if (!query && recentItems.length > 0) {
      recentItems.forEach(r => items.push({ label: r.label, path: r.path, icon: r.icon, section: "Recent" }));
    }
    filteredNav.forEach(n => items.push({ label: n.label, path: n.path, icon: n.icon, section: "Navigation" }));
    (searchResults || []).forEach(r => items.push({ label: r.label, path: r.path, section: r.type }));

    return items;
  }, [query, filteredNav, searchResults, recentItems]);

  const handleSelect = useCallback((path: string) => {
    addRecent(path);
    navigate(path);
    setOpen(false);
  }, [navigate]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, allResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && allResults[selectedIndex]) {
      e.preventDefault();
      handleSelect(allResults[selectedIndex].path);
    }
  }, [allResults, selectedIndex, handleSelect]);

  // Group results by section
  const grouped = useMemo(() => {
    const map = new Map<string, typeof allResults>();
    allResults.forEach(item => {
      const arr = map.get(item.section) || [];
      arr.push(item);
      map.set(item.section, arr);
    });
    return map;
  }, [allResults]);

  let flatIndex = -1;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg p-0 gap-0 rounded-xl overflow-hidden border-border/50 shadow-2xl [&>button]:hidden">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <Input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Search or jump to..."
            className="border-0 shadow-none focus-visible:ring-0 h-8 text-sm px-0"
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded border">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[360px] overflow-y-auto py-2">
          {allResults.length === 0 && query && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No results for "{query}"
            </div>
          )}
          {allResults.length === 0 && !query && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Type to search pages, orders, products, customers...
            </div>
          )}
          {[...grouped.entries()].map(([section, items]) => (
            <div key={section}>
              <p className="text-[10px] font-semibold uppercase text-muted-foreground px-4 py-1.5 tracking-wider">
                {section}
              </p>
              {items.map(item => {
                flatIndex++;
                const idx = flatIndex;
                const Icon = item.icon || ArrowRight;
                return (
                  <button
                    key={`${item.path}-${idx}`}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2 text-left transition-colors text-sm",
                      idx === selectedIndex ? "bg-primary/10 text-primary" : "hover:bg-muted/50 text-foreground",
                    )}
                    onClick={() => handleSelect(item.path)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate">{item.label}</span>
                    <span className="text-[10px] text-muted-foreground">↵</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-border bg-muted/30 text-[10px] text-muted-foreground">
          <span>↑↓ Navigate</span>
          <span>↵ Select</span>
          <span>ESC Close</span>
          <span className="ml-auto">⌘K to toggle</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
