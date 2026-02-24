import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, Package, Layers, BookOpen, Wallet, ShoppingCart, Globe } from "lucide-react";

const STEPS = [
  {
    key: "products",
    title: "Upload Products",
    description: "Add your product catalog with SKUs, prices, and costs.",
    icon: Package,
    path: "/products",
  },
  {
    key: "stock",
    title: "Set Opening Stock",
    description: "Record your current inventory quantities via stock adjustments.",
    icon: Layers,
    path: "/inventory",
  },
  {
    key: "accounts",
    title: "Chart of Accounts & Mappings",
    description: "Review your chart of accounts and configure account mappings.",
    icon: BookOpen,
    path: "/accounting",
  },
  {
    key: "balances",
    title: "Set Opening Cash/Bank Balances",
    description: "Create opening journal entries for your cash and bank accounts.",
    icon: Wallet,
    path: "/accounting",
  },
  {
    key: "orders",
    title: "Start New Orders",
    description: "Create your first order or enable a sales channel.",
    icon: ShoppingCart,
    path: "/orders/new",
  },
  {
    key: "shopify",
    title: "Enable Shopify Sync (Optional)",
    description: "Turn on Shopify integration with today's date as sync start.",
    icon: Globe,
    path: "/settings",
    optional: true,
  },
];

export function GettingStartedChecklist() {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);
  const [open, setOpen] = useState(false);

  // Check if system was recently reset and is empty
  const { data: productCount } = useQuery({
    queryKey: ["gs-product-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true });
      return count || 0;
    },
  });

  const { data: orderCount } = useQuery({
    queryKey: ["gs-order-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true });
      return count || 0;
    },
  });

  const { data: journalCount } = useQuery({
    queryKey: ["gs-journal-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("journal_entries")
        .select("id", { count: "exact", head: true });
      return count || 0;
    },
  });

  const { data: invMovCount } = useQuery({
    queryKey: ["gs-inv-mov-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("inventory_movements")
        .select("id", { count: "exact", head: true });
      return count || 0;
    },
  });

  const { data: shopifySync } = useQuery({
    queryKey: ["gs-shopify-sync"],
    queryFn: async () => {
      const { data } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "shopify_sync_enabled")
        .maybeSingle();
      return data?.value === "true";
    },
  });

  const completedSteps = new Set<string>();
  if ((productCount ?? 0) > 0) completedSteps.add("products");
  if ((invMovCount ?? 0) > 0) completedSteps.add("stock");
  if ((journalCount ?? 0) > 0) {
    completedSteps.add("accounts");
    completedSteps.add("balances");
  }
  if ((orderCount ?? 0) > 0) completedSteps.add("orders");
  if (shopifySync) completedSteps.add("shopify");

  const isEmptySystem = (productCount ?? 0) === 0 && (orderCount ?? 0) === 0;
  const allDone = completedSteps.size >= 5; // shopify is optional

  useEffect(() => {
    const wasDismissed = localStorage.getItem("gs-checklist-dismissed");
    if (wasDismissed) {
      setDismissed(true);
    }
    if (isEmptySystem && !wasDismissed) {
      setOpen(true);
    }
  }, [isEmptySystem]);

  const handleDismiss = () => {
    setOpen(false);
    setDismissed(true);
    localStorage.setItem("gs-checklist-dismissed", "true");
  };

  if (dismissed && !open) {
    if (!isEmptySystem || allDone) return null;
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="mb-4"
      >
        📋 Getting Started Checklist
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">🚀 Getting Started</DialogTitle>
          <DialogDescription>
            Your ERP has been reset. Follow these steps to set up your business data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          {STEPS.map((step, i) => {
            const done = completedSteps.has(step.key);
            const Icon = step.icon;
            return (
              <button
                key={step.key}
                onClick={() => {
                  setOpen(false);
                  navigate(step.path);
                }}
                className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors
                  ${done
                    ? "bg-muted/50 border-muted"
                    : "hover:bg-accent/50 border-border"
                  }`}
              >
                <div className="mt-0.5">
                  {done ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <Circle className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                    <span className={`font-medium text-sm ${done ? "line-through text-muted-foreground" : ""}`}>
                      Step {i + 1}: {step.title}
                    </span>
                    {step.optional && (
                      <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Optional</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex justify-end mt-4">
          <Button variant="ghost" size="sm" onClick={handleDismiss}>
            Dismiss
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
