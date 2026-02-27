import { useRef } from "react";
import { cn } from "@/lib/utils";
import { STATUS_TABS, STATUS_CONFIG, type OrderStatus, type MockOrder } from "./order-list-data";

interface Props {
  activeTab: OrderStatus | "all";
  onTabChange: (tab: OrderStatus | "all") => void;
  orders: MockOrder[];
}

export function OrderStatusTabs({ activeTab, onTabChange, orders }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const counts: Record<string, number> = { all: orders.length };
  orders.forEach(o => { counts[o.status] = (counts[o.status] || 0) + 1; });

  return (
    <div className="sticky top-[57px] z-20 bg-card border-b border-border">
      <div
        ref={scrollRef}
        className="flex items-center gap-0.5 px-6 overflow-x-auto"
        style={{ scrollbarWidth: "none" }}
      >
        {STATUS_TABS.map(tab => {
          const isActive = activeTab === tab.key;
          const count = counts[tab.key] || 0;
          const cfg = tab.key !== "all" ? STATUS_CONFIG[tab.key] : null;

          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={cn(
                "relative flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium whitespace-nowrap transition-colors duration-150 shrink-0",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {cfg && (
                <span className={cn("w-1.5 h-1.5 rounded-full", cfg.dotColor)} />
              )}
              {tab.label}
              <span className={cn(
                "min-w-[20px] h-[18px] px-1.5 rounded-md text-[10px] font-bold flex items-center justify-center",
                isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              )}>
                {count}
              </span>
              {isActive && (
                <span className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
